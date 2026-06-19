import { defineConfig } from 'vitest/config';

// The password-reset security suite lives under localTests/ (gitignored, matching
// the project's existing local-test convention). It imports the real shipped
// logic from functions/src/, so the tests verify exactly what runs in production.
export default defineConfig({
  test: {
    include: ['localTests/**/*.test.js'],
    environment: 'node',
  },
});
