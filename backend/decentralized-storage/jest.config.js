// jest.config.js
export default {
  testEnvironment: 'node',
  transform: {},
  // Support ESM
  extensionsToTreatAsEsm: ['.js'],
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/load/'],
  moduleNameMapper: {},
  collectCoverageFrom: ['src/**/*.js'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { branches: 60, functions: 70, lines: 70, statements: 70 },
  },
};
