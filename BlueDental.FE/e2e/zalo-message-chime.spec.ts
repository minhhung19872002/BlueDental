import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { login, runId } from "./fixtures/auth";
import { call } from "./fixtures/timekeepingStaff";
import { customerWrites, linkStubOa, oaWrites, unlinkStubOa, zaloUser } from "./fixtures/zaloWebhook";

/**
 * Feature: "Nghe chuông tin nhắn Zalo" (R-1194, F-80). An account holding
 * cskhInbox.notify hears tinnhan.mp3 — not the "Bác sĩ mời lên" chime — when a
 * customer writes to its branch's OA, on any screen. Loading the page only
 * remembers what is there; several messages in one poll ring once; two tabs of
 * one browser ring once; the OA's own message never rings. A doctor without
 * the leaf polls nothing and is refused the pulse; another branch's pulse is
 * refused and untouched.
 *
 * Real login screen, real API, real PostgreSQL; nothing is intercepted. The
 * browser's audio is only watched (HTMLMediaElement.play counted, the sound
 * still plays). Zalo is the local stub, so the spec runs only with
 * E2E_ZALO_STUB=1 (host env in e2e/fixtures/zaloWebhook.ts).
 */

const PULSE = "/api/v1/app/zalo-inbox/pulse";
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";
const BRANCH_TWO = "22222222-2222-2222-2222-222222222222";
const PASSWORD = "ChuongTin@123456";
const NOTIFY = "BlueDental.cskhInbox.notify";
const BOARD = ["BlueDental.reception.read", "BlueDental.appointment.read"];
const MESSAGE_SOUND = "/sounds/tinnhan.mp3";
const INVITE_SOUND = "/sounds/invite-chime.mp3";
/** Longer than one poll (10 s), so a ring that would come has come. */
const QUIET_MS = 13_000;

interface RunAccount {
  credentials: { userName: string; password: string };
  tearDown: () => Promise<void>;
}

/** A throw-away role holding just `grants`, and a staff member of `branchId` in it. */
async function makeAccount(
  page: Page,
  grants: string[],
  { branchId = BRANCH_ONE, isDentist = false }: { branchId?: string; isDentist?: boolean } = {},
): Promise<RunAccount> {
  const id = runId() + String(Math.floor(Math.random() * 90 + 10));
  const roleName = `Chuông tin ${id}`;
  const role = await call<{ id: string }>(page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const granted = await call(
    page,
    `/api/permission-management/permissions?providerName=R&providerKey=${encodeURIComponent(roleName)}`,
    { method: "PUT", json: { permissions: grants.map((name) => ({ name, isGranted: true })) } },
  );
  expect(granted.status).toBe(204);

  const userName = `chuong${id}`;
  const staff = await call<{ id: string }>(page, "/api/v1/app/staff", {
    method: "POST",
    json: {
      userName,
      password: PASSWORD,
      name: `Nhân viên chuông ${id}`,
      email: `${userName}@bluedental.local`,
      phoneNumber: null,
      roleNames: [roleName],
      branchIds: [branchId],
      isActive: true,
      isDentist,
    },
  });
  expect(staff.status, JSON.stringify(staff.body)).toBe(200);

  return {
    credentials: { userName, password: PASSWORD },
    tearDown: async () => {
      await call(page, `/api/v1/app/staff/${staff.body.id}`, { method: "DELETE" });
      await call(page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
    },
  };
}

/** Records every sound the page tries to play, by file; the volume-0 autoplay check is none. */
function countSounds() {
  Reflect.set(window, "__bdSounds", []);
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this.volume === 0) return play.call(this);
    const played: unknown = Reflect.get(window, "__bdSounds");
    if (Array.isArray(played)) played.push(new URL(this.currentSrc || this.src).pathname);
    return play.call(this);
  };
}

const soundsOf = (page: Page) =>
  page.evaluate(() => {
    const played: unknown = Reflect.get(window, "__bdSounds");
    return Array.isArray(played) ? played.map(String) : [];
  });

const messageRings = async (pages: Page[]) =>
  (await Promise.all(pages.map(soundsOf))).flat().filter((src) => src === MESSAGE_SOUND).length;

const nextPulse = (page: Page) =>
  page.waitForResponse((res) => res.url().includes(PULSE) && res.request().method() === "GET", { timeout: 25_000 });

/** A separate browser, its audio watched, signed in on the login screen and opened on Tiếp nhận. */
async function openAs(context: BrowserContext, credentials: RunAccount["credentials"]): Promise<Page> {
  await context.addInitScript(countSounds);
  const page = await context.newPage();
  await login(page, credentials);
  return page;
}

async function openBoard(page: Page): Promise<void> {
  const baseline = nextPulse(page);
  await page.goto("/reception?branch=BD-001");
  expect((await baseline).status(), "the first pulse is served by the real API").toBe(200);
}

