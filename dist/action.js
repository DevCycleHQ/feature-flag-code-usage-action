"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCodeUsages = exports.authenticate = exports.run = void 0;
const action = __importStar(require("./action"));
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const exec_1 = require("@actions/exec");
const axios_1 = __importDefault(require("axios"));
const API_URL = 'https://api.devcycle.com/';
const AUTH_URL = 'https://auth.devcycle.com/';
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const requiredInputs = ['github-token', 'project-key', 'client-id', 'client-secret'];
        for (const inputKey of requiredInputs) {
            if (!core.getInput(inputKey)) {
                core.setFailed(`Missing ${inputKey}`);
                return;
            }
        }
        const token = core.getInput('github-token');
        const octokit = token && github.getOctokit(token);
        if (!octokit) {
            core.setFailed('No octokit client');
            return;
        }
        try {
            yield (0, exec_1.exec)('npm', ['install', '-g', '@devcycle/cli@4.2.9']);
            const output = yield (0, exec_1.getExecOutput)('dvc', ['usages', '--format', 'json', '--caller', 'github']);
            const variables = JSON.parse(output.stdout);
            yield action.postCodeUsages(variables);
        }
        catch (err) {
            core.setFailed(err);
        }
    });
}
exports.run = run;
const authenticate = (client_id, client_secret) => __awaiter(void 0, void 0, void 0, function* () {
    const url = new URL('/oauth/token', AUTH_URL);
    try {
        const response = yield axios_1.default.post(url.href, {
            grant_type: 'client_credentials',
            client_id,
            client_secret,
            audience: 'https://api.devcycle.com/',
        });
        return response.data.access_token;
    }
    catch (e) {
        core.error(e);
        throw new Error('Failed to authenticate with the DevCycle API. Check your credentials.');
    }
});
exports.authenticate = authenticate;
const postCodeUsages = (variables) => __awaiter(void 0, void 0, void 0, function* () {
    const projectKey = core.getInput('project-key');
    const clientId = core.getInput('client-id');
    const clientSecret = core.getInput('client-secret');
    const authToken = yield action.authenticate(clientId, clientSecret);
    const url = new URL(`/v1/projects/${projectKey}/codeUsages`, API_URL);
    const headers = {
        Authorization: authToken,
        'dvc-referrer': 'github.code_usages',
        'dvc-referrer-metadata': JSON.stringify({
            action: 'code_usages'
        })
    };
    const { owner, repo } = github.context.repo;
    try {
        yield axios_1.default.post(url.href, {
            source: 'github',
            repo: `${owner}/${repo}`,
            branch: github.context.ref.split('/').pop(),
            variables
        }, { headers });
    }
    catch (e) {
        core.error(e);
        core.error(e.response.data);
        throw new Error('Failed to submit Code Usages.');
    }
});
exports.postCodeUsages = postCodeUsages;
