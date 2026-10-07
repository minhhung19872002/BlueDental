import { expect, test, type Page } from "@playwright/test";
import { assertRealApiTraffic, BRANCH2_USER, login, runId } from "./fixtures/auth";

/**
 * Feature: Hồ sơ bệnh nhân → Người giám hộ (BA, 2026-10-07; R-773).
 *
 * The rules the server keeps on its own, whatever the dialog sends:
 * - under 16 by year (current year − birth year) needs at least one guardian,
 *   on create and on update alike — an older record is blocked until one is added;
 * - at most 3 guardians, exactly 1 primary contact, the consent tick;
 * - "Khác" needs the relation in words and the type of paper;
 * - a proof file is JPG / PNG / PDF ≤ 5MB, and only its own branch can read it back.
 *
 * Every call is a real HTTP request from inside the logged-in page, with the
 * cookie the real login left and the antiforgery token the server set. Nothing
 * is intercepted, no token is injected, the database is the real one.
 */

const PATIENTS = "/api/v1/app/patients";
const DOCUMENTS = `${PATIENTS}/guardian-documents`;
const BRANCH_ONE = "11111111-1111-1111-1111-111111111111";

const CODE = {
  required: "BlueDental:Patient:0013",
  tooMany: "BlueDental:Patient:0014",
  primary: "BlueDental:Patient:0015",
  consent: "BlueDental:Patient:0016",
  otherIncomplete: "BlueDental:Patient:0017",
  invalidDocument: "BlueDental:Patient:0018",
  incomplete: "BlueDental:Patient:0019",
} as const;

const RELATION = { Father: 1, Mother: 2, Other: 8 } as const;
const PROOF = { PowerOfAttorney: 1 } as const;

interface GuardianInput {
  id?: string | null;
  relation: number;
  relationNote?: string | null;
  proofType?: number | null;
  proofBlobName?: string | null;
  proofFileName?: string | null;
  fullName: string;
  phone: string;
  nationalId: string;
  sameAddressAsPatient: boolean;
  isPrimaryContact: boolean;
}

interface PatientInput {
  firstName: string;
  lastName: string;
  gender: number;
  phoneNumber: string;
  dateOfBirth: string | null;
  guardians?: GuardianInput[] | null;
  guardiansConsented?: boolean;
}

interface Body {
  id?: string;
  guardians?: (GuardianInput & { id: string; consentedAt: string })[];
  blobName?: string;
  fileName?: string;
  error?: { code?: string; message?: string };
}

interface ApiResult {
  status: number;
  body: Body;
}

interface Upload {
  fileName: string;
  type: string;
  bytes: number[];
  /** Spaces appended after `bytes`, to reach a size. */
  padding?: number;
}

/** One request from the logged-in page: cookie session + antiforgery header. */
async function send(
  page: Page,
  method: "GET" | "POST" | "PUT",
  url: string,
  payload?: PatientInput | Upload,
): Promise<ApiResult> {
  return page.evaluate(
    async ({ method, url, payload, branch }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const headers: Record<string, string> = {
        accept: "application/json, text/plain, */*",
        "accept-language": "vi",
        "X-Clinic-Branch-Id": branch,
        ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
      };
      let body: BodyInit | undefined;
      if (payload && "bytes" in payload) {
        const form = new FormData();
        // The padding is made here, in the page: shipping megabytes through evaluate is slow.
        const parts = [new Uint8Array(payload.bytes), new Uint8Array(payload.padding ?? 0).fill(32)];
        form.append("file", new File(parts, payload.fileName, { type: payload.type }));
        body = form;
      } else if (payload) {
        headers["content-type"] = "application/json";
        body = JSON.stringify(payload);
      }
      const res = await fetch(url, { method, credentials: "include", headers, body });
      const text = await res.text();
      let parsed: unknown = {};
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = { raw: text.length };
      }
      return { status: res.status, body: parsed as ApiResult["body"] };
    },
    { method, url, payload, branch: BRANCH_ONE },
  );
}

/** A GET without the branch header: the other user's own branch decides. */
async function sendAsOwnBranch(page: Page, url: string): Promise<number> {
  return page.evaluate(async (target) => {
    const res = await fetch(target, { credentials: "include", headers: { accept: "application/json" } });
    return res.status;
  }, url);
}

/** Two digits that differ for every person one run makes, so no two share a phone or a CCCD. */
let counter = 0;
const serial = () => String(counter++ % 100).padStart(2, "0");

const yearsAgo = (years: number) => `${new Date().getFullYear() - years}-06-15`;

function guardian(id: string, tag: string, overrides: Partial<GuardianInput> = {}): GuardianInput {
  return {
    relation: RELATION.Mother,
    fullName: `GH ${tag} E2E ${id}`,
    phone: `07${id}${serial()}`,
    nationalId: `0791${id}${serial()}`,
    sameAddressAsPatient: true,
    isPrimaryContact: false,
    ...overrides,
  };
}

