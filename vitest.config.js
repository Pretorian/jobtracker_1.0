const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    silent: true,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    isolate: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['server/**/*.js'],
      exclude: [
        'server/index.js',
        'tests/**',
        '**/node_modules/**',
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 65,
      },
    },
  },
})
