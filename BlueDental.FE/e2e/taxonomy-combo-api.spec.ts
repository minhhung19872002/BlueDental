import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { assertRealApiTraffic, login, runId } from "./fixtures/auth";
import {
  BRANCH_ONE,
  BRANCH_TWO,
  COMBO,
  ENTRIES,
  SINGLE,
  TAXONOMIES,
  TAX_EIGHT,
  TAX_KCT,
  call,
  config,
  createGroup,
  createSingle,
  getEntry,
  type ComboItem,
  type Entry,
} from "./fixtures/catalogApi";

/**
 * Feature: Danh mục → Dịch vụ → Combo (BA request 2026-10-06; the reference
 * has no combo). The rules the API keeps on its own — every call is a real
 * HTTP request from the logged-in page against the real backend and database.
 * Nothing is intercepted, no token is injected.
 */

function comboBody(taxonomyId: string, name: string, items: ComboItem[], extra: Record<string, unknown> = {}) {
  return {
    taxonomyId,
    name,
    // Left empty, the server prices a combo at Σ thành tiền × SL.
    price: null,
    unit: "Combo",
    serviceConfig: config(COMBO),
    comboItems: items,
    ...extra,
  };
}

function updateBody(entry: Entry, taxonomyId: string, extra: Record<string, unknown> = {}) {
  return {
    taxonomyId,
    name: entry.name,
    price: entry.price,
    isActive: true,
    isDeleted: false,
    unit: "Combo",
    serviceConfig: { ...config(entry.serviceConfig?.kind ?? SINGLE), ...extra.serviceConfig as object },
    ...extra,
  };
}


