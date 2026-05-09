import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    env: {
      NODE_ENV: 'test',
      PHOTOLIVE_AUTH_TOKEN: 'test-token',
      DATABASE_PATH: ':memory:',
    },
  },
  resolve: {
    alias: {
      '@photolive/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
