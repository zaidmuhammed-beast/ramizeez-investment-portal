import { defineConfig } from "@playwright/test";

// End-to-end tests run against a running app (`npm run build && npm start`) with
// DEV_SHOW_OTP=true. A fresh super admin is seeded for every run (see global-setup.ts).
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 5 * 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    actionTimeout: 15_000,
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1360, height: 900 },
    permissions: ["camera"],
    launchOptions: {
      executablePath: process.env.E2E_CHROMIUM_PATH,
      // A synthetic camera feed lets the live-capture and liveness flows run headless.
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    },
  },
});
