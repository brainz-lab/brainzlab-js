import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default [
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    external: ['@hotwired/stimulus'],
    plugins: [
      resolve(),
      typescript({
        declaration: true,
        declarationDir: 'dist',
        rootDir: 'src',
      }),
    ],
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    external: ['@hotwired/stimulus'],
    plugins: [
      resolve(),
      typescript(),
    ],
  },
  // UMD build (for CDN/importmaps)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/brainzlab.umd.js',
      format: 'umd',
      name: 'BrainzLab',
      sourcemap: true,
      globals: {
        '@hotwired/stimulus': 'Stimulus',
      },
    },
    external: ['@hotwired/stimulus'],
    plugins: [
      resolve(),
      typescript(),
    ],
  },
];
