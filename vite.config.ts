import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeConfig } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

const testConfig = {
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
};

export default defineConfig(({ mode }) => {
  if (mode === 'content') {
    return mergeConfig(
      {
        base: './',
        publicDir: false,
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          sourcemap: true,
          minify: false,
          target: 'chrome114',
          rollupOptions: {
            input: path.join(root, 'src/content/index.ts'),
            output: {
              format: 'iife',
              name: 'clawtabContent',
              entryFileNames: 'content.js',
            },
          },
        },
      },
      testConfig,
    );
  }

  return mergeConfig(
    {
      base: './',
      publicDir: 'public',
      build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        target: 'chrome114',
        rollupOptions: {
          input: {
            popup: path.join(root, 'popup.html'),
            background: path.join(root, 'src/background/index.ts'),
          },
          output: {
            entryFileNames: '[name].js',
            chunkFileNames: 'chunks/[name].js',
            assetFileNames: (assetInfo: { names: string[] }) => {
              if (assetInfo.names?.some((name) => name.endsWith('.css'))) {
                return 'styles.css';
              }
              return 'assets/[name][extname]';
            },
          },
        },
      },
    },
    testConfig,
  );
});
