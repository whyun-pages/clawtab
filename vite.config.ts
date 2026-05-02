import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'chrome114',
    rollupOptions: {
      input: {
        popup: path.join(root, 'popup.html'),
        background: path.join(root, 'src/background/index.ts'),
        content: path.join(root, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.some((name) => name.endsWith('.css'))) {
            return 'styles.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
