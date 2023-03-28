import * as action from '../src/action'

jest.mock('axios')
jest.mock('@actions/core')
jest.mock('@actions/exec')
jest.mock('@actions/github')

const mockInputs: Record<string, string> = {
    'github-token': 'token',
    'project-key': 'my-project',
    'client-id': 'id',
    'client-secret': 'secret'
}

describe('run', () => {
    const core = require('@actions/core')
    const github = require('@actions/github')
    const exec = require('@actions/exec')

    beforeAll(() => {
        jest.spyOn(action, 'authenticate').mockResolvedValue('generated-token')
        jest.spyOn(action, 'postCodeUsages').mockResolvedValue()
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    beforeEach(() => {
        jest.clearAllMocks()
        github.getOctokit = jest.fn().mockReturnValue({})
        core.getInput = jest.fn().mockImplementation((key) => mockInputs[key])
    })

    test.each([
        'github-token', 'project-key', 'client-id', 'client-secret'
    ])('fails when missing parameter: %s', async (param) => {
        const inputs = { ...mockInputs }
        delete inputs[param]
        core.getInput = jest.fn().mockImplementation((key) => inputs[key])
        await action.run()

        expect(core.setFailed).toBeCalledWith(`Missing ${param}`)
    })

    it('calls postCodeUsages for a valid request', async () => {
        exec.getExecOutput = jest.fn().mockResolvedValue({ stdout: '[]' })
        await action.run()

        expect(action.authenticate).not.toBeCalled()
        expect(core.setFailed).not.toBeCalled()
        expect(action.postCodeUsages).toBeCalledWith([])
    })
})

describe('authenticate', () => {
    const axios = require('axios')

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('sends authentication request', async () => {
        axios.post = jest.fn().mockResolvedValue({ data: { access_token: '123' } })

        const returnedToken = await action.authenticate('mock-client-id', 'mock-client-secret')

        expect(axios.post).toBeCalledWith(
            'https://auth.devcycle.com/oauth/token',
            expect.objectContaining({
                grant_type: 'client_credentials',
                client_id: 'mock-client-id',
                client_secret: 'mock-client-secret',
                audience: 'https://api.devcycle.com/',
            })
        )
        expect(returnedToken).toEqual('123')
    })

    it('fails if an error is thrown during authentication', async () => {
        axios.post = jest.fn().mockRejectedValue('Some error')

        const authenticate = () => action.authenticate('mock-client-id', 'mock-client-secret')

        expect(authenticate).rejects.toThrow('Failed to authenticate with the DevCycle API. Check your credentials.')
    })
})

describe('postCodeUsages', () => {
    const axios = require('axios')
    const core = require('@actions/core')
    const github = require('@actions/github')

    beforeAll(() => {
        jest.spyOn(action, 'authenticate').mockResolvedValue('generated-token')
    })

    afterAll(() => {
        jest.restoreAllMocks()
    })

    beforeEach(() => {
        jest.clearAllMocks()
        core.getInput = jest.fn().mockImplementation((key) => mockInputs[key])
        github.context = {
            repo: {
                owner: 'mock-owner',
                repo: 'mock-repo'
            },
            ref: 'refs/heads/main'
        }
    })

    it('sends request to API', async () => {
        axios.post = jest.fn()

        await action.postCodeUsages([])

        expect(action.authenticate).toBeCalledWith('id', 'secret')
        expect(axios.post).toBeCalledWith(
            'https://api.devcycle.com/v1/projects/my-project/codeUsages',
            expect.objectContaining({
                source: 'github',
                repo: 'mock-owner/mock-repo',
                branch: github.context.ref.split('/').pop(),
                variables: []
            }),
            expect.objectContaining({
                headers: {
                    Authorization: 'generated-token'
                }
            })
        )
    })

    it('fails if an error is thrown when sending code usages', async () => {
        axios.post = jest.fn().mockRejectedValue({
            response: { data: { message: 'Some error' } }
        })

        const postCodeUsages = () => action.postCodeUsages([])

        expect(postCodeUsages).rejects.toThrow('Failed to submit Code Usages.')
    })
})