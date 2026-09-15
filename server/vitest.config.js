import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{js,cjs,mjs}'],
    testTimeout: 15000,
    pool: 'forks',
    coverage: {
      enabled: false,
    },
  },
});