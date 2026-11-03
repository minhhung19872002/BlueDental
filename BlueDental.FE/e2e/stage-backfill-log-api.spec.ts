import { expect, test, type Page } from "@playwright/test";
import { login, runId } from "./fixtures/auth";
import { call, STAGES, type LaboLine } from "./fixtures/laboApi";
import { createDentist, deleteDentist, openDentistSession, resetDentistLeaves } from "./fixtures/restrictedDentist";
import { clinicDay, freshLine, postDated, type StageDto } from "./fixtures/stageDateLock";
import { doctorId } from "./fixtures/warrantyApi";

/**
 * BA 2026-11-02, second round (docs/testing/features/labo-workflow.md, F-88):
 *
 * - a "Tiếp tục công đoạn" dated before the row it continues is not refused:
 *   it is written as frozen history (isBackfill), takes no teeth, and the row
 *   it came from stays the one being worked; an admin may delete it;
 * - Nội dung điều trị and Ghi chú stay editable on every row, finished or
 *   continued, and every change to a công đoạn is logged for an admin to read.
 *
 * Every call is a real HTTP request from inside the logged-in page. No route is
 * intercepted, and every write is read back with a separate request.
 */

/** TreatmentStageChangeAction on the wire. */
const Action = {
  NoteChanged: 1,
  RemarkChanged: 2,
  DetailsUpdated: 3,
  Completed: 4,
  Reverted: 5,
  ImageAdded: 6,
  ImageRemoved: 7,
  Deleted: 8,
} as const;

const PNG_1PX = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

interface BackfillStageDto extends StageDto {
  isBackfill: boolean;
  note: string | null;
  remark: string | null;
}

interface ChangeLogDto {
  id: string;
  treatmentStageId: string;
  action: number;
  before: string | null;
  after: string | null;
  actorName: string | null;
  occurredAt: string;
}

/** The slip-wide read behind "Lịch sử chỉnh sửa": the row named, fields by name. */
interface SlipChangeLogDto extends ChangeLogDto {
  stageName: string;
  stageTreatmentDate: string | null;
  stageDeleted: boolean;
  changes: { field: string; before: string | null; after: string | null }[];
}

async function stage(page: Page, line: LaboLine, id: string): Promise<BackfillStageDto> {
  const res = await call<BackfillStageDto>(page, `${STAGES}/${id}`, { branchId: line.branchId });
  expect(res.status, res.text).toBe(200);
  return res.body as BackfillStageDto;
}

async function continueStage(
  page: Page,
  line: LaboLine,
  id: string,
  extra: { treatmentDate?: string; toothCodes?: number[] } = {},
): Promise<string> {
  const next = await call<StageDto>(page, `${STAGES}/${id}/continue`, {
    method: "POST",
    branchId: line.branchId,
    json: { staffId: await doctorId(page, line.branchId), note: `e2e tiếp tục ${runId()}`, ...extra },
  });
  expect(next.status, next.text).toBe(200);
  return next.body.id!;
}

function post(page: Page, line: LaboLine, id: string, action: "complete" | "revert-status") {
  return call(page, `${STAGES}/${id}/${action}`, { method: "POST", branchId: line.branchId });
}

function put(page: Page, line: LaboLine, id: string, field: "note" | "remark", value: string | null) {
  return call<BackfillStageDto>(page, `${STAGES}/${id}/${field}`, {
    method: "PUT",
    branchId: line.branchId,
    json: { [field]: value },
  });
}

async function logs(page: Page, line: LaboLine, id: string): Promise<ChangeLogDto[]> {
  const res = await call<ChangeLogDto[]>(page, `${STAGES}/${id}/change-logs`, { branchId: line.branchId });
  expect(res.status, res.text).toBe(200);
  return res.body as ChangeLogDto[];
}

async function slipLogs(page: Page, line: LaboLine): Promise<SlipChangeLogDto[]> {
  const res = await call<SlipChangeLogDto[]>(page, `${STAGES}/change-logs?treatmentId=${line.planId}`, {
    branchId: line.branchId,
  });
  expect(res.status, res.text).toBe(200);
  return res.body as SlipChangeLogDto[];
}

