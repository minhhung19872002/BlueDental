import type { ReactNode } from "react";
import dayjs from "dayjs";
import { t } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import { LABO_CASE_TYPE, type LaboOrderDto } from "@/features/labo/api/laboApi";
import {
  LABO_BLOCK_KIND,
  LABO_FIELD_TYPE,
  type LaboExtraFormEntryDto,
  type LaboFormBlockDto,
} from "@/features/labo/api/laboFormTemplateApi";
import { blockTitle, sectionEntries, spanClass } from "../request-slip/slipLayout";
import { PrintCaseBoxes, PrintShadeTable, PrintToothChart } from "./LaboRequestSlipPrintParts";
import { dashed } from "./laboOrderFacts";
import { laboFinishLinesText, laboWorkOf } from "./laboRequestSlipText";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <p className="pd-slip-print-field">
      <b>{label}:</b> <span>{children}</span>
    </p>
  );
}

/** An answer as the paper reads it: Có / Không, dd/MM/yyyy, several joined by commas. */
function answerText(entry: LaboExtraFormEntryDto): string {
  const shown = entry.values.map((value) => {
    if (entry.type === LABO_FIELD_TYPE.YesNo) return t(value === "true" ? "Common:Yes" : "Common:No");
    if (entry.type === LABO_FIELD_TYPE.Date) return dayjs(value).format("DD/MM/YYYY");
    return value;
  });
  return shown.join(", ");
}

/** Each part of the printed slip under a heading; the fixed sheet and a template's layout both place them. */
function printParts(order: LaboOrderDto) {
  const picked = new Set(order.teeth.map((item) => item.toothNumber));
  return {
    info: (title: string) => (
      <>
        <h3>{title}</h3>
        <div className="pd-slip-print-line">
          <Field label={t("Labo:Slip:CaseType")}>
            <PrintCaseBoxes redo={order.caseType === LABO_CASE_TYPE.Redo} />
          </Field>
          <Field label={t("Labo:Slip:SentAt")}>{dashed(formatDate(order.sentAt))}</Field>
          <Field label={t("Labo:Slip:DueAt")}>{dashed(formatDate(order.dueAt))}</Field>
        </div>
      </>
    ),
    restoration: (title: string) => (
      <>
        <h3>{title}</h3>
        <p className="pd-slip-print-text">{dashed(laboWorkOf(order) ?? "")}</p>
      </>
    ),
    shade: (title: string) => (
      <>
        <h3>{title}</h3>
        <PrintShadeTable zones={order.teeth[0]?.shadeZones} />
      </>
    ),
    teeth: (title: string) => (
      <>
        <h3>{title}</h3>
        <PrintToothChart picked={picked} />
        <Field label={t("Patient:Payment:Quantity")}>{order.quantity}</Field>
      </>
    ),
    finishLines: (title: string) => (
      <>
        <h3>{title}</h3>
        <p className="pd-slip-print-text">{dashed(laboFinishLinesText(order))}</p>
      </>
    ),
    notes: (title: string) => (
      <>
        <h3>{title}</h3>
        <p className="pd-slip-print-text pd-slip-print-notes">{dashed(order.notes ?? "")}</p>
      </>
    ),
  };
}

type PrintParts = ReturnType<typeof printParts>;

const SYSTEM_PRINT: Record<number, (parts: PrintParts, title: string) => ReactNode> = {
  [LABO_BLOCK_KIND.Info]: (parts, title) => parts.info(title),
  [LABO_BLOCK_KIND.Restoration]: (parts, title) => parts.restoration(title),
  [LABO_BLOCK_KIND.Shade]: (parts, title) => parts.shade(title),
  [LABO_BLOCK_KIND.Teeth]: (parts, title) => parts.teeth(title),
  [LABO_BLOCK_KIND.FinishLine]: (parts, title) => parts.finishLines(title),
  [LABO_BLOCK_KIND.Notes]: (parts, title) => parts.notes(title),
};

/** A template's section on paper: each field as «Nhãn: câu trả lời». */
function PrintSection({ title, entries }: { title: string; entries: LaboExtraFormEntryDto[] }) {
  return (
    <>
      <h3>{title}</h3>
      {entries.map((entry) => (
        <Field key={entry.key} label={entry.label}>
          {dashed(answerText(entry))}
        </Field>
      ))}
    </>
  );
}

/** The body laid out by the order's Mẫu phiếu (F-94): its shown blocks in order, as wide as the template says. */
function BlockPrintBody({ order, blocks }: { order: LaboOrderDto; blocks: LaboFormBlockDto[] }) {
  const parts = printParts(order);
  const entries = order.extraForm?.entries ?? [];
  return (
    <div className="pd-slip-print-blocks">
      {blocks
        .filter((block) => block.visible)
        .map((block, index) => (
          <section key={block.key ?? `system-${block.kind}-${index}`} className={`pd-slip-print-block ${spanClass(block.span)}`}>
            {block.kind === LABO_BLOCK_KIND.Custom ? (
              <PrintSection title={blockTitle(block)} entries={sectionEntries(blocks, entries, block)} />
            ) : (
              SYSTEM_PRINT[block.kind]?.(parts, blockTitle(block))
            )}
          </section>
        ))}
    </div>
  );
}

/** The fixed sheet (F-91), for orders with no Mẫu phiếu or a copy made before layouts. */
function FixedPrintBody({ order }: { order: LaboOrderDto }) {
  const parts = printParts(order);
  return (
    <>
      {parts.info(t("Labo:Slip:Info"))}
      {parts.restoration(t("Labo:Slip:Restoration"))}
      <div className="pd-slip-print-pair">
        <section>{parts.shade(t("Labo:Slip:Shade"))}</section>
        <section>{parts.teeth(t("Labo:Slip:Teeth"))}</section>
      </div>
      {parts.finishLines(t("Labo:Slip:FinishLine"))}
      {parts.notes(t("Labo:Slip:Request"))}
    </>
  );
}

/** The printed slip's body: the template's layout when the order holds one, else the fixed sheet. */
export function LaboRequestSlipPrintBody({ order }: { order: LaboOrderDto }) {
  const blocks = order.extraForm?.blocks ?? [];
  return blocks.length > 0 ? <BlockPrintBody order={order} blocks={blocks} /> : <FixedPrintBody order={order} />;
}
