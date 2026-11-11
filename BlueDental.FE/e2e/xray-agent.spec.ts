import { expect, request, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { BRANCH2_USER, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * F-95 · máy X-quang (Vatech EzDent-i) gửi phim về hồ sơ.
 *
 * Cài đặt → Máy X-quang pairs a PC and prints its token once. The station API
 * is then called exactly as BlueDental.XrayAgent calls it: a cookie-less
 * client with only the `X-Xray-Device-Token` header, multipart upload. A film
 * whose name carries the record's code lands in "Trước điều trị" with the
 * X-quang chip; any other waits in "Ảnh chưa gán hồ sơ" until staff assign it
 * — by name and birth year it is only ever suggested, never put on a record.
 *
 * Real stack only: real login, real ASP.NET Core API, ClamAV, MinIO and
 * PostgreSQL; every claim is checked again after a reload or by a separate
 * request. The tests share one run (one PC, one patient), so they run in order.
 */

test.describe.configure({ mode: "serial" });

const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const STATION_API = "/api/v1/public/xray-station";
const INBOX_API = "/api/v1/app/xray-inbox";
const TOKEN_HEADER = "X-Xray-Device-Token";
const DEVICE_NOT_PAIRED = "BlueDental:Imaging:0002";
const PATIENT_UNAVAILABLE = "BlueDental:Imaging:0009";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";

const id = runId();
const DEVICE_NAME = `X-quang e2e ${id}`;
const FIRST_NAME = `Xquang ${id}`;
const LAST_NAME = "E2E";
const BIRTH_YEAR = 1990;

let token = "";
let patient = { id: "", code: "" };

interface ReceiveResult {
  inboxItemId: string;
  status: number | string;
  duplicate: boolean;
}

interface InboxList {
  items: { id: string; fileName: string; clinicBranchId: string }[];
  totalCount: number;
}

/** A small real JPEG painted in the browser; each colour gives other bytes, so the server's dedupe keeps them apart. */
async function jpeg(page: Page, colour: string): Promise<Buffer> {
  const base64 = await page.evaluate((fill) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("no 2d context");
    context.fillStyle = fill;
    context.fillRect(0, 0, 64, 48);
    context.fillStyle = "#ffffff";
    context.fillRect(16, 12, 32, 24);
    return canvas.toDataURL("image/jpeg", 0.9).split(",")[1] ?? "";
  }, colour);
  return Buffer.from(base64, "base64");
}

/** The agent's view of the server: no cookie, no login — only the device token. */
async function station(baseURL: string | undefined): Promise<APIRequestContext> {
  return request.newContext({ baseURL, extraHTTPHeaders: { [TOKEN_HEADER]: token } });
}

async function sendFilm(
  agent: APIRequestContext,
  file: { name: string; buffer: Buffer },
  hints: { code?: string; name?: string; birthYear?: number },
) {
  const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = {
    file: { name: file.name, mimeType: "image/jpeg", buffer: file.buffer },
  };
  if (hints.code) multipart.code = hints.code;
  if (hints.name) multipart.name = hints.name;
  if (hints.birthYear) multipart.birthYear = String(hints.birthYear);
  return agent.post(`${STATION_API}/images`, { multipart });
}

async function received(res: Awaited<ReturnType<typeof sendFilm>>): Promise<ReceiveResult> {
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as ReceiveResult;
}

function beforeColumn(page: Page): Locator {
  return page.locator('[data-testid="patient-image-stage"][data-stage="before"]');
}

async function openImageTab(page: Page): Promise<void> {
  await page.goto(`/patient/${patient.id}?tab=image`);
  await expect(beforeColumn(page)).toBeVisible({ timeout: 20_000 });
}

async function pendingInbox(page: Page): Promise<InboxList> {
  const res = await call<InboxList>(page, `${INBOX_API}?clinicBranchId=${BRANCH_ONE}&maxResultCount=200`, {
    branchId: BRANCH_ONE,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

async function pendingCount(page: Page): Promise<number> {
  const res = await call<number>(page, `${INBOX_API}/count?clinicBranchId=${BRANCH_ONE}`, { branchId: BRANCH_ONE });
  expect(res.status).toBe(200);
  return res.body;
}

test("Cài đặt → Máy X-quang pairs a PC and shows its token only once", async ({ page }) => {
  await login(page);

  const created = await call<{ id: string; patientCode: string }>(page, "/api/v1/app/patients", {
    method: "POST",
    json: {
      firstName: FIRST_NAME,
      lastName: LAST_NAME,
      dateOfBirth: `${BIRTH_YEAR}-03-07`,
      gender: "male",
      phoneNumber: `07${id.padStart(8, "0").slice(-8)}`,
    },
    branchId: BRANCH_ONE,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  patient = { id: created.body.id, code: created.body.patientCode };
  expect(patient.code).toBeTruthy();

  await page.goto("/settings?tab=xray");
  await expect(page.locator(".profile-content-title")).toHaveText("Máy X-quang");
  await page.getByRole("textbox", { name: "Tên máy" }).fill(DEVICE_NAME);
  const paired = page.waitForResponse(
    (res) => res.url().includes("/api/v1/app/xray-devices") && res.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Thêm máy" }).click();
  expect((await paired).status()).toBe(200);

  token = await page.getByTestId("xray-device-token").inputValue();
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  await expect(page.getByRole("textbox", { name: "Địa chỉ máy chủ" })).not.toHaveValue("");
  const row = page.locator("tr.ant-table-row", { hasText: DEVICE_NAME });
  await expect(row).toContainText("Đang hoạt động");

  // Shown once: after a reload the PC is listed, its token is gone for good.
  await page.reload();
  await expect(page.locator("tr.ant-table-row", { hasText: DEVICE_NAME })).toContainText("Đang hoạt động");
  await expect(page.getByTestId("xray-device-token")).toHaveCount(0);
});

test("a film named by the record's code lands in Trước điều trị with the X-quang chip", async ({ page, baseURL }) => {
  await login(page);
  const agent = await station(baseURL);
  try {
    const ping = await agent.get(STATION_API);
    expect(ping.status(), await ping.text()).toBe(200);
    expect(await ping.json()).toMatchObject({ deviceName: DEVICE_NAME });

    const film = { name: `${patient.code}_pano_${id}.jpg`, buffer: await jpeg(page, "#2671d8") };
    const first = await received(await sendFilm(agent, film, { code: patient.code }));
    expect([2, "AutoAssigned"]).toContain(first.status);
    expect(first.duplicate).toBe(false);

    // The agent may send the same file again after a lost answer: nothing is added.
    const again = await received(await sendFilm(agent, film, { code: patient.code }));
    expect(again.duplicate).toBe(true);
    expect(again.inboxItemId).toBe(first.inboxItemId);
  } finally {
    await agent.dispose();
  }

  await openImageTab(page);
  const cards = beforeColumn(page).getByTestId("patient-image-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("X-quang");
  // The branch has a PC paired, so the record offers to open it in EzDent-i.
  await expect(page.getByRole("button", { name: "Mở EzDent-i" })).toBeVisible();

  await page.reload();
  await expect(beforeColumn(page).getByTestId("patient-image-card")).toHaveCount(1);
  await expect(beforeColumn(page).getByTestId("patient-image-card").first()).toContainText("X-quang");
});

test("a code of another branch's record is never put on it: the film waits in the inbox", async ({ page, baseURL }) => {
  await login(page);
  const other = await call<{ id: string; patientCode: string }>(page, "/api/v1/app/patients", {
    method: "POST",
    json: {
      firstName: `Xquang CN2 ${id}`,
      lastName: LAST_NAME,
      dateOfBirth: `${BIRTH_YEAR}-03-07`,
      gender: "female",
      phoneNumber: `06${id.padStart(8, "0").slice(-8)}`,
    },
    branchId: BRANCH_TWO,
  });
  expect(other.status, JSON.stringify(other.body)).toBe(200);

  const agent = await station(baseURL);
  let itemId: string;
  try {
    const film = { name: `${other.body.patientCode}_ceph_${id}.jpg`, buffer: await jpeg(page, "#7a2bd8") };
    const result = await received(await sendFilm(agent, film, { code: other.body.patientCode }));
    expect([1, "Pending"]).toContain(result.status);
    itemId = result.inboxItemId;

    // The bridge does not hand this PC another branch's record either.
    const lookup = await agent.get(`${STATION_API}/patients/by-code?code=${encodeURIComponent(other.body.patientCode)}`);
    expect(lookup.status()).not.toBe(200);
    expect(await lookup.text()).toContain(PATIENT_UNAVAILABLE);
  } finally {
    await agent.dispose();
  }

  // Separate requests: the film sits in branch 1's inbox, the branch-2 record has no picture.
  expect((await pendingInbox(page)).items.map((item) => item.id)).toContain(itemId);
  const images = await call<{ totalCount: number }>(
    page,
    `/api/v1/app/patient-images?patientId=${other.body.id}&clinicBranchId=${BRANCH_TWO}&maxResultCount=50`,
    { branchId: BRANCH_TWO },
  );
  expect(images.status, JSON.stringify(images.body)).toBe(200);
  expect(images.body.totalCount).toBe(0);

  const discarded = await call(page, `${INBOX_API}/${itemId}/discard`, { method: "POST", branchId: BRANCH_ONE });
  expect(discarded.status).toBe(204);
});

test("a film without a code waits in Ảnh chưa gán hồ sơ, is suggested by name + year and assigned by staff", async ({
  page,
  baseURL,
}) => {
  await login(page);
  const fileName = `scan_${id}.jpg`;
  const skipName = `scan_bo_${id}.jpg`;
  const agent = await station(baseURL);
  let pendingId: string;
  try {
    const waiting = await received(
      await sendFilm(agent, { name: fileName, buffer: await jpeg(page, "#16a34a") }, {
        name: `${LAST_NAME} ${FIRST_NAME}`,
        birthYear: BIRTH_YEAR,
      }),
    );
    // Name and birth year match exactly one record, and still it is not put there.
    expect([1, "Pending"]).toContain(waiting.status);
    pendingId = waiting.inboxItemId;

    const skipped = await received(
      await sendFilm(agent, { name: skipName, buffer: await jpeg(page, "#dc2626") }, {}),
    );
    expect([1, "Pending"]).toContain(skipped.status);
  } finally {
    await agent.dispose();
  }

  const before = await pendingCount(page);
  expect((await pendingInbox(page)).items.map((item) => item.id)).toContain(pendingId);

  await page.goto("/xray-inbox");
  const card = page.getByRole("article", { name: fileName });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(`${LAST_NAME} ${FIRST_NAME}`);
  await expect(card).toContainText(String(BIRTH_YEAR));

  await card.getByRole("button", { name: "Gán hồ sơ" }).click();
  const dialog = page.getByRole("dialog", { name: "Gán ảnh vào hồ sơ" });
  await expect(dialog).toBeVisible();
  const suggestion = dialog.getByRole("radio").filter({ hasText: FIRST_NAME });
  await expect(suggestion).toHaveCount(1);
  await expect(suggestion).toContainText("Trùng tên và năm sinh");
  await suggestion.click();
  await expect(suggestion).toHaveAttribute("aria-checked", "true");
  const assigned = page.waitForResponse(
    (res) => res.url().includes(`${INBOX_API}/${pendingId}/assign`) && res.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: /Gán$/ }).click();
  expect((await assigned).status()).toBe(200);
  await expect(page.getByText("Đã gán ảnh vào hồ sơ")).toBeVisible();
  await expect(card).toHaveCount(0);

  // Bỏ qua: the other film leaves the list and goes on no record.
  const skipCard = page.getByRole("article", { name: skipName });
  await skipCard.getByRole("button", { name: "Bỏ qua" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Bỏ qua" }).click();
  await expect(page.getByText("Đã bỏ qua ảnh")).toBeVisible();
  await expect(skipCard).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("article", { name: fileName })).toHaveCount(0);
  await expect(page.getByRole("article", { name: skipName })).toHaveCount(0);
  expect(await pendingCount(page)).toBe(before - 2);

  // The assigned film sits beside the first one, chip and all.
  await openImageTab(page);
  const cards = beforeColumn(page).getByTestId("patient-image-card");
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: "X-quang" })).toHaveCount(2);
});

test("a branch-2 account sees nothing of branch 1's waiting films", async ({ page, baseURL, browser }) => {
  await login(page);
  const fileName = `scan_cn1_${id}.jpg`;
  const agent = await station(baseURL);
  let pendingId: string;
  try {
    pendingId = (await received(await sendFilm(agent, { name: fileName, buffer: await jpeg(page, "#7c3aed") }, {})))
      .inboxItemId;
  } finally {
    await agent.dispose();
  }

  const other = await browser.newContext();
  const branch2 = await other.newPage();
  try {
    await login(branch2, BRANCH2_USER);

    const list = await call<InboxList>(branch2, `${INBOX_API}?maxResultCount=200`);
    expect(list.status).toBe(200);
    expect(list.body.items.map((item) => item.id)).not.toContain(pendingId);
    expect(list.body.items.every((item) => item.clinicBranchId !== BRANCH_ONE)).toBe(true);

    const suggestions = await call(branch2, `${INBOX_API}/${pendingId}/suggestions`);
    expect(suggestions.status).not.toBe(200);
    const assign = await call(branch2, `${INBOX_API}/${pendingId}/assign`, {
      method: "POST",
      json: { patientId: patient.id },
    });
    expect(assign.status).not.toBe(200);

    await branch2.goto("/xray-inbox");
    await expect(branch2.locator(".xi-intro")).toBeVisible({ timeout: 20_000 });
    await expect(branch2.getByRole("article", { name: fileName })).toHaveCount(0);
  } finally {
    await other.close();
  }

  // Still waiting in branch 1, untouched; set aside so the run leaves nothing behind.
  expect((await pendingInbox(page)).items.map((item) => item.id)).toContain(pendingId);
  const discard = await call(page, `${INBOX_API}/${pendingId}/discard`, { method: "POST", branchId: BRANCH_ONE });
  expect(discard.status).toBe(204);
});

test("Thu hồi cuts the PC off: its token is refused from then on", async ({ page, baseURL }) => {
  await login(page);
  await page.goto("/settings?tab=xray");
  const row = page.locator("tr.ant-table-row", { hasText: DEVICE_NAME });
  await row.getByRole("button", { name: "Thu hồi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Thu hồi" }).click();
  await expect(page.getByText("Đã thu hồi kết nối máy X-quang")).toBeVisible();

  await page.reload();
  await expect(page.locator("tr.ant-table-row", { hasText: DEVICE_NAME })).toContainText("Đã thu hồi");

  const agent = await station(baseURL);
  try {
    const ping = await agent.get(STATION_API);
    expect(ping.status()).not.toBe(200);
    expect(await ping.text()).toContain(DEVICE_NOT_PAIRED);

    const res = await sendFilm(agent, { name: `${patient.code}_late_${id}.jpg`, buffer: await jpeg(page, "#f59e0b") }, {
      code: patient.code,
    });
    expect(res.status()).not.toBe(200);
    expect(await res.text()).toContain(DEVICE_NOT_PAIRED);
  } finally {
    await agent.dispose();
  }

  // Nothing new reached the record.
  await openImageTab(page);
  await expect(beforeColumn(page).getByTestId("patient-image-card")).toHaveCount(2);
});
