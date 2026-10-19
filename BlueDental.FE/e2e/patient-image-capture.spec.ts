import { expect, test, type Browser, type Locator, type Page, type Response } from "@playwright/test";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * "Chụp ảnh" on tab "Hình ảnh" (BA request, not in the reference): a button
 * beside "Tải ảnh" opens the camera on the page, any number of shots up to ten
 * are taken and can be taken back, and "Tải lên" sends them the way "Tải ảnh"
 * sends picked files. See docs/clone/pages/patient-detail.md, Tab 5.
 *
 * Chromium's fake camera stands in for the webcam; login, API, MinIO and
 * PostgreSQL are real and nothing is intercepted. The page's own
 * getUserMedia is only watched (to see the camera switched off), never
 * answered for. Every picture uploaded here is deleted again.
 */

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const IMAGES_API = "/api/v1/app/patient-images";
const PASSWORD = "ChupAnh@123456";
const TYPE = { before: 1, after: 2 } as const;

interface UploadedImage {
  id: string;
  fileName: string;
  contentType: string;
  type: number;
}

declare global {
  interface Window {
    cameraStreams?: MediaStream[];
  }
}

test.use({
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

async function openImageTab(page: Page): Promise<void> {
  await page.goto("/patient");
  await assertRealApiTraffic(page, "/api/v1/app/patients");

  await page.locator("tr.ant-table-row .bd-patient-name").first().click();
  await expect(page).toHaveURL(/\/patient\/[0-9a-f-]{36}/);

  await page.getByRole("link", { name: "Hình ảnh" }).click();
  await expect(page).toHaveURL(/tab=image/);
  await assertRealApiTraffic(page, IMAGES_API);
}

async function chooseStage(page: Page, stage: "Trước điều trị" | "Sau điều trị"): Promise<void> {
  await page.getByRole("combobox", { name: "Giai đoạn điều trị" }).click();
  await page.locator(".ant-select-dropdown .ant-select-item-option", { hasText: stage }).click();
  await assertRealApiTraffic(page, "type=");
}

/** Opens "Chụp ảnh" and waits until the camera's picture is on screen. */
async function openCamera(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Chụp ảnh" }).click();
  const dialog = page.getByRole("dialog", { name: "Chụp ảnh" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Chụp", exact: true })).toBeEnabled({ timeout: 20_000 });
  return dialog;
}

async function snap(dialog: Locator, times: number): Promise<void> {
  const shots = dialog.getByTestId("captured-shot");
  const before = await shots.count();
  for (let i = 1; i <= times; i += 1) {
    await dialog.getByRole("button", { name: "Chụp", exact: true }).click();
    await expect(shots).toHaveCount(before + i);
  }
}

/** "Tải lên (n)", answered by the server with the pictures it stored. */
async function uploadShots(page: Page, dialog: Locator, count: number): Promise<UploadedImage[]> {
  const stored: UploadedImage[] = [];
  const onResponse = async (res: Response) => {
    if (res.url().includes(IMAGES_API) && res.request().method() === "POST" && res.ok()) {
      stored.push((await res.json()) as UploadedImage);
    }
  };
  page.on("response", onResponse);
  await dialog.getByRole("button", { name: `Tải lên (${count})` }).click();
  await expect(dialog).toBeHidden({ timeout: 20_000 });
  await expect.poll(() => stored.length).toBe(count);
  page.off("response", onResponse);
  return stored;
}

function card(page: Page, fileName: string): Locator {
  return page.getByTestId("patient-image-card").filter({ hasText: fileName });
}

async function removeImages(page: Page, images: UploadedImage[]): Promise<void> {
  for (const image of images) {
    const res = await call(page, `${IMAGES_API}/${image.id}`, { method: "DELETE", branchId: BRANCH_ONE });
    expect(res.status).toBeLessThan(300);
  }
}

/** Remembers each stream the page opens, so the test can see it switched off. */
async function watchCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const devices = navigator.mediaDevices;
    if (!devices) return;
    const open = devices.getUserMedia.bind(devices);
    window.cameraStreams = [];
    devices.getUserMedia = async (constraints) => {
      const stream = await open(constraints);
      window.cameraStreams?.push(stream);
      return stream;
    };
  });
}

async function cameraOff(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const tracks = (window.cameraStreams ?? []).flatMap((stream) => stream.getTracks());
    return tracks.length > 0 && tracks.every((track) => track.readyState === "ended");
  });
}

