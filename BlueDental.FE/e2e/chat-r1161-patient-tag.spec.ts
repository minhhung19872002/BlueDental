import { expect, test, type Page } from "@playwright/test";
import { MANAGER_USER, TEST_USER, login, runId } from "./fixtures/auth";
import { CHAT, patiently, signIn, type Session } from "./fixtures/chatApi";
import { BRANCH_ONE, call } from "./fixtures/marketingTicket";
import { call as staffCall } from "./fixtures/timekeepingStaff";

/**
 * Gắn khách bằng # (R-1161, chat-patient-tag.md § 5) in real browsers
 * against the real host and PostgreSQL, no interception: type #, pick with
 * the keyboard, send; the other member sees the cards and opens the record;
 * a reload keeps them; an account without Patients.View sees the reduced card.
 */

const PASSWORD = "E2e@123456";
const run = runId();
const groupName = `Gắn khách UI ${run}`;

let admin: Session;
let manager: Session;
let groupId: string;
const patients: { id: string; name: string; patientCode: string }[] = [];

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, TEST_USER);
  manager = await signIn(browser, MANAGER_USER);
  const group = await patiently(() => call<{ id: string }>(admin.page, "POST", `${CHAT}/conversations/group`, {
    name: groupName,
    memberIds: [manager.userId],
  }));
  expect(group.status).toBe(200);
  groupId = group.body.id;
  for (const [index, firstName] of ["An", "Bình"].entries()) {
    const made = await call<{ id: string; patientCode: string }>(admin.page, "POST", "/api/v1/app/patients", {
      lastName: `Gắn ${run}`,
      firstName,
      gender: 2,
      phoneNumber: `08${run}9${index}`,
      dateOfBirth: "1988-03-02",
    });
    expect(made.status, JSON.stringify(made.body)).toBe(200);
    patients.push({ id: made.body.id, name: `Gắn ${run} ${firstName}`, patientCode: made.body.patientCode });
  }
});

test.afterAll(async () => {
  if (groupId) await call(manager.page, "POST", `${CHAT}/conversations/${groupId}/read`);
  for (const p of patients) await call(admin.page, "POST", `/api/v1/app/patients/${p.id}/deactivate`);
  await Promise.all([admin?.context.close(), manager?.context.close()]);
});

const panel = (page: Page) => page.getByRole("complementary", { name: "Chat nội bộ" });
const composer = (page: Page) => panel(page).getByRole("textbox", { name: /Nhập tin nhắn/ });
const suggestions = (page: Page) => panel(page).getByRole("listbox", { name: "Gợi ý khách" });
const cardsOf = (page: Page, text: string) =>
  panel(page).locator(".chat-message").filter({ hasText: text }).getByRole("list", { name: "Khách được gắn" });

async function openGroup(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: "Mở chat nội bộ" }).click();
  await panel(page).locator(".chat-conversation").filter({ hasText: groupName }).first().click();
  await expect(composer(page)).toBeVisible();
}

