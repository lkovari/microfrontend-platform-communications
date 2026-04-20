import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.spec.ts'],
    coverage: { reporter: ['text', 'lcov'] },
  },
});
