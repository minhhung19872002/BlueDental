import { expect, test, type Browser, type Page } from "@playwright/test";
import { pickOption } from "./fixtures/antd";
import { BRANCH2_USER, assertRealApiTraffic, login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";

/**
 * Feature: CSKH ▸ Template tin nhắn (F-76, BA P2110 img_07/img_08). The list
 * tab, the full-page editor (Lưu nháp / Lưu mẫu, `{` suggestions, Biến hay
 * dùng, Thư viện biến, the leave guard), Nhân bản, branch scope and the
 * cskhTemplate read / create / update grants.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. Each
 * run names its templates with a run id. There is no delete endpoint, so they
 * stay behind, harmlessly.
 *
 * The Zalo cases need a host whose Zalo endpoints point at the local stub
 * (e2e/fixtures/zalo-stub.mjs, started with the host's Zalo:OaId) — never
 * the real OA. When BD-001 has no live connection they link it to the stub
 * through the real connect flow, so they belong on a local database only.
 * They run only with E2E_ZALO_STUB=1; set E2E_ZALO_STUB_URL when the stub is
 * not on http://127.0.0.1:5199.
 */

const TEMPLATES = "/api/v1/app/message-templates";
const ZALO = "/api/v1/app/zalo";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const LIST = "/cskh-grouping?tab=template";
const PASSWORD = "MauTin@123456";
const STUB_URL = process.env.E2E_ZALO_STUB_URL ?? "http://127.0.0.1:5199";
const STATUS = { Draft: 0, Ready: 1, PendingApproval: 2 } as const;
const CHANNEL = { Sms: 0 } as const;
const CARE_APPOINTMENT_REMINDER = 3;
const asBranchOne = { branchId: BRANCH_ONE };

interface Template {
  id: string;
  name: string;
  content: string;
  purpose: number | null;
  status: number;
  externalTemplateId: string | null;
  paramMap: Record<string, string>;
}

const toast = (page: Page, text: string | RegExp) => page.locator("[data-sonner-toast]", { hasText: text });
const contentBox = (page: Page) => page.locator("#tpe-content");
const templateRow = (page: Page, name: string) => page.locator("tr.tpl-row", { hasText: name });
const previewCard = (page: Page, name: string) => page.locator(`aside.tpl-preview-card[aria-label="${name}"]`);

async function searchList(page: Page, text: string) {
  const listed = page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === TEMPLATES && url.searchParams.get("filter") === text;
  });
  await page.getByLabel("Tìm theo tên mẫu hoặc nội dung").fill(text);
  await listed;
}

