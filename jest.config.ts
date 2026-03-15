/* eslint-disable */
export default {
    transform: {
        '^.+\\.[tj]s$': [
            'ts-jest',
            { tsconfig: '<rootDir>/tsconfig.spec.json' },
        ],
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@octokit|universal-user-agent|before-after-hook)/)',
    ],
    moduleFileExtensions: ['ts', 'js'],
    maxWorkers: 1,
}