function child(id: string, tag: string, guardians: GuardianInput[] | null, consented = true): PatientInput {
  return {
    firstName: tag,
    lastName: `Giám hộ E2E ${id}`,
    gender: 1,
    phoneNumber: `08${id}${serial()}`,
    dateOfBirth: yearsAgo(9),
    guardians,
    guardiansConsented: consented,
  };
}

const PDF_BYTES = Array.from(new TextEncoder().encode("%PDF-1.4\n% e2e guardian proof\n%%EOF\n"));

test.describe("Patient guardians (real API)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto("/patient");
    await assertRealApiTraffic(page, PATIENTS);
  });

  test("under 16 by year needs a guardian; 16 and over does not", async ({ page }) => {
    const id = runId();

    const none = await send(page, "POST", PATIENTS, child(id, "A", []));
    expect(none.status).toBe(403);
    expect(none.body.error?.code).toBe(CODE.required);

    const omitted = await send(page, "POST", PATIENTS, child(id, "B", null));
    expect(omitted.body.error?.code).toBe(CODE.required);

    // 16 by year — the birthday later this year does not matter.
    const sixteen = await send(page, "POST", PATIENTS, { ...child(id, "C", []), dateOfBirth: `${new Date().getFullYear() - 16}-12-31` });
    expect(sixteen.status, JSON.stringify(sixteen.body)).toBe(200);
    expect(sixteen.body.guardians).toEqual([]);

    // No birth date, no age, no requirement.
    const undated = await send(page, "POST", PATIENTS, { ...child(id, "D", []), dateOfBirth: null });
    expect(undated.status, JSON.stringify(undated.body)).toBe(200);
  });

  test("the group rules: at most 3, exactly 1 primary contact, the consent tick, complete details", async ({ page }) => {
    const id = runId();
    const primary = (tag: string) => guardian(id, tag, { isPrimaryContact: true });

    const four = await send(page, "POST", PATIENTS, child(id, "A", [primary("1"), guardian(id, "22"), guardian(id, "333"), guardian(id, "4444")]));
    expect(four.body.error?.code).toBe(CODE.tooMany);

    const twoPrimary = await send(page, "POST", PATIENTS, child(id, "B", [primary("1"), primary("22")]));
    expect(twoPrimary.body.error?.code).toBe(CODE.primary);

    const noPrimary = await send(page, "POST", PATIENTS, child(id, "C", [guardian(id, "1")]));
    expect(noPrimary.body.error?.code).toBe(CODE.primary);

    const unconsented = await send(page, "POST", PATIENTS, child(id, "D", [primary("1")], false));
    expect(unconsented.body.error?.code).toBe(CODE.consent);

    const noPhone = await send(page, "POST", PATIENTS, child(id, "E", [{ ...primary("1"), phone: " " }]));
    expect(noPhone.body.error?.code).toBe(CODE.incomplete);

    const otherBare = await send(page, "POST", PATIENTS, child(id, "F", [{ ...primary("1"), relation: RELATION.Other }]));
    expect(otherBare.body.error?.code).toBe(CODE.otherIncomplete);

    // "Khác" with the relation in words and the paper type, but no file: the file is optional for now.
    const otherNoFile = await send(
      page,
      "POST",
      PATIENTS,
      child(id, "G", [{ ...primary("1"), relation: RELATION.Other, relationNote: "Dượng", proofType: PROOF.PowerOfAttorney }]),
    );
    expect(otherNoFile.status, JSON.stringify(otherNoFile.body)).toBe(200);
    expect(otherNoFile.body.guardians?.[0]).toMatchObject({ relation: RELATION.Other, relationNote: "Dượng", proofType: PROOF.PowerOfAttorney });
  });

  test("a saved group survives an update that does not send it, and cannot be emptied", async ({ page }) => {
    const id = runId();
    const created = await send(
      page,
      "POST",
      PATIENTS,
      child(id, "A", [guardian(id, "1", { isPrimaryContact: true, relation: RELATION.Father }), guardian(id, "22")]),
    );
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body.guardians).toHaveLength(2);
    expect(created.body.guardians?.[0].consentedAt).toBeTruthy();

    // A separate GET reads the same group back from the database.
    const read = await send(page, "GET", `${PATIENTS}/${created.body.id}`);
    expect(read.body.guardians?.map((g) => [g.relation, g.isPrimaryContact])).toEqual([
      [RELATION.Father, true],
      [RELATION.Mother, false],
    ]);

    // Other screens update the record without the guardian popup: null keeps the group.
    const kept = await send(page, "PUT", `${PATIENTS}/${created.body.id}`, child(id, "A", null));
    expect(kept.status, JSON.stringify(kept.body)).toBe(200);
    expect(kept.body.guardians).toHaveLength(2);

    // Rewriting by id keeps the guardian's identity; dropping one removes it.
    const first = read.body.guardians![0];
    const trimmed = await send(
      page,
      "PUT",
      `${PATIENTS}/${created.body.id}`,
      child(id, "A", [{ ...guardian(id, "1", { isPrimaryContact: true }), id: first.id, fullName: "GH đổi tên" }]),
    );
    expect(trimmed.status, JSON.stringify(trimmed.body)).toBe(200);
    expect(trimmed.body.guardians).toHaveLength(1);
    expect(trimmed.body.guardians?.[0]).toMatchObject({ id: first.id, fullName: "GH đổi tên" });

    const emptied = await send(page, "PUT", `${PATIENTS}/${created.body.id}`, child(id, "A", []));
    expect(emptied.body.error?.code).toBe(CODE.required);
  });

  test("an older record that turns out to be under 16 is blocked until a guardian is added", async ({ page }) => {
    const id = runId();
    const adult = await send(page, "POST", PATIENTS, { ...child(id, "A", []), dateOfBirth: yearsAgo(30) });
    expect(adult.status, JSON.stringify(adult.body)).toBe(200);

    const corrected = await send(page, "PUT", `${PATIENTS}/${adult.body.id}`, child(id, "A", null));
    expect(corrected.body.error?.code).toBe(CODE.required);

    const withGuardian = await send(
      page,
      "PUT",
      `${PATIENTS}/${adult.body.id}`,
      child(id, "A", [guardian(id, "1", { isPrimaryContact: true })]),
    );
    expect(withGuardian.status, JSON.stringify(withGuardian.body)).toBe(200);
  });

  test("proof files: JPG / PNG / PDF up to 5MB, read back only inside the branch", async ({ page, browser }) => {
    test.setTimeout(60_000);
    const id = runId();

    const text = await send(page, "POST", DOCUMENTS, { fileName: "note.txt", type: "text/plain", bytes: [104, 105] });
    expect(text.body.error?.code).toBe(CODE.invalidDocument);

    // A .pdf name on bytes that are not a PDF is refused too.
    const fake = await send(page, "POST", DOCUMENTS, { fileName: "fake.pdf", type: "application/pdf", bytes: [1, 2, 3, 4, 5] });
    expect(fake.body.error?.code).toBe(CODE.invalidDocument);

    const huge = await send(page, "POST", DOCUMENTS, {
      fileName: "huge.pdf",
      type: "application/pdf",
      bytes: PDF_BYTES,
      padding: 5 * 1024 * 1024,
    });
    expect(huge.body.error?.code).toBe(CODE.invalidDocument);

    const pdf = await send(page, "POST", DOCUMENTS, { fileName: "uy-quyen.pdf", type: "application/pdf", bytes: PDF_BYTES });
    expect(pdf.status, JSON.stringify(pdf.body)).toBe(200);
    expect(pdf.body.fileName).toBe("uy-quyen.pdf");

    const saved = await send(
      page,
      "POST",
      PATIENTS,
      child(id, "A", [
        guardian(id, "1", {
          isPrimaryContact: true,
          relation: RELATION.Other,
          relationNote: "Người nuôi dưỡng",
          proofType: PROOF.PowerOfAttorney,
          proofBlobName: pdf.body.blobName,
          proofFileName: pdf.body.fileName,
        }),
      ]),
    );
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const holder = saved.body.guardians![0];
    expect(holder.proofFileName).toBe("uy-quyen.pdf");

    const documentUrl = `${PATIENTS}/${saved.body.id}/guardians/${holder.id}/document`;
    const download = await page.evaluate(async ({ url, branch }) => {
      const res = await fetch(url, { credentials: "include", headers: { "X-Clinic-Branch-Id": branch } });
      return { status: res.status, head: new TextDecoder().decode((await res.arrayBuffer()).slice(0, 5)) };
    }, { url: documentUrl, branch: BRANCH_ONE });
    expect(download).toEqual({ status: 200, head: "%PDF-" });

    // A blob name made up by the client (not from this branch's upload) is refused.
    const forgedProof = { proofBlobName: "patient-guardians/other/x.pdf", proofFileName: "x.pdf" };
    const forged = await send(
      page,
      "POST",
      PATIENTS,
      child(id, "B", [
        guardian(id, "1", {
          isPrimaryContact: true,
          relation: RELATION.Other,
          relationNote: "Người nuôi dưỡng",
          proofType: PROOF.PowerOfAttorney,
          ...forgedProof,
        }),
      ]),
    );
    expect(forged.body.error?.code).toBe(CODE.invalidDocument);

    // A paper only belongs to "Khác": on a parent the server drops it rather than keep it.
    const parent = await send(page, "POST", PATIENTS, child(id, "C", [guardian(id, "1", { isPrimaryContact: true, ...forgedProof })]));
    expect(parent.status, JSON.stringify(parent.body)).toBe(200);
    expect(parent.body.guardians?.[0]).toMatchObject({ proofBlobName: null, proofFileName: null, proofType: null });

    // Another branch cannot read the paper.
    const elsewhere = await browser.newPage();
    await login(elsewhere, BRANCH2_USER);
    await elsewhere.goto("/patient");
    const status = await sendAsOwnBranch(elsewhere, documentUrl);
    expect([403, 404]).toContain(status);
    await elsewhere.close();
  });
});