test("# opens suggestions; ↓ Enter / Tab pick, Backspace takes a tag whole, Esc closes; the cards follow the tags", async () => {
  const [an, binh] = patients;
  const page = admin.page;
  await openGroup(page);
  const box = composer(page);

  await box.pressSequentially(`Mời #gan ${run}`);
  await expect(suggestions(page).getByRole("option")).toHaveCount(2);
  await expect(suggestions(page).getByRole("option").first()).toContainText(an.name);
  await expect(suggestions(page).getByRole("option").first()).toContainText(an.patientCode);
  await box.press("ArrowDown");
  await expect(suggestions(page).getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await box.press("Enter");
  await expect(box).toHaveValue(`Mời #${binh.name} `);
  await expect(suggestions(page)).toBeHidden();

  // Backspace over the space, then once more takes the whole tag.
  await box.press("Backspace");
  await box.press("Backspace");
  await expect(box).toHaveValue("Mời ");
  await box.pressSequentially(`#gan ${run} binh`);
  await expect(suggestions(page).getByRole("option")).toHaveCount(1);
  await box.press("Tab");
  await expect(box).toHaveValue(`Mời #${binh.name} `);

  // Nobody matches; Esc closes the list and the text stays.
  await box.pressSequentially(`#khong co ai ${run}`);
  await expect(panel(page).getByText("Không tìm thấy khách")).toBeVisible();
  await box.press("Escape");
  await expect(panel(page).getByText("Không tìm thấy khách")).toBeHidden();
  for (let i = 0; i < `#khong co ai ${run}`.length; i++) await box.press("Backspace");

  await box.pressSequentially(`và #gan ${run} an`);
  await expect(suggestions(page).getByRole("option")).toHaveText([new RegExp(an.name)]);
  await box.press("Enter");
  await expect(box).toHaveValue(`Mời #${binh.name} và #${an.name} `);
  await box.press("Enter");
  await expect(box).toHaveValue("");

  const sent = `Mời #${binh.name} và #${an.name}`;
  const message = panel(page).locator(".chat-message").filter({ hasText: sent });
  await expect(message.locator(".chat-tag")).toHaveText([`#${binh.name}`, `#${an.name}`]);
  const cards = cardsOf(page, sent).getByRole("link");
  await expect(cards).toHaveCount(2);
  await expect(cards.first()).toContainText(binh.name);
  await expect(cards.first()).toContainText(binh.patientCode);
  await expect(cards.first()).toContainText("1988");
  await expect(cards.nth(1)).toContainText(an.name);

  // A reload keeps the tags and the cards.
  await openGroup(page);
  await expect(cardsOf(page, sent).getByRole("link")).toHaveCount(2);
});

test("the other member sees the cards and a card opens that patient's record", async () => {
  const [an, binh] = patients;
  const page = manager.page;
  await openGroup(page);
  const sent = `Mời #${binh.name} và #${an.name}`;
  const card = cardsOf(page, sent).getByRole("link", { name: `Mở hồ sơ ${an.name}` });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/patient/${an.id}\\?(.*&)?tab=profile`));
  await expect(page.getByText(an.patientCode).first()).toBeVisible({ timeout: 15_000 });
});

test("without Patients.View the card shows only Tên + Mã KH and does not open", async ({ browser }) => {
  const [an] = patients;
  const roleName = `Chat UI hạn chế ${run}`;
  const role = await staffCall<{ id: string }>(admin.page, "/api/identity/roles", {
    method: "POST",
    json: { name: roleName, isDefault: false, isPublic: true },
  });
  expect(role.status).toBe(200);
  const userName = `chatuint${run}`;
  let staffId: string | undefined;
  try {
    const staff = await staffCall<{ id: string }>(admin.page, "/api/v1/app/staff", {
      method: "POST",
      branchId: BRANCH_ONE,
      json: {
        userName, password: PASSWORD, name: `Chat UI hạn chế ${run}`, email: `${userName}@bluedental.local`,
        roleNames: [roleName], branchIds: [BRANCH_ONE], isActive: true,
      },
    });
    expect(staff.status, JSON.stringify(staff.body.error)).toBe(200);
    staffId = staff.body.id;

    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, { userName, password: PASSWORD });
    const me = await call<{ currentUser: { id: string } }>(page, "GET", "/api/abp/application-configuration");
    const added = await patiently(() => call(admin.page, "POST", `${CHAT}/conversations/${groupId}/members`, {
      userIds: [me.body.currentUser.id],
    }));
    expect(added.status, JSON.stringify(added.body)).toBe(200);
    const text = `Chỉ tên ${run}`;
    const sent = await patiently(() =>
      call(admin.page, "POST", `${CHAT}/conversations/${groupId}/messages`, {
        conversationId: groupId,
        content: `${text} #[${an.name}](patient:${an.id})`,
        attachmentIds: [],
        patientIds: [an.id],
      }),
    );
    expect(sent.status).toBe(200);

    await page.goto("/?branch=BD-001");
    await openGroup(page);
    const cards = cardsOf(page, text);
    await expect(cards.locator(".chat-patient-card")).toHaveCount(1);
    await expect(cards).toContainText(an.name);
    await expect(cards).toContainText(an.patientCode);
    await expect(cards).not.toContainText("1988");
    await expect(cards.getByRole("link")).toHaveCount(0);
    await context.close();
  } finally {
    if (staffId) await staffCall(admin.page, `/api/v1/app/staff/${staffId}`, { method: "DELETE" });
    await staffCall(admin.page, `/api/identity/roles/${role.body.id}`, { method: "DELETE" });
  }
});
