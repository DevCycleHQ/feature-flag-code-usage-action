import * as github from '@actions/github'
import * as core from '@actions/core'
import { exec, getExecOutput } from '@actions/exec'
import axios from 'axios'

const token = core.getInput('github-token')
const projectKey = core.getInput('project-key')
const clientId = core.getInput('client-id')
const clientSecret = core.getInput('client-secret')
const octokit = token && github.getOctokit(token)

const API_URL = 'https://api.devcycle.com/'
const AUTH_URL = 'https://auth.devcycle.com/'

async function run() {
    const requiredInputs = ['github-token', 'project-key', 'client-id', 'client-secret']
    for (const inputKey of requiredInputs) {
        if (!core.getInput(inputKey)) {
            core.setFailed(`Missing ${inputKey}`)
            return
        }
    }

    if (!octokit) {
        core.setFailed('No octokit client')
        return
    }

    try {
        await exec('npm', ['install', '-g', '@devcycle/cli@3.0.0'])

        const output = await getExecOutput(
            'dvc',
            ['usages', '--format', 'json']
        )
        const variables = JSON.parse(output.stdout)

        await postCodeUsages(variables)
    } catch (err: any) {
        core.setFailed(err)
    }
}

const authenticate = async (client_id: string, client_secret: string): Promise<string> => {
    const url = new URL('/oauth/token', AUTH_URL)

    try {
        const response = await axios.post(url.href, {
            grant_type: 'client_credentials',
            client_id,
            client_secret,
            audience: 'https://api.devcycle.com/',
        })

        return response.data.access_token
    } catch (e: any) {
        core.error(e)
        throw new Error('Failed to authenticate with the DevCycle API. Check your credentials.')
    }
}

const postCodeUsages = async (variables: any[]): Promise<void> => {
    const authToken = await authenticate(clientId, clientSecret) 
    const url = new URL(`/v1/projects/${projectKey}/codeUsages`, API_URL)

    const headers = { Authorization: authToken }
    const { owner, repo } = github.context.repo

    try {
        await axios.post(
            url.href,
            {
                repo: `${owner}/${repo}`,
                branch: github.context.ref.split('/').pop(),
                variables
            },
            { headers }
        )
    } catch (e: any) {
        core.error(e)
        core.error(e.response.data)
        throw new Error('Failed to submit Code Usages.')
    }
}

run()