/** "Tải ảnh" on a row: the picture goes up through patient-images with the stage's id. */
function uploadPicture(page: Page, line: LaboLine, stageId: string) {
  return page.evaluate(
    async ({ line, stageId, png }) => {
      const xsrf = document.cookie
        .split("; ")
        .find((c) => c.startsWith("XSRF-TOKEN="))
        ?.substring("XSRF-TOKEN=".length);
      const form = new FormData();
      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
      form.append("file", new Blob([bytes], { type: "image/png" }), "cong-doan.png");
      form.append("patientId", line.patientId);
      form.append("clinicBranchId", line.branchId);
      form.append("treatmentStageId", stageId);
      const res = await fetch("/api/v1/app/patient-images", {
        method: "POST",
        credentials: "include",
        body: form,
        headers: {
          accept: "application/json",
          "X-Clinic-Branch-Id": line.branchId,
          ...(xsrf ? { RequestVerificationToken: decodeURIComponent(xsrf) } : {}),
        },
      });
      const text = await res.text();
      return { status: res.status, text, id: res.ok ? (JSON.parse(text) as { id: string }).id : null };
    },
    { line, stageId, png: PNG_1PX },
  );
}

test.describe("Back-dated Tiếp tục + edit-all with a change log (F-88, BA round 2)", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("a back-dated Tiếp tục is frozen history; the row it came from keeps its teeth and works on", async ({
    page,
  }) => {
    const line = await freshLine(page, { teeth: [36, 37] });
    const source = await postDated(page, line, [36, 37], clinicDay(-1));

    const backfill = await continueStage(page, line, source, { treatmentDate: clinicDay(-4), toothCodes: [36] });

    const written = await stage(page, line, backfill);
    expect(written.isBackfill).toBe(true);
    expect(written.isSuperseded).toBe(true);

    const kept = await stage(page, line, source);
    expect(kept.isSuperseded).toBe(false);
    expect(kept.continuedToothCodes).toEqual([]);
    expect(kept.isDateLocked).toBe(false);

    // Frozen: Hoàn thành refused; pictures, Nội dung and Ghi chú still go on.
    expect((await post(page, line, backfill, "complete")).status).toBe(403);
    const picture = await uploadPicture(page, line, backfill);
    expect(picture.status, picture.text).toBe(200);
    expect((await put(page, line, backfill, "note", "- ghi bù")).status).toBe(200);
    expect((await stage(page, line, backfill)).note).toBe("- ghi bù");

    // The source is the one being worked.
    expect((await post(page, line, source, "complete")).status).toBe(200);

    // An admin deletes the back-dated row; the source keeps every tooth.
    const deleted = await call(page, `${STAGES}/${backfill}`, { method: "DELETE", branchId: line.branchId });
    expect([200, 204], deleted.text).toContain(deleted.status);
    expect((await call(page, `${STAGES}/${backfill}`, { branchId: line.branchId })).status).toBe(404);
    const after = await stage(page, line, source);
    expect(after.isSuperseded).toBe(false);
    expect(after.continuedToothCodes).toEqual([]);
  });

  test("a Tiếp tục on the same day still hands the teeth on", async ({ page }) => {
    const line = await freshLine(page, { teeth: [36] });
    const source = await postDated(page, line, [36], clinicDay(-1));
    const next = await continueStage(page, line, source, { treatmentDate: clinicDay(-1) });

    expect((await stage(page, line, next)).isBackfill).toBe(false);
    const handed = await stage(page, line, source);
    expect(handed.isSuperseded).toBe(true);
    expect(handed.continuedToothCodes).toEqual([36]);
  });

  test("Nội dung and Ghi chú save on a finished and on a continued row, and each change is logged", async ({
    page,
  }) => {
    const id = runId();
    const line = await freshLine(page, { teeth: [36] });
    const first = await postDated(page, line, [36], clinicDay(-1));
    const next = await continueStage(page, line, first, { treatmentDate: clinicDay(0) });
    expect((await stage(page, line, first)).isSuperseded).toBe(true);

    // Continued row.
    const note = await put(page, line, first, "note", `- sửa nội dung ${id}`);
    expect(note.status, note.text).toBe(200);
    const remark = await put(page, line, first, "remark", `ghi chú ${id}`);
    expect(remark.status, remark.text).toBe(200);
    const readFirst = await stage(page, line, first);
    expect(readFirst.note).toBe(`- sửa nội dung ${id}`);
    expect(readFirst.remark).toBe(`ghi chú ${id}`);

    // Finished row.
    expect((await post(page, line, next, "complete")).status).toBe(200);
    expect((await put(page, line, next, "note", `- sau hoàn thành ${id}`)).status).toBe(200);
    expect((await stage(page, line, next)).note).toBe(`- sau hoàn thành ${id}`);
    expect((await post(page, line, next, "revert-status")).status).toBe(200);

    // Saving the same text again writes nothing.
    expect((await put(page, line, first, "remark", `ghi chú ${id}`)).status).toBe(200);

    const firstLog = await logs(page, line, first);
    const firstNote = firstLog.find((one) => one.action === Action.NoteChanged)!;
    expect(firstNote.before).toMatch(/^e2e khoá ngày /);
    expect(firstNote.after).toBe(`- sửa nội dung ${id}`);
    expect(firstNote.actorName).toBeTruthy();
    const remarks = firstLog.filter((one) => one.action === Action.RemarkChanged);
    expect(remarks).toHaveLength(1);
    expect(remarks[0].before).toBeNull();
    expect(remarks[0].after).toBe(`ghi chú ${id}`);

    const nextActions = (await logs(page, line, next)).map((one) => one.action);
    expect(nextActions).toEqual([Action.Completed, Action.NoteChanged, Action.Reverted]);
  });

  test("Tải ảnh, xoá ảnh and Xóa công đoạn are logged; the log outlives the row", async ({ page }) => {
    const line = await freshLine(page, { teeth: [36] });
    const made = await postDated(page, line, [36], clinicDay(0));

    const picture = await uploadPicture(page, line, made);
    expect(picture.status, picture.text).toBe(200);
    const removed = await call(page, `/api/v1/app/patient-images/${picture.id}`, {
      method: "DELETE",
      branchId: line.branchId,
    });
    expect([200, 204], removed.text).toContain(removed.status);

    const deleted = await call(page, `${STAGES}/${made}`, { method: "DELETE", branchId: line.branchId });
    expect([200, 204], deleted.text).toContain(deleted.status);

    const log = await logs(page, line, made);
    expect(log.map((one) => one.action)).toEqual([Action.ImageAdded, Action.ImageRemoved, Action.Deleted]);
    expect(log[0].after).toContain(picture.id!);
    expect(log[1].before).toContain(picture.id!);
    // The whole row as it stood, kept in the delete entry.
    expect(JSON.parse(log[2].before!)).toMatchObject({ Teeth: [36] });
  });

  test("the slip's log names each row and field, newest first, a deleted row's too", async ({ page }) => {
    const id = runId();
    const line = await freshLine(page, { teeth: [36, 37] });
    const older = await postDated(page, line, [36], clinicDay(-2));
    const newer = await postDated(page, line, [37], clinicDay(-1));

    expect((await put(page, line, older, "note", `- nội dung mới ${id}`)).status).toBe(200);
    const deleted = await call(page, `${STAGES}/${newer}`, { method: "DELETE", branchId: line.branchId });
    expect([200, 204], deleted.text).toContain(deleted.status);

    const log = await slipLogs(page, line);
    expect(log.map((one) => one.action)).toEqual([Action.Deleted, Action.NoteChanged]);
    const times = log.map((one) => Date.parse(one.occurredAt));
    expect(times[0]).toBeGreaterThanOrEqual(times[1]);

    const [gone, note] = log;
    expect(gone.treatmentStageId).toBe(newer);
    expect(gone.stageDeleted).toBe(true);
    expect(gone.stageName).toBe(line.serviceName);
    expect(gone.stageTreatmentDate).toBe(clinicDay(-1));
    // The row as it stood: its teeth, and its doctor by name, not by id.
    expect(gone.changes.find((c) => c.field === "Teeth")).toMatchObject({ before: "37", after: null });
    const doctor = gone.changes.find((c) => c.field === "Staff");
    expect(doctor?.before).toBeTruthy();
    expect(doctor?.before).not.toMatch(/^[0-9a-f]{8}-/);

    expect(note.treatmentStageId).toBe(older);
    expect(note.stageDeleted).toBe(false);
    expect(note.changes).toHaveLength(1);
    expect(note.changes[0].field).toBe("Note");
    expect(note.changes[0].before).toMatch(/^e2e khoá ngày /);
    expect(note.changes[0].after).toBe(`- nội dung mới ${id}`);

    // The one row's own log still reads oldest first.
    expect((await logs(page, line, older)).map((one) => one.action)).toEqual([Action.NoteChanged]);
  });

  test("reading the change log needs Công đoạn › Xóa", async ({ page, browser }) => {
    const id = runId();
    const fullName = `BAC SI LOG CD ${id}`;
    const userName = `bslogcd${id}`;
    const password = "Bacsi@123456";
    const line = await freshLine(page, { teeth: [36] });
    const made = await postDated(page, line, [36], clinicDay(0));

    await resetDentistLeaves(page, ["treatmentStage.delete"]);
    await createDentist(page, fullName, userName, password);
    const dentist = await openDentistSession(browser, userName, password);
    try {
      const refused = await call(dentist.page, `${STAGES}/${made}/change-logs`, { branchId: line.branchId });
      expect(refused.status, refused.text).toBe(403);
      const slip = await call(dentist.page, `${STAGES}/change-logs?treatmentId=${line.planId}`, {
        branchId: line.branchId,
      });
      expect(slip.status, slip.text).toBe(403);
    } finally {
      await dentist.context.close();
      await deleteDentist(page, fullName);
    }
  });
});
