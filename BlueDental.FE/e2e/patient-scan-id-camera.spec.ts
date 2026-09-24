import path from "node:path";
import { expect, test } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { cardQr, writeFakeCamera } from "./fixtures/cccdQr";
import {
  fitsWithoutScrolling,
  freshNationalId,
  OLD_ADDRESS,
  openScan,
  PATIENTS,
  preview,
  recordOf,
  saveWithPhone,
} from "./fixtures/scanId";

/**
 * Feature: "Quét CCCD" with the camera.
 *
 * Chromium's camera plays a card whose QR is small in the frame and mirrored —
 * the phone-as-webcam case. The camera opens with the dialog, nothing to press.
 * TH2: a new card is previewed and "Tạo hồ sơ" opens filled from it. TH1: the
 * same card again narrows the list to its record and the dialog closes by
 * itself. The app's own decoder reads the pixels; login, API and PostgreSQL are
 * real; nothing is intercepted.
 */

const CAMERA_FILE = path.resolve("test-results/fake-cccd-camera.y4m");
const CAMERA_ID = runId();
const CAMERA_CCCD = freshNationalId(CAMERA_ID, "31");
const CAMERA_NAME = `HUỲNH NGỌC CAMERA ${CAMERA_ID}`;

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
  await writeFakeCamera(CAMERA_FILE, cardQr(CAMERA_CCCD, CAMERA_NAME, OLD_ADDRESS), {
    mirror: true,
  });
});

test("the camera opens by itself, reads a mirrored card QR, and a second scan finds the record", async ({
  page,
}) => {
  await login(page);
  await page.goto("/patient");
  await assertRealApiTraffic(page, PATIENTS);

  // TH2 — nobody holds the number yet. No button is pressed: opening the
  // dialog is enough for the camera to start reading.
  let dialog = await openScan(page);
  expect(await fitsWithoutScrolling(dialog)).toBe(true);
  await expect(dialog.getByRole("textbox")).toHaveCount(0);

  // The picture is shown as the camera gives it — never flipped by the app.
  await expect(dialog.locator("video")).toHaveCSS("transform", "none");

  const card = preview(dialog);
  await expect(card.getByText(CAMERA_CCCD)).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText(CAMERA_NAME)).toBeVisible();
  await expect(card.getByText("Nơi thường trú (địa chỉ cũ)")).toBeVisible();
  await expect(card.getByText("Xã Vạn Tường, Tỉnh Quảng Ngãi")).toBeVisible();
  await expect(card.getByText("Chưa có hồ sơ — sẽ tạo mới")).toBeVisible();

  // The frame it was read from stays on screen, without a box drawn on it.
  await expect(dialog.locator(".bd-idscan-frozen")).toBeVisible();
  await expect(dialog.locator(".bd-idscan-box")).toHaveCount(0);
  expect(await fitsWithoutScrolling(dialog)).toBe(true);

  await dialog.getByRole("button", { name: "Tạo hồ sơ" }).click();
  const form = page.getByRole("dialog", { name: "Tạo hồ sơ" });
  await expect(form.getByRole("textbox", { name: "Họ và tên *" })).toHaveValue(CAMERA_NAME);
  await expect(form.getByRole("textbox", { name: "CCCD" })).toHaveValue(CAMERA_CCCD);
  await expect(form.getByRole("textbox", { name: "Số nhà/ Đường" })).toHaveValue("Thôn Đông");
  await expect(form.getByRole("textbox", { name: "Địa chỉ cũ" })).toHaveValue(OLD_ADDRESS);
  await expect(form.getByText("Tỉnh Quảng Ngãi")).toBeVisible();
  await expect(form.getByText("Xã Vạn Tường")).toBeVisible();
  await saveWithPhone(page, `07${CAMERA_ID}0031`.slice(0, 10));

  expect(await recordOf(page, CAMERA_CCCD)).toMatchObject({
    nationalId: CAMERA_CCCD,
    dateOfBirth: "1990-03-15",
    gender: 1,
    address: "Thôn Đông",
    provinceCode: "51",
    wardCode: "21061",
    oldAddress: OLD_ADDRESS,
  });

  // TH1 — the same card in front of the camera again, after a reload: the
  // list narrows to it by itself, no preview and nothing to confirm.
  await page.reload();
  await assertRealApiTraffic(page, PATIENTS);
  dialog = await openScan(page);

  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect(
    page.getByText("CCCD này đã có hồ sơ — đã lọc danh sách theo số CCCD"),
  ).toBeVisible();
  await expect(page.locator(".bd-patient-toolbar input[type=search]")).toHaveValue(CAMERA_CCCD);
  await expect(page.getByRole("row", { name: new RegExp(CAMERA_NAME) })).toBeVisible();
});
