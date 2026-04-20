import { defineConfig } from 'tsup';

export default defineConfig({
  ignoreWatch: ['examples/**'],
  entry: {
    index: 'src/index.ts',
    'contracts/index': 'src/contracts/index.ts',
    'schemas/index': 'src/schemas/index.ts',
    'core/index': 'src/core/index.ts',
    'angular/index': 'src/angular/index.ts',
    'react/index': 'src/react/index.ts',
    'vue/index': 'src/vue/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: true,
  treeshake: true,
  target: 'es2022',
  external: ['@angular/core', 'react', 'react-dom', 'rxjs', 'vue'],
});