test.describe("Danh mục dịch vụ — combo (API)", () => {
  let groupId: string;
  let id: string;

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/taxonomy/service");
    await assertRealApiTraffic(page, TAXONOMIES);
    id = runId();
    groupId = await createGroup(page, BRANCH_ONE, `Nhóm combo ${id}`);
  });

  test("a combo keeps the price the user typed; editing a row never touches the service", async ({ page }) => {
    const cleaning = await createSingle(page, groupId, `Cạo vôi ${id}`, 300_000);
    const filling = await createSingle(page, groupId, `Trám răng ${id}`, 500_000);

    const created = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo ${id}`, [
        { componentEntryId: cleaning.id, quantity: 2, unitAmount: 250_000 },
        { componentEntryId: filling.id, quantity: 1, unitAmount: 500_000 },
      ]),
    );
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    // No price sent: Σ thành tiền × SL = 250k × 2 + 500k.
    expect(created.body.price).toBe(1_000_000);
    expect(created.body.serviceConfig?.kind).toBe(COMBO);
    expect(created.body.serviceConfig?.discountValue).toBe(0);

    // A separate request reads back what was stored.
    const stored = await getEntry(page, created.body.id);
    expect(stored.comboItems.map((x) => [x.componentEntryId, x.quantity, x.unitAmount])).toEqual([
      [cleaning.id, 2, 250_000],
      [filling.id, 1, 500_000],
    ]);
    expect(stored.comboItems[0].name).toBe(cleaning.name);
    expect(stored.comboItems[0].unitPrice).toBe(300_000);

    // The service the row points at kept its own price.
    expect((await getEntry(page, cleaning.id)).price).toBe(300_000);

    // Giá combo may be typed over (BA 2026-10-06): the typed price is kept and
    // leaving comboItems out keeps the rows.
    const typed = await call<Entry>(page, "PUT", `${ENTRIES}/${stored.id}`, updateBody(stored, groupId, { price: 900_000 }));
    expect(typed.status, JSON.stringify(typed.body)).toBe(200);
    expect(typed.body.price).toBe(900_000);
    expect(typed.body.comboItems).toHaveLength(2);
    const reread = await getEntry(page, stored.id);
    expect(reread.price).toBe(900_000);
    expect(reread.comboItems.map((x) => x.unitAmount)).toEqual([250_000, 500_000]);

    // New rows with a typed price: the typed price wins over the rows' 1.200.000.
    const rows = [{ componentEntryId: filling.id, quantity: 3, unitAmount: 400_000 }];
    const retyped = await call<Entry>(
      page,
      "PUT",
      `${ENTRIES}/${stored.id}`,
      updateBody(stored, groupId, { price: 1_150_000, comboItems: rows }),
    );
    expect(retyped.status, JSON.stringify(retyped.body)).toBe(200);
    expect(retyped.body.price).toBe(1_150_000);
    expect((await getEntry(page, stored.id)).comboItems).toHaveLength(1);

    // New rows and no price: back to Σ thành tiền × SL.
    const repriced = await call<Entry>(
      page,
      "PUT",
      `${ENTRIES}/${stored.id}`,
      updateBody(stored, groupId, { price: null, comboItems: rows }),
    );
    expect(repriced.status, JSON.stringify(repriced.body)).toBe(200);
    expect(repriced.body.price).toBe(1_200_000);
    expect((await getEntry(page, filling.id)).price).toBe(500_000);
  });

  test("tiền thuế and thực thu follow the BA formulas", async ({ page }) => {
    const service = await createSingle(page, groupId, `Tẩy trắng ${id}`, 1_000_000);
    const items = [{ componentEntryId: service.id, quantity: 1, unitAmount: 1_000_000 }];

    // Trước thuế, 8 %: tax = 1,000,000 × 8 % ; thực thu = combo + tax.
    const before = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo trước thuế ${id}`, items, { serviceConfig: config(COMBO, TAX_EIGHT, false) }),
    );
    expect(before.status, JSON.stringify(before.body)).toBe(200);
    expect(before.body.serviceConfig?.taxAmount).toBe(80_000);
    expect(before.body.serviceConfig?.amountCollected).toBe(1_080_000);

    // Sau thuế, 8 %: tax = combo × 8 % / 1.08 ; thực thu = combo − tax.
    const after = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo sau thuế ${id}`, items, { serviceConfig: config(COMBO, TAX_EIGHT, true) }),
    );
    expect(after.status, JSON.stringify(after.body)).toBe(200);
    expect(after.body.serviceConfig?.taxAmount).toBe(74_074.07);
    expect(after.body.serviceConfig?.amountCollected).toBe(925_925.93);
    // The plan's sale price stays the price without VAT.
    expect(after.body.serviceConfig?.priceAfterDiscount).toBe(925_925.93);

    // KCT charges nothing.
    const exempt = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo KCT ${id}`, items, { serviceConfig: config(COMBO, TAX_KCT, true) }),
    );
    expect(exempt.body.serviceConfig?.taxAmount).toBe(0);
    expect(exempt.body.serviceConfig?.amountCollected).toBe(1_000_000);

    // A combo never carries a discount, whatever is sent.
    const discounted = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo giảm ${id}`, items, {
        serviceConfig: { ...config(COMBO), discountIsPercent: false, discountValue: 100_000 },
      }),
    );
    expect(discounted.body.serviceConfig?.discountValue).toBe(0);
    expect(discounted.body.serviceConfig?.amountCollected).toBe(1_000_000);
  });

  test("the server refuses a combo it cannot build", async ({ page }) => {
    const service = await createSingle(page, groupId, `Nhổ răng ${id}`, 200_000);
    const row = { componentEntryId: service.id, quantity: 1, unitAmount: 200_000 };

    const expectCode = async (body: unknown, code: string, method = "POST", url = ENTRIES) => {
      const res = await call<Entry>(page, method, url, body);
      expect(res.status, JSON.stringify(res.body)).toBe(403);
      expect(res.body.error?.code).toBe(code);
    };

    // No rows at all.
    await expectCode(comboBody(groupId, `Combo rỗng ${id}`, []), "BlueDental:Catalogs:0027");
    // A typed price below zero.
    await expectCode(comboBody(groupId, `Combo âm ${id}`, [row], { price: -1 }), "BlueDental:Catalogs:0009");
    // The same service twice.
    await expectCode(comboBody(groupId, `Combo trùng ${id}`, [row, row]), "BlueDental:Catalogs:0028");
    // A service id that does not exist.
    await expectCode(
      comboBody(groupId, `Combo lạ ${id}`, [{ ...row, componentEntryId: "00000000-0000-4000-8000-000000000001" }]),
      "BlueDental:Catalogs:0028",
    );
    // Quantity under one, a negative amount.
    await expectCode(comboBody(groupId, `Combo SL ${id}`, [{ ...row, quantity: 0 }]), "BlueDental:Catalogs:0029");
    await expectCode(comboBody(groupId, `Combo âm ${id}`, [{ ...row, unitAmount: -1 }]), "BlueDental:Catalogs:0029");
    // A single service cannot carry rows.
    await expectCode(
      { taxonomyId: groupId, name: `Lẻ có dòng ${id}`, price: 1, serviceConfig: config(SINGLE), comboItems: [row] },
      "BlueDental:Catalogs:0028",
    );

    // A combo cannot be a component of another combo.
    const combo = await call<Entry>(page, "POST", ENTRIES, comboBody(groupId, `Combo con ${id}`, [row]));
    expect(combo.status).toBe(200);
    await expectCode(
      comboBody(groupId, `Combo lồng ${id}`, [{ componentEntryId: combo.body.id, quantity: 1, unitAmount: 0 }]),
      "BlueDental:Catalogs:0028",
    );

    // The kind is fixed: neither way round can it be switched.
    await expectCode(
      updateBody(combo.body, groupId, { serviceConfig: config(SINGLE) }),
      "BlueDental:Catalogs:0026",
      "PUT",
      `${ENTRIES}/${combo.body.id}`,
    );
    await expectCode(
      updateBody(service, groupId, { serviceConfig: config(COMBO), comboItems: [] }),
      "BlueDental:Catalogs:0026",
      "PUT",
      `${ENTRIES}/${service.id}`,
    );

    // A deleted service cannot be added, but one already in the combo may stay.
    const doomed = await createSingle(page, groupId, `Sắp xoá ${id}`, 100_000);
    const withDoomed = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo giữ ${id}`, [{ componentEntryId: doomed.id, quantity: 1, unitAmount: 100_000 }]),
    );
    expect(withDoomed.status).toBe(200);
    expect((await call(page, "DELETE", `${ENTRIES}/${doomed.id}`)).status).toBe(204);

    const stillThere = await getEntry(page, withDoomed.body.id);
    expect(stillThere.comboItems[0].isDeleted).toBe(true);
    const resaved = await call<Entry>(
      page,
      "PUT",
      `${ENTRIES}/${stillThere.id}`,
      updateBody(stillThere, groupId, {
        price: null,
        comboItems: [{ componentEntryId: doomed.id, quantity: 2, unitAmount: 100_000 }],
      }),
    );
    expect(resaved.status, JSON.stringify(resaved.body)).toBe(200);
    expect(resaved.body.price).toBe(200_000);

    await expectCode(
      comboBody(groupId, `Combo xoá ${id}`, [{ componentEntryId: doomed.id, quantity: 1, unitAmount: 100_000 }]),
      "BlueDental:Catalogs:0031",
    );
  });

  test("a component from another branch is refused", async ({ page }) => {
    const foreignGroup = await createGroup(page, BRANCH_TWO, `Nhóm combo CN2 ${id}`);
    const foreign = await createSingle(page, foreignGroup, `Dịch vụ CN2 ${id}`, 100_000);

    const res = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo chéo ${id}`, [{ componentEntryId: foreign.id, quantity: 1, unitAmount: 100_000 }]),
    );
    expect(res.status).toBe(403);
    expect(res.body.error?.code).toBe("BlueDental:Catalogs:0028");
  });

  test("the list filters by kind", async ({ page }) => {
    const service = await createSingle(page, groupId, `Lẻ lọc ${id}`, 100_000);
    const combo = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo lọc ${id}`, [{ componentEntryId: service.id, quantity: 1, unitAmount: 90_000 }]),
    );
    expect(combo.status).toBe(200);

    const list = async (kind: number) => {
      const res = await call<{ items: Entry[] }>(
        page,
        "GET",
        `${ENTRIES}?group=care_service&taxonomyId=${groupId}&kind=${kind}&maxResultCount=100`,
      );
      expect(res.status).toBe(200);
      return (res.body.items ?? []).map((x) => x.id);
    };

    expect(await list(COMBO)).toEqual([combo.body.id]);
    expect(await list(SINGLE)).toEqual([service.id]);
  });

  test("an Excel row naming a combo is refused", async ({ page }) => {
    const service = await createSingle(page, groupId, `Lẻ nhập ${id}`, 100_000);
    const combo = await call<Entry>(
      page,
      "POST",
      ENTRIES,
      comboBody(groupId, `Combo nhập ${id}`, [{ componentEntryId: service.id, quantity: 1, unitAmount: 90_000 }]),
    );
    expect(combo.status).toBe(200);

    const out = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      out,
      XLSX.utils.aoa_to_sheet([
        ["Nhóm phân loại *", "Tên dịch vụ *", "Giá"],
        [`Nhóm combo ${id}`, `Combo nhập ${id}`, 50_000],
      ]),
      "Dịch vụ",
    );
    const base64 = XLSX.write(out, { type: "base64", bookType: "xlsx" });

    const result = await page.evaluate(
      async ({ url, base64 }) => {
        const xsrf = document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.substring("XSRF-TOKEN=".length);
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const form = new FormData();
        form.append("file", new Blob([bytes]), "combo.xlsx");
        form.append("group", "care_service");
        form.append("dryRun", "true");
        const res = await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: {
            accept: "application/json",
            "accept-language": "vi",
            ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
          },
          body: form,
        });
        return { status: res.status, body: await res.json() };
      },
      { url: `${ENTRIES}/import`, base64 },
    );
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    const imported = result.body.sheets[0].rows[0];
    expect(imported.action).toBe(4);
    expect(imported.errors.join(" ")).toMatch(/combo/i);

    // Nothing moved on the combo.
    expect((await getEntry(page, combo.body.id)).price).toBe(90_000);
  });
});
