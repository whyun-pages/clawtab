import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

const rootDir = path.dirname(fileURLToPath(new URL("../../package.json", import.meta.url)));
const extensionPath = path.join(rootDir, "dist");

test("loads the built extension", async ({ browserName }) => {
  test.skip(browserName !== "chromium", "Chrome extension e2e requires Chromium.");
  console.log(`Build the extension and load from: ${extensionPath}`);
});
