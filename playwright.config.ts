import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:4173',
    launchOptions: process.env.CHROME_PATH ? {
      executablePath: process.env.CHROME_PATH,
      args: ['--no-sandbox'],
    } : {},
  },
  webServer: {
    command: 'npm run preview -- --host 0.0.0.0 --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
