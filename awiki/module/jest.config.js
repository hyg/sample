module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/../doc'],
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/doc/**/test.js'
  ],
  collectCoverageFrom: [
    'scripts/**/*.js',
    '!scripts/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  verbose: true,
  testTimeout: 30000,
  moduleNameMapper: {
    '^\\.\\./\\.\\./scripts/manage_group$': '<rootDir>/scripts/manage-group.js',
    '^\\.\\./\\.\\./scripts/service_manager$': '<rootDir>/scripts/service-manager.js',
    '^\\.\\./\\.\\./scripts/(.*)$': '<rootDir>/scripts/$1',
    '^\\.\\./\\.\\./scripts/utils/(.*)$': '<rootDir>/scripts/utils/$1',
    '^undici$': '<rootDir>/node_modules/undici/index.js',
    '^ws$': '<rootDir>/node_modules/ws'
  }
};
