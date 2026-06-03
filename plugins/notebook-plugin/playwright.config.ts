import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: process.env.SIBYL_URL ?? "http://localhost:5174",
    headless: true,
  },
});
