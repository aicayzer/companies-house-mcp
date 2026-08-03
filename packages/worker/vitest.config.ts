import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The handler is plain web-standard code, so it runs under Node directly.
    // The wrangler dry-run build covers workerd bundling separately.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
