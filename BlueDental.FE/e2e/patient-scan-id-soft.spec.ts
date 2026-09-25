import path from "node:path";
import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { cardQr, writeFakeCamera } from "./fixtures/cccdQr";
import { freshNationalId, OLD_ADDRESS, openScan, PATIENTS, preview } from "./fixtures/scanId";

/**
 * Feature: "Quét CCCD" — a slightly soft webcam picture.
 *
 * Chromium's camera plays a card defocused by 0.55 of a module — what a
 * laptop webcam gives for a card held a little too close for its fixed focus.
 * At that blur ZXing finds the code but cannot read it as is; the dialog has
 * to sharpen the zoomed code and read it anyway.
 */

const CAMERA_FILE = path.resolve("test-results/fake-cccd-soft.y4m");
const ID = runId();
const CCCD = freshNationalId(ID, "61");
const NAME = `LÊ THỊ MỜ ${ID}`;

test.use({
  permissions: ["camera"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${CAMERA_FILE}`,
    ],
  },
});

test.beforeAll(async () => {
  await writeFakeCamera(CAMERA_FILE, cardQr(CCCD, NAME, OLD_ADDRESS), {
    mirror: true,
    blurModules: 0.55,
  });
});

test("a slightly soft card is still read", async ({ page }) => {
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, PATIENTS);

  const dialog = await openScan(page);
  const card = preview(dialog);
  await expect(card.getByText(CCCD)).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText(NAME)).toBeVisible();
});
