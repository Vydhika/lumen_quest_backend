module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/src/tests/**/*.test.js',
    '**/src/tests/**/*.spec.js'
  ],

  // Coverage settings
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/db/migrations/**',
    '!src/index.js',
    '!**/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  globalTeardown: '<rootDir>/src/tests/teardown.js',

  // Module paths
  moduleDirectories: ['node_modules', 'src'],

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Transform settings for ES modules
  transform: {},
  extensionsToTreatAsEsm: [],

  // Mock settings
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1'
  }
};