/** A role that may read patients and their pictures but not add any. */
async function readOnlyStaff(page: Page): Promise<{ roleId: string; staffId: string; userName: string }> {
  const id = runId();
  const roleName = `Xem ảnh ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const grants = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: {
      permissions: ["BlueDental.patient.read", "BlueDental.treatmentImage.read"].map((name) => ({ name, isGranted: true })),
    },
  });
  expect(grants.status).toBe(204);

  const userName = `xemanh${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên xem ảnh ${id}`,
      email: `${userName}@bluedental.local`,
      roleNames: [roleName],
      branchIds: [BRANCH_ONE],
      isActive: true,
    },
  });
  expect(staff.status).toBe(200);
  return { roleId: role.body.id, staffId: staff.body.id, userName };
}

async function openSession(browser: Browser, userName: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, { userName, password: PASSWORD });
  return { context, page };
}

test.describe("Chụp ảnh bệnh nhân", () => {
  test.describe.configure({ timeout: 120_000 });

  test("two shots, one taken back, the other uploaded under Trước điều trị and still there after a reload", async ({ page }) => {
    await login(page);
    await openImageTab(page);

    const posts: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes(IMAGES_API) && req.method() === "POST") posts.push(req.url());
    });

    const dialog = await openCamera(page);
    await expect(dialog).toContainText("Ảnh được lưu vào giai đoạn: Trước điều trị");
    // The picture is shown as the camera gives it — never flipped.
    await expect(dialog.locator("video")).toHaveCSS("transform", "none");
    await expect(dialog.getByText("Chưa có ảnh nào")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /Tải lên/ })).toBeDisabled();

    await snap(dialog, 2);
    await expect(dialog.getByText("Đã chụp 2/10 ảnh")).toBeVisible();
    const thumb = dialog.getByRole("img", { name: "Ảnh chụp 1" });
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

    await dialog.getByRole("button", { name: "Bỏ ảnh chụp 1" }).click();
    await expect(dialog.getByTestId("captured-shot")).toHaveCount(1);
    await expect(dialog.getByText("Đã chụp 1/10 ảnh")).toBeVisible();

    const [image] = await uploadShots(page, dialog, 1);
    try {
      expect(posts).toHaveLength(1);
      // The second shot went up, as a JPEG, filed under "before".
      expect(image.fileName).toMatch(/^chup-anh-\d{8}-\d{6}-2\.jpg$/);
      expect(image.contentType).toBe("image/jpeg");
      expect(image.type).toBe(TYPE.before);
      await expect(page.getByText("Đã tải lên 1 ảnh")).toBeVisible();

      await expect(card(page, image.fileName)).toBeVisible({ timeout: 15_000 });
      const img = card(page, image.fileName).locator("img");
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

      // It is the database talking: reload, and the filters agree on its stage.
      await page.reload();
      await expect(card(page, image.fileName)).toBeVisible({ timeout: 15_000 });
      await chooseStage(page, "Sau điều trị");
      await expect(card(page, image.fileName)).toBeHidden();
      await chooseStage(page, "Trước điều trị");
      await expect(card(page, image.fileName)).toBeVisible();
    } finally {
      await removeImages(page, [image]);
    }
  });

  test("with the filter on Sau điều trị, the shots are filed under it", async ({ page }) => {
    await login(page);
    await openImageTab(page);
    await chooseStage(page, "Sau điều trị");

    const dialog = await openCamera(page);
    await expect(dialog).toContainText("Ảnh được lưu vào giai đoạn: Sau điều trị");
    await snap(dialog, 2);

    const images = await uploadShots(page, dialog, 2);
    try {
      expect(images.map((image) => image.type)).toEqual([TYPE.after, TYPE.after]);
      await expect(page.getByText("Đã tải lên 2 ảnh")).toBeVisible();
      for (const image of images) await expect(card(page, image.fileName)).toBeVisible({ timeout: 15_000 });

      await page.reload();
      await chooseStage(page, "Trước điều trị");
      for (const image of images) await expect(card(page, image.fileName)).toBeHidden();
      await chooseStage(page, "Sau điều trị");
      for (const image of images) await expect(card(page, image.fileName)).toBeVisible();
    } finally {
      await removeImages(page, images);
    }
  });

  test("ten shots fill one upload; Hủy throws them away and switches the camera off", async ({ page }) => {
    await watchCamera(page);
    await login(page);
    await openImageTab(page);

    const posts: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes(IMAGES_API) && req.method() === "POST") posts.push(req.url());
    });

    const dialog = await openCamera(page);
    expect(await cameraOff(page)).toBe(false);
    await snap(dialog, 10);
    await expect(dialog.getByText("Đã đủ 10 ảnh cho một lần tải lên")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Chụp", exact: true })).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Tải lên (10)" })).toBeEnabled();

    // Taking one back makes room again.
    await dialog.getByRole("button", { name: "Bỏ ảnh chụp 10" }).click();
    await expect(dialog.getByRole("button", { name: "Chụp", exact: true })).toBeEnabled();

    await dialog.getByRole("button", { name: "Hủy" }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => cameraOff(page)).toBe(true);
    expect(posts).toHaveLength(0);

    // A new session starts empty.
    const again = await openCamera(page);
    await expect(again.getByTestId("captured-shot")).toHaveCount(0);
    await again.getByRole("button", { name: "Hủy" }).click();
    await expect(again).toBeHidden();
  });

  test("with no camera on the machine the button stays, greyed out, and says why", async ({ page }) => {
    await page.addInitScript(() => {
      if (navigator.mediaDevices) navigator.mediaDevices.enumerateDevices = async () => [];
    });
    await login(page);
    await openImageTab(page);

    const button = page.getByRole("button", { name: "Chụp ảnh" });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(page.getByRole("button", { name: "Tải ảnh" })).toBeEnabled();

    await page.locator(".pi-capture-slot").hover();
    await expect(page.getByRole("tooltip")).toHaveText("Không tìm thấy camera trên thiết bị này");
    await expect(page.getByRole("dialog", { name: "Chụp ảnh" })).toHaveCount(0);
  });

  test("an account that may not add pictures gets neither Tải ảnh nor Chụp ảnh", async ({ page, browser }) => {
    await login(page);
    const staff = await readOnlyStaff(page);
    const reader = await openSession(browser, staff.userName);
    try {
      await openImageTab(reader.page);
      await expect(reader.page.getByTestId("patient-image-tab")).toBeVisible();
      await expect(reader.page.getByRole("button", { name: "Tải ảnh" })).toHaveCount(0);
      await expect(reader.page.getByRole("button", { name: "Chụp ảnh" })).toHaveCount(0);

      // The server refuses the upload as well; hiding the button is not the guard.
      const refused = await reader.page.evaluate(async ([api, branch]) => {
        const form = new FormData();
        form.append("file", new File([new Uint8Array([1, 2, 3])], "x.jpg", { type: "image/jpeg" }));
        form.append("patientId", location.pathname.split("/")[2] ?? "");
        form.append("clinicBranchId", branch);
        const xsrf = document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.substring("XSRF-TOKEN=".length);
        const res = await fetch(api, {
          method: "POST",
          credentials: "include",
          headers: {
            accept: "application/json",
            "X-Clinic-Branch-Id": branch,
            ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
          },
          body: form,
        });
        return res.status;
      }, [IMAGES_API, BRANCH_ONE] as const);
      expect(refused).toBe(403);
    } finally {
      await reader.context.close();
      await call(page, `/api/v1/app/staff/${staff.staffId}`, { method: "DELETE" });
      await call(page, `/api/identity/roles/${staff.roleId}`, { method: "DELETE" });
    }
  });
});
