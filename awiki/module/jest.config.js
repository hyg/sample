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
    // 精确匹配 snake_case 文件到连字符命名的 JS 文件
    '^\\.\\./\\.\\./scripts/manage_group$': '<rootDir>/scripts/manage-group.js',
    '^\\.\\./\\.\\./scripts/service_manager$': '<rootDir>/scripts/service-manager.js',
    '^\\.\\./\\.\\./scripts/database_migration$': '<rootDir>/scripts/database_migration.js',
    '^\\.\\./\\.\\./scripts/e2ee_outbox$': '<rootDir>/scripts/e2ee-outbox.js',
    '^\\.\\./\\.\\./scripts/credential_layout$': '<rootDir>/scripts/credential-layout.js',
    '^\\.\\./\\.\\./scripts/message_transport$': '<rootDir>/scripts/message-transport.js',
    '^\\.\\./\\.\\./scripts/message_daemon$': '<rootDir>/scripts/message-daemon.js',
    '^\\.\\./\\.\\./scripts/listener_recovery$': '<rootDir>/scripts/listener-recovery.js',
    '^\\.\\./\\.\\./scripts/setup_realtime$': '<rootDir>/scripts/setup-realtime.js',
    '^\\.\\./\\.\\./scripts/register_handle$': '<rootDir>/scripts/register-handle.js',
    '^\\.\\./\\.\\./scripts/bind_contact$': '<rootDir>/scripts/bind-contact.js',
    '^\\.\\./\\.\\./scripts/listener_config$': '<rootDir>/scripts/listener-config.js',
    '^\\.\\./\\.\\./scripts/cli_errors$': '<rootDir>/scripts/utils/cli-errors.js',
    '^\\.\\./\\.\\./scripts$': '<rootDir>/scripts/index.js',
    '^\\.\\./\\.\\./scripts/utils$': '<rootDir>/scripts/utils/index.js',
    // 通用映射
    '^\\.\\./\\.\\./scripts/utils/(.*)$': '<rootDir>/scripts/utils/$1',
    '^\\.\\./\\.\\./scripts/(.*)$': '<rootDir>/scripts/$1',
    '^undici$': '<rootDir>/node_modules/undici/index.js',
    '^ws$': '<rootDir>/node_modules/ws'
  }
};