test.describe("Nghe chuông tin nhắn Zalo (Zalo giả lập)", () => {
  test.skip(!process.env.E2E_ZALO_STUB, "cần host trỏ Zalo về e2e/fixtures/zalo-stub.mjs (E2E_ZALO_STUB=1)");
  test.describe.configure({ timeout: 180_000 });

  let linkedHere = false;

  test.beforeEach(async ({ page }) => {
    await login(page);
    linkedHere = await linkStubOa(page, BRANCH_ONE);
  });

  test.afterEach(async ({ page }) => {
    if (linkedHere) await unlinkStubOa(page, BRANCH_ONE);
  });

  test("có quyền: tải trang không kêu; khách nhắn kêu tinnhan.mp3 một lần; hai tin một lượt kêu một lần; tin OA không kêu; hai tab kêu một lần", async ({
    page,
    browser,
  }) => {
    const account = await makeAccount(page, [...BOARD, NOTIFY]);
    const context = await browser.newContext();
    try {
      // A message waiting from before the load is only remembered.
      await customerWrites(page, zaloUser(), "Tin cũ trước khi mở trang");
      const tab = await openAs(context, account.credentials);
      await openBoard(tab);
      await tab.waitForTimeout(QUIET_MS);
      expect(await messageRings([tab]), "loading the page rings nothing").toBe(0);

      // A customer writes: one ring, the message sound, not the invite chime.
      const customer = zaloUser();
      await customerWrites(page, customer, "Cho em hỏi lịch khám ạ");
      await expect.poll(() => messageRings([tab]), { timeout: 25_000 }).toBe(1);
      expect(await soundsOf(tab)).not.toContain(INVITE_SOUND);

      // Two customers inside one poll: still one ring.
      await nextPulse(tab);
      await customerWrites(page, zaloUser(), "Tin thứ nhất");
      await customerWrites(page, zaloUser(), "Tin thứ hai");
      await expect.poll(() => messageRings([tab]), { timeout: 25_000 }).toBe(2);
      await tab.waitForTimeout(QUIET_MS);
      expect(await messageRings([tab]), "several messages in one poll ring once").toBe(2);

      // The OA's own message (sent from Zalo's app) answers; it rings nothing.
      await oaWrites(page, customer, "Dạ phòng khám chào anh/chị");
      await tab.waitForTimeout(QUIET_MS);
      expect(await messageRings([tab]), "an OA message never rings").toBe(2);

      // Away from Tiếp nhận, a second tab of the same browser open: one ring between them.
      const second = await context.newPage();
      const secondBaseline = nextPulse(second);
      await second.goto("/reception?branch=BD-001");
      await secondBaseline;
      const moved = nextPulse(tab);
      await tab.goto("/calendar?branch=BD-001");
      await moved;
      // Both pages were just loaded, so both counts start again from nothing.
      expect(await messageRings([tab, second])).toBe(0);
      await customerWrites(page, zaloUser(), "Tin khi mở hai tab");
      await expect.poll(() => messageRings([tab, second]), { timeout: 25_000 }).toBe(1);
      await tab.waitForTimeout(QUIET_MS);
      expect(await messageRings([tab, second]), "two tabs of one browser ring once").toBe(1);
    } finally {
      await context.close();
      await account.tearDown();
    }
  });

  test("bác sĩ không có quyền: không hỏi pulse, không kêu, gọi thẳng bị 403; chi nhánh khác bị chặn và không đổi", async ({
    page,
    browser,
  }) => {
    const doctor = await makeAccount(page, BOARD, { isDentist: true });
    const otherBranch = await makeAccount(page, [...BOARD, NOTIFY], { branchId: BRANCH_TWO });
    const context = await browser.newContext();
    try {
      const tab = await openAs(context, doctor.credentials);
      let pulses = 0;
      tab.on("request", (request) => {
        if (request.url().includes(PULSE)) pulses += 1;
      });
      await tab.goto("/reception?branch=BD-001");

      const branchTwoBefore = await call<{ lastCustomerMessageAt: string | null }>(page, PULSE, { branchId: BRANCH_TWO });
      expect(branchTwoBefore.status).toBe(200);

      await customerWrites(page, zaloUser(), "Tin tới khi bác sĩ đang mở trang");
      await tab.waitForTimeout(QUIET_MS);
      expect(await messageRings([tab]), "a doctor without the leaf hears nothing").toBe(0);
      expect(pulses, "a doctor without the leaf never asks").toBe(0);

      const refused = await call(tab, PULSE, { branchId: BRANCH_ONE });
      expect(refused.status, "the server refuses the pulse without the leaf").toBe(403);

      // Branch two's holder of the leaf is refused branch one's pulse.
      const branchTwoContext = await browser.newContext();
      try {
        const branchTwoTab = await branchTwoContext.newPage();
        await login(branchTwoTab, otherBranch.credentials);
        const crossBranch = await call(branchTwoTab, PULSE, { branchId: BRANCH_ONE });
        expect(crossBranch.status, "another branch's pulse is refused").toBe(403);
        const own = await call(branchTwoTab, PULSE, { branchId: BRANCH_TWO });
        expect(own.status).toBe(200);
      } finally {
        await branchTwoContext.close();
      }

      // Branch one's customer moved branch one's pulse only.
      const branchOne = await call<{ lastCustomerMessageAt: string | null }>(page, PULSE, { branchId: BRANCH_ONE });
      expect(branchOne.body.lastCustomerMessageAt).not.toBeNull();
      const branchTwoAfter = await call<{ lastCustomerMessageAt: string | null }>(page, PULSE, { branchId: BRANCH_TWO });
      expect(branchTwoAfter.body.lastCustomerMessageAt).toBe(branchTwoBefore.body.lastCustomerMessageAt);
    } finally {
      await context.close();
      await doctor.tearDown();
      await otherBranch.tearDown();
    }
  });
});
