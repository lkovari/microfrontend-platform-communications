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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        'src/core/registry.ts': {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 80,
        },
        'src/angular/**': {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 70,
        },
        'src/react/**': {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 70,
        },
        'src/vue/**': {
          lines: 80,
          functions: 80,
          statements: 80,
          branches: 70,
        },
      },
    },
  },
});
