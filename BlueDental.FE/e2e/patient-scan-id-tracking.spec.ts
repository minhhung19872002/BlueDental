import path from "node:path";
import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { cardQr, writeFakeCamera, type FakeQrPlacement } from "./fixtures/cccdQr";

/**
 * Feature: "Quét CCCD" — the box the camera draws round a QR it has found.
 *
 * Chromium's camera plays a card whose QR is mirrored and can be found but
 * never read (its data is spoiled, its finder patterns are not), so the box
 * stays on it. Its drawn corners are then measured against where the code
 * really is on screen: it has to hug the code, not float near it.
 */

const CAMERA_FILE = path.resolve("test-results/fake-cccd-unreadable.y4m");
let placement: FakeQrPlacement;

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
  placement = await writeFakeCamera(
    CAMERA_FILE,
    cardQr(
      `8${runId()}990`.slice(0, 12),
      "TRACKING",
      "Thôn Đông, Bình Thuận, Bình Sơn, Quảng Ngãi",
    ),
    { mirror: true, unreadable: true },
  );
});

test("the box hugs the QR the camera has found", async ({ page }) => {
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  await page.locator(".bd-patient-toolbar").getByRole("button", { name: "Quét CCCD" }).click();
  // The camera opens with the dialog.
  const dialog = page.getByRole("dialog", { name: "Quét CCCD" });

  const edge = dialog.locator(".bd-idscan-box-edge");
  await expect(edge).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText("Đã thấy mã QR — giữ yên thẻ để đọc…")).toBeVisible();
  // Let the easing come to rest on the detected corners.
  await page.waitForTimeout(800);

  const video = await dialog.locator("video").boundingBox();
  const box = await edge.boundingBox();
  if (!video || !box) throw new Error("nothing to measure");

  // Where the code is on screen: the frame is fitted with object-fit: contain.
  const scale = Math.min(video.width / placement.frameWidth, video.height / placement.frameHeight);
  const left = video.x + (video.width - placement.frameWidth * scale) / 2 + placement.x * scale;
  const top = video.y + (video.height - placement.frameHeight * scale) / 2 + placement.y * scale;
  const size = placement.size * scale;

  // The brackets sit just outside the code — 5% larger, centred on it.
  const expected = { x: left - size * 0.025, y: top - size * 0.025, side: size * 1.05 };
  const tolerance = Math.max(4, size * 0.06);
  console.log({ expected, box, tolerance });

  expect(Math.abs(box.x - expected.x)).toBeLessThan(tolerance);
  expect(Math.abs(box.y - expected.y)).toBeLessThan(tolerance);
  expect(Math.abs(box.width - expected.side)).toBeLessThan(tolerance);
  expect(Math.abs(box.height - expected.side)).toBeLessThan(tolerance);

  // A code in view that will not read gets the desk advice to back off.
  await expect(dialog.getByText(/Hình đang mờ — đưa thẻ ra xa camera/)).toBeVisible({
    timeout: 6_000,
  });

  // The code here can never be read, so the camera stays on until stopped —
  // and comes back when asked.
  await dialog.getByRole("button", { name: "Dừng camera" }).click();
  await expect(edge).toHaveCount(0);
  await expect(dialog.getByText("Hướng camera vào mã QR góc trên bên phải CCCD")).toBeVisible();
  await dialog.getByRole("button", { name: "Mở camera quét" }).click();
  await expect(edge).toBeVisible({ timeout: 20_000 });
});