async function createViaApi(page: Page, name: string, branchId = BRANCH_ONE): Promise<Template> {
  const res = await call<Template>(page, TEMPLATES, {
    method: "POST",
    branchId,
    json: {
      publish: false,
      channel: CHANNEL.Sms,
      name,
      purpose: CARE_APPOINTMENT_REMINDER,
      content: "Chào {ten_khach_hang}, hẹn {ngay_hen}",
      subject: null,
      externalTemplateId: null,
      paramMap: null,
      removeDiacritics: false,
    },
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body;
}

async function listNames(page: Page, filter: string, branchId: string): Promise<string[]> {
  const res = await call<{ items: Template[] }>(page, `${TEMPLATES}?filter=${encodeURIComponent(filter)}`, { branchId });
  expect(res.status).toBe(200);
  return res.body.items.map((item) => item.name);
}

/** ZNS messages the stub has taken so far, from any spec. */
async function znsSendCount(): Promise<number> {
  const calls = (await (await fetch(`${STUB_URL}/__calls`)).json()) as { path: string }[];
  return calls.filter((c) => c.path === "/message/template").length;
}

/** A throw-away role holding just `grants`, and a staff member of BD-001 in it. */
async function makeStaff(page: Page, grants: string[]) {
  const id = runId();
  const roleName = `Mẫu tin ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const granted = await call(page, `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`, {
    method: "PUT",
    json: { permissions: grants.map((name) => ({ name, isGranted: true })) },
  });
  expect(granted.status).toBe(204);

  const userName = `mautin${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên mẫu tin ${id}`,
      email: `${userName}@bluedental.local`,
      roleNames: [roleName],
      branchIds: [BRANCH_ONE],
      isActive: true,
    },
  });
  expect(staff.status).toBe(200);

  const tearDown = async () => {
    await call(page, `/api/v1/app/staff/${staff.body.id}`, { method: "DELETE" });
    await call(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
  };
  return { userName, tearDown };
}

async function openSession(browser: Browser, credentials: { userName: string; password: string }) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, credentials);
  return { context, page };
}

test.describe("CSKH — Template tin nhắn", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("soạn mẫu SMS bằng gợi ý {, biến hay dùng và Thư viện biến; Lưu nháp rồi Lưu mẫu", async ({ page }) => {
    const name = `E2E SMS ${runId()}`;
    const traffic = assertRealApiTraffic(page, TEMPLATES);
    await page.goto(LIST);
    await traffic;

    await page.getByRole("button", { name: "Tạo mẫu mới" }).click();
    await expect(page).toHaveURL(/\/cskh-grouping\/templates\/new/);
    await expect(page.getByRole("radio", { name: /Mẫu SMS/ })).toHaveAttribute("aria-checked", "true");

    await page.locator("#tpe-name").fill(name);
    await contentBox(page).click();
    await page.keyboard.type("Chào ");
    await page.getByRole("button", { name: "+ Họ và tên" }).click();
    await page.keyboard.type(", hẹn {ng");
    const suggestions = page.getByRole("listbox", { name: "Thư viện biến" });
    await expect(suggestions.getByRole("option").filter({ hasText: "{ngay_hen}" })).toBeVisible();
    // A word has to start with what was typed: "ng" is not offered {ten_khach_hang}.
    await expect(suggestions.getByRole("option").filter({ hasText: "{ten_khach_hang}" })).toHaveCount(0);
    await page.keyboard.type("ay");
    await suggestions.getByRole("option").filter({ hasText: "{ngay_hen}" }).click();
    await page.keyboard.type(" với ");
    await page.getByRole("button", { name: "Chèn Bác sĩ điều trị" }).click();

    await expect(contentBox(page)).toHaveValue("Chào {ten_khach_hang}, hẹn {ngay_hen} với {bac_si}");
    await expect(page.getByText("Biến đang dùng trong mẫu (3)")).toBeVisible();

    await page.getByRole("button", { name: "Bỏ biến {bac_si} khỏi nội dung" }).click();
    await expect(contentBox(page)).not.toHaveValue(/\{bac_si\}/);
    await expect(page.getByText("Biến đang dùng trong mẫu (2)")).toBeVisible();
    // The server trims what it stores; the editor shows the stored text after a save.
    const content = (await contentBox(page).inputValue()).trim();

    await page.getByRole("button", { name: "Lưu nháp" }).click();
    await expect(toast(page, "Đã lưu nháp")).toBeVisible();
    await expect(page).toHaveURL(/\/cskh-grouping\/templates\/[0-9a-f-]{36}/);
    const id = /templates\/([0-9a-f-]{36})/.exec(page.url())![1];

    await page.reload();
    await expect(page.locator("#tpe-name")).toHaveValue(name);
    await expect(contentBox(page)).toHaveValue(content);

    // Lưu mẫu checks the template is complete: the purpose is still missing.
    await page.getByRole("button", { name: "Lưu mẫu" }).click();
    await expect(toast(page, "Vui lòng chọn mục đích của mẫu.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/templates/${id}`));

    await pickOption(page, page.locator("#tpe-purpose"), "Nhắc lịch hẹn");
    await page.getByRole("button", { name: "Lưu mẫu" }).click();
    await expect(toast(page, "Đã lưu mẫu")).toBeVisible();
    await expect(page).toHaveURL(/\/cskh-grouping\?tab=template/);

    await searchList(page, name);
    await expect(templateRow(page, name)).toContainText("Sẵn sàng");
    await page.reload();
    await searchList(page, name);
    await expect(templateRow(page, name)).toContainText("Sẵn sàng");

    const stored = await call<Template>(page, `${TEMPLATES}/${id}`, asBranchOne);
    expect(stored.status).toBe(200);
    expect(stored.body).toMatchObject({ name, content, status: STATUS.Ready, purpose: CARE_APPOINTMENT_REMINDER });
  });

  test("rời trang khi chưa lưu thì hỏi lại; Ở lại giữ nội dung, Bỏ thay đổi không tạo mẫu", async ({ page }) => {
    const name = `E2E Rời ${runId()}`;
    await page.goto("/cskh-grouping/templates/new");
    await page.locator("#tpe-name").fill(name);

    const back = page.getByRole("navigation", { name: "Mẫu tin nhắn" }).getByRole("link", { name: "Mẫu tin nhắn" });
    const dialog = page.getByRole("dialog", { name: "Thay đổi chưa được lưu" });
    await back.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Ở lại" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/templates\/new/);
    await expect(page.locator("#tpe-name")).toHaveValue(name);

    await back.click();
    await dialog.getByRole("button", { name: "Bỏ thay đổi" }).click();
    await expect(page).toHaveURL(/\/cskh-grouping\?tab=template/);
    expect(await listNames(page, name, BRANCH_ONE)).toEqual([]);
  });

  test("Nhân bản tạo bản nháp '- bản sao' và còn sau khi tải lại", async ({ page }) => {
    const name = `E2E Nhân bản ${runId()}`;
    await page.goto(LIST);
    await createViaApi(page, name);

    await searchList(page, name);
    await templateRow(page, name).first().click();
    await previewCard(page, name).getByRole("button", { name: "Nhân bản" }).click();
    await expect(toast(page, "Đã nhân bản mẫu thành bản nháp")).toBeVisible();

    const copy = `${name} - bản sao`;
    await expect(previewCard(page, copy)).toBeVisible();
    await expect(templateRow(page, copy)).toContainText("Nháp");

    await page.reload();
    await searchList(page, name);
    await expect(templateRow(page, copy)).toContainText("Nháp");
    expect((await listNames(page, name, BRANCH_ONE)).sort()).toEqual([name, copy].sort());
  });

  test("chi nhánh khác không thấy, không đọc được mẫu của BD-001", async ({ page, browser }) => {
    const name = `E2E Chi nhánh ${runId()}`;
    await page.goto(LIST);
    const template = await createViaApi(page, name);

    const other = await openSession(browser, BRANCH2_USER);
    try {
      await other.page.goto(LIST);
      await searchList(other.page, name);
      await expect(other.page.getByText("Chưa có mẫu tin nhắn nào")).toBeVisible();
      await expect(templateRow(other.page, name)).toHaveCount(0);

      expect((await call(other.page, `${TEMPLATES}/${template.id}`, { branchId: BRANCH_TWO })).status).toBe(404);
      expect((await call(other.page, `${TEMPLATES}/${template.id}`, asBranchOne)).status).toBe(403);
      expect(await listNames(other.page, name, BRANCH_TWO)).toEqual([]);
    } finally {
      await other.context.close();
    }
  });

  test("chi nhánh chưa kết nối Zalo OA: mẫu Zalo báo cần kết nối và khoá chọn mẫu ZNS", async ({ browser }) => {
    const other = await openSession(browser, BRANCH2_USER);
    try {
      await other.page.goto("/cskh-grouping/templates/new");
      await other.page.getByRole("radio", { name: /Mẫu Zalo/ }).click();
      await expect(other.page.getByRole("radio", { name: /Mẫu Zalo/ })).toHaveAttribute("aria-checked", "true");
      await expect(
        other.page.getByText("Chi nhánh chưa kết nối Zalo OA. Vào Công cụ ▸ Zalo OA để kết nối."),
      ).toBeVisible();
      await expect(other.page.locator("#tpe-zns")).toBeDisabled();
    } finally {
      await other.context.close();
    }
  });

  test("quyền: chỉ xem thì không tạo/sửa/nhân bản; có quyền tạo thì Lưu nháp về danh sách", async ({ page, browser }) => {
    const name = `E2E Quyền ${runId()}`;
    await page.goto(LIST);
    const template = await createViaApi(page, name);

    const reader = await makeStaff(page, ["BlueDental.cskhTemplate.read"]);
    const creator = await makeStaff(page, ["BlueDental.cskhTemplate.read", "BlueDental.cskhTemplate.create"]);
    try {
      const readOnly = await openSession(browser, { userName: reader.userName, password: PASSWORD });
      try {
        await readOnly.page.goto(LIST);
        await searchList(readOnly.page, name);
        await templateRow(readOnly.page, name).click();
        await expect(previewCard(readOnly.page, name)).toBeVisible();
        await expect(readOnly.page.getByRole("button", { name: "Tạo mẫu mới" })).toHaveCount(0);
        await expect(previewCard(readOnly.page, name).getByRole("button", { name: "Chỉnh sửa" })).toHaveCount(0);
        await expect(previewCard(readOnly.page, name).getByRole("button", { name: "Nhân bản" })).toHaveCount(0);

        const created = await call(readOnly.page, TEMPLATES, {
          method: "POST",
          ...asBranchOne,
          json: { publish: false, channel: CHANNEL.Sms, name: `${name} chen`, removeDiacritics: false },
        });
        expect(created.status).toBe(403);
        const updated = await call(readOnly.page, `${TEMPLATES}/${template.id}`, {
          method: "PUT",
          ...asBranchOne,
          json: { publish: false, name: `${name} sua`, removeDiacritics: false },
        });
        expect(updated.status).toBe(403);

        await readOnly.page.goto("/cskh-grouping/templates/new");
        await expect(readOnly.page.getByText("Không có quyền truy cập")).toBeVisible();
      } finally {
        await readOnly.context.close();
      }

      const maker = await openSession(browser, { userName: creator.userName, password: PASSWORD });
      try {
        const own = `${name} tạo`;
        await maker.page.goto(LIST);
        await maker.page.getByRole("button", { name: "Tạo mẫu mới" }).click();
        await maker.page.locator("#tpe-name").fill(own);
        await maker.page.getByRole("button", { name: "Lưu nháp" }).click();
        await expect(toast(maker.page, "Đã lưu nháp")).toBeVisible();
        // Without update the editor cannot reopen it, so the draft goes back to the list.
        await expect(maker.page).toHaveURL(/\/cskh-grouping\?tab=template/);

        await searchList(maker.page, own);
        await templateRow(maker.page, own).click();
        await expect(templateRow(maker.page, own)).toContainText("Nháp");
        await expect(previewCard(maker.page, own).getByRole("button", { name: "Chỉnh sửa" })).toHaveCount(0);

        const ownId = (await call<{ items: Template[] }>(maker.page, `${TEMPLATES}?filter=${encodeURIComponent(own)}`, asBranchOne))
          .body.items[0].id;
        await maker.page.goto(`/cskh-grouping/templates/${ownId}`);
        await expect(maker.page.getByText("Không có quyền truy cập")).toBeVisible();
      } finally {
        await maker.context.close();
      }
    } finally {
      await reader.tearDown();
      await creator.tearDown();
    }
  });

  test.describe("mẫu Zalo (Zalo giả lập)", () => {
    test.skip(!process.env.E2E_ZALO_STUB, "cần host trỏ Zalo về e2e/fixtures/zalo-stub.mjs (E2E_ZALO_STUB=1)");

    let linkedHere = false;

    // Linked the way a manager links the real OA: the signed state from
    // connect-url comes back on Zalo's redirect, and the stub takes any code.
    // A link made here is undone after, so specs expecting none still hold.
    test.beforeEach(async ({ page }) => {
      const status = await call<{ isConnected: boolean }>(page, `${ZALO}/status`, asBranchOne);
      linkedHere = !status.body.isConnected;
      if (!linkedHere) return;

      const connect = await call<{ url: string }>(page, `${ZALO}/connect-url`, asBranchOne);
      expect(connect.status, "connect-url needs the host's Zalo app credentials").toBe(200);
      const state = new URL(connect.body.url).searchParams.get("state") ?? "";
      const callback = await page.request.get(`${ZALO}/oauth/callback`, {
        params: { code: "stub-code", state },
        maxRedirects: 0,
      });
      expect(callback.headers().location).toContain("zalo=connected");
    });

    test.afterEach(async ({ page }) => {
      if (!linkedHere) return;
      const unlinked = await call(page, `${ZALO}/connection`, { ...asBranchOne, method: "DELETE" });
      expect(unlinked.status, "unlink the stub OA").toBe(204);
    });

    async function newZaloTemplate(page: Page, name: string, purpose: string, znsId: string) {
      await page.goto("/cskh-grouping/templates/new?branch=BD-001");
      await page.locator("#tpe-name").fill(name);
      await pickOption(page, page.locator("#tpe-purpose"), purpose);
      await page.getByRole("radio", { name: /Mẫu Zalo/ }).click();
      await pickOption(page, page.locator("#tpe-zns"), `#${znsId}`);
      await expect(page.getByText(/Trạng thái trên Zalo:/)).toBeVisible();
    }

    test("chọn mẫu ZNS điền sẵn tham số; thiếu tham số bắt buộc thì không lưu; Zalo chưa duyệt thì Chờ duyệt", async ({ page }) => {
      const id = runId();
      const approved = `E2E Zalo ${id}`;
      // The stub keeps every call for its lifetime, and the send spec does send.
      const sendsBefore = await znsSendCount();
      await newZaloTemplate(page, approved, "Nhắc lịch hẹn", "301001");

      await expect(page.locator("#tpe-zns-customer_name")).toHaveValue("{ten_khach_hang}");
      await expect(page.locator("#tpe-zns-booking_date")).toHaveValue("{ngay_hen}");
      await expect(page.locator("#tpe-zns-booking_time")).toHaveValue("{gio_hen}");
      await expect(page.locator("#tpe-zns-promo_note")).toHaveValue("");

      await page.getByRole("button", { name: "Lưu mẫu" }).click();
      await expect(toast(page, /Chưa gán dữ liệu cho tham số bắt buộc của mẫu ZNS: promo_note/)).toBeVisible();
      await expect(page).toHaveURL(/\/templates\/new/);

      await page.locator("#tpe-zns-promo_note").fill("Giảm 10% cạo vôi");
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Lưu mẫu" }).click();
      await expect(toast(page, "Đã lưu mẫu")).toBeVisible();
      await expect(page).toHaveURL(/\/cskh-grouping\?tab=template/);
      await searchList(page, approved);
      await expect(templateRow(page, approved)).toContainText("Sẵn sàng");

      const [stored] = (await call<{ items: Template[] }>(page, `${TEMPLATES}?filter=${encodeURIComponent(approved)}`, asBranchOne))
        .body.items;
      expect(stored).toMatchObject({
        status: STATUS.Ready,
        externalTemplateId: "301001",
        paramMap: {
          customer_name: "{ten_khach_hang}",
          booking_date: "{ngay_hen}",
          booking_time: "{gio_hen}",
          promo_note: "Giảm 10% cạo vôi",
        },
      });

      const pending = `E2E Zalo chờ ${id}`;
      await newZaloTemplate(page, pending, "Chúc mừng sinh nhật", "301002");
      await expect(page.locator("#tpe-zns-customer_name")).toHaveValue("{ten_khach_hang}");
      await page.getByRole("button", { name: "Lưu mẫu" }).click();
      await expect(toast(page, "Đã lưu mẫu")).toBeVisible();
      await searchList(page, pending);
      await expect(templateRow(page, pending)).toContainText("Chờ duyệt");

      // Saving a template only reads Zalo; nothing was sent to a customer.
      expect(await znsSendCount()).toBe(sendsBefore);
    });
  });
});
