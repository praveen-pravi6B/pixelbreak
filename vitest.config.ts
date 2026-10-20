import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@pixelbreak/contracts': path.resolve(__dirname, './packages/contracts/src'),
      '@pixelbreak/config': path.resolve(__dirname, './packages/config/src'),
      '@pixelbreak/layout-analyzer': path.resolve(__dirname, './packages/layout-analyzer/src'),
      '@pixelbreak/runner': path.resolve(__dirname, './apps/runner/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
