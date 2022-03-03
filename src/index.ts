import * as github from '@actions/github'
import * as core from '@actions/core'
import { exec, getExecOutput } from '@actions/exec'
import axios from 'axios'

const { owner, repo } = github.context.repo
const branch = github.context.ref
const token = core.getInput('github-token')
const projectKey = core.getInput('project-key')
const clientId = core.getInput('client-id')
const clientSecret = core.getInput('client-secret')
const octokit = token && github.getOctokit(token)

const API_URL = 'https://api.devcycle.com/v1'
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
        await exec('npm', ['install', '-g', '@devcycle/cli@2.1.0-alpha.0'])

        const output = await getExecOutput(
            'dvc',
            ['usages', '--format', 'json']
        )
        const variables = JSON.parse(output.stdout)

        const authToken = await authenticate(clientId, clientSecret) 

        await postCodeUsages(`${owner}/${repo}`, variables, authToken)
    } catch (err: any) {
        core.setFailed(err)
        throw err
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

const postCodeUsages = async (repo: string, variables: any[], authToken: string): Promise<void> => {
    const url = new URL(`/projects/${projectKey}/codeUsages`, API_URL)

    const headers = { Authorization: authToken }

    try {
        await axios.post(
            url.href,
            { repo, branch, variables },
            { headers }
        )
    } catch (e: any) {
        core.error(e)
        throw new Error('Failed to submit Code Usages.')
    }
}

run()
