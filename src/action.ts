import * as action from './action'
import * as github from '@actions/github'
import * as core from '@actions/core'
import { exec, getExecOutput } from '@actions/exec'

const API_URL = 'https://api.devcycle.com/'
const AUTH_URL = 'https://auth.devcycle.com/'

const DVC_IDENTIFIER = 'github.code_usages'

export async function run() {
    const requiredInputs = ['github-token', 'project-key', 'client-id', 'client-secret']
    for (const inputKey of requiredInputs) {
        if (!core.getInput(inputKey)) {
            core.setFailed(`Missing ${inputKey}`)
            return
        }
    }

    const token = core.getInput('github-token')
    const octokit = token && github.getOctokit(token)
    if (!octokit) {
        core.setFailed('No octokit client')
        return
    }

    try {
        await exec('npm', ['install', '-g', '@devcycle/cli@5.20.2'])

        const output = await getExecOutput(
            'dvc',
            ['usages', '--format', 'json', '--caller', DVC_IDENTIFIER]
        )
        const variables = JSON.parse(output.stdout)

        await action.postCodeUsages(variables)
    } catch (err: any) {
        core.setFailed(err)
    }
}

export const authenticate = async (client_id: string, client_secret: string): Promise<string> => {


    try {
        const params = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id,
            client_secret,
            audience: API_URL
        })
        const url = new URL(`/oauth/token?${params.toString()}`, AUTH_URL)
        const resp = await fetch(url.href, {
            method: 'POST',
        })
        if (resp.status >= 400) {
            throw new Error('Failed to authenticate with the DevCycle API. Check your credentials.')
        }
        return (await resp.json()).access_token
    } catch (e: any) {
        core.error(e)
        throw e
    }
}

export const postCodeUsages = async (variables: any[]): Promise<void> => {
    const projectKey = core.getInput('project-key')
    const clientId = core.getInput('client-id')
    const clientSecret = core.getInput('client-secret')

    const authToken = await action.authenticate(clientId, clientSecret)
    const url = new URL(`/v1/projects/${projectKey}/codeUsages`, API_URL)

    const headers = {
        Authorization: authToken,
        'dvc-referrer': DVC_IDENTIFIER
    }
    const { owner, repo } = github.context.repo

    try {
        const resp = await fetch(url.href, {
            method: 'POST',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: 'github',
                repo: `${owner}/${repo}`,
                branch: github.context.ref.split('/').pop(),
                variables
            })
        })
        if (!resp.ok) {
            throw new Error('Failed to submit Code Usages.')
        }
    } catch (e: any) {
        core.error(e)
        throw e
    }
}
