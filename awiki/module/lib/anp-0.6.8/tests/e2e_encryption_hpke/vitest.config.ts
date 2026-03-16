import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['../../src/e2e_encryption_hpke/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/node_modules/**',
        '**/dist/**',
      ],
    },
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../src/e2e_encryption_hpke'),
      '@noble/curves/nist': resolve(__dirname, 'node_modules/@noble/curves/nist.js'),
      '@noble/curves/ed25519': resolve(__dirname, 'node_modules/@noble/curves/ed25519.js'),
      '@noble/ciphers/aes': resolve(__dirname, 'node_modules/@noble/ciphers/aes.js'),
      '@noble/hashes/hkdf': resolve(__dirname, 'node_modules/@noble/hashes/hkdf.js'),
      '@noble/hashes/sha2': resolve(__dirname, 'node_modules/@noble/hashes/sha2.js'),
      '@noble/hashes/utils': resolve(__dirname, 'node_modules/@noble/hashes/utils.js'),
      '@noble/hashes/hmac': resolve(__dirname, 'node_modules/@noble/hashes/hmac.js'),
    },
  },
  // 使用与源代码相同的模块解析
  esbuild: {
    target: 'node18',
  },
});
