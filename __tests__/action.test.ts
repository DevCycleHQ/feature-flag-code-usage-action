import * as action from '../src/action'


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
        const inputs = {...mockInputs}
        delete inputs[param]
        core.getInput = jest.fn().mockImplementation((key) => inputs[key])
        await action.run()

        expect(core.setFailed).toBeCalledWith(`Missing ${param}`)
    })

    it('calls postCodeUsages for a valid request', async () => {
        exec.getExecOutput = jest.fn().mockResolvedValue({stdout: '[]'})
        await action.run()

        expect(action.authenticate).not.toBeCalled()
        expect(core.setFailed).not.toBeCalled()
        expect(action.postCodeUsages).toBeCalledWith([])
    })
})

describe('authenticate', () => {


    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('sends authentication request', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({access_token: '123'}),
            }),
        ) as jest.Mock;

        const returnedToken = await action.authenticate('mock-client-id', 'mock-client-secret')
        const formData = new FormData()
        formData.append('grant_type', 'client_credentials')
        formData.append('client_id', 'mock-client-id')
        formData.append('client_secret', 'mock-client-secret')
        formData.append('audience', 'https://api.devcycle.com/')


        expect(fetch).toBeCalledWith(
            'https://auth.devcycle.com/oauth/token',
            expect.objectContaining({body: formData}))
        expect(returnedToken).toEqual('123')
    })

    it('fails if an error is thrown during authentication', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve('Some error'),
            }),
        ) as jest.Mock;
        const authenticate = () => action.authenticate('mock-client-id', 'mock-client-secret')

        await expect(authenticate).rejects.toThrow('Failed to authenticate with the DevCycle API. Check your credentials.')
    })
})

describe('postCodeUsages', () => {
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
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({}),
            }),
        ) as jest.Mock;
        await action.postCodeUsages([])

        expect(action.authenticate).toBeCalledWith('id', 'secret')
        expect(fetch).toBeCalledWith(
            'https://api.devcycle.com/v1/projects/my-project/codeUsages',
            expect.objectContaining(
                {
                    body: expect.stringContaining(JSON.stringify({
                        source: 'github',
                        repo: 'mock-owner/mock-repo',
                        branch: github.context.ref.split('/').pop(),
                        variables: []
                    })),
                    headers: {
                        Authorization: 'generated-token',
                        'dvc-referrer': 'github.code_usages'
                    }
                }))
    })

    it('fails if an error is thrown when sending code usages', async () => {
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve('Some error'),
            }),
        ) as jest.Mock;

        const postCodeUsages = () => action.postCodeUsages([])

        await expect(postCodeUsages).rejects.toThrow('Failed to submit Code Usages.')
    })
})