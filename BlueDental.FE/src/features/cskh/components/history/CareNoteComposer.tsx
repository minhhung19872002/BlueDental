import { useState } from "react";
import { Button, Input } from "antd";
import { t } from "@/lib/i18n";
import { NOTE_LIMITS, useCreateNote, type NoteOutcome } from "../../api/careNoteApi";
import { NOTE_OUTCOMES, outcomeLabel } from "../notes/OutcomePill";

/**
 * "Ghi nhận chăm sóc" at the top of the history (BA P2210: "trên cùng luôn có
 * 1 chat box như vầy để user có thể tự nhập ở đây luôn"): free text, and the
 * fixed "Kết quả cuộc gọi" tags for a quick note. A tag alone is a note too.
 * What is saved here shows in the Zalo chat's notes as well.
 */
export function CareNoteComposer({ patientId }: { patientId: string }) {
  const [content, setContent] = useState("");
  const [outcome, setOutcome] = useState<NoteOutcome | null>(null);
  const create = useCreateNote();
  const text = content.trim() || (outcome ? outcomeLabel(outcome) : "");

  const handleSave = () =>
    create.mutate(
      { owner: { kind: "patient", id: patientId }, input: { content: text, outcome } },
      {
        onSuccess: () => {
          setContent("");
          setOutcome(null);
        },
      },
    );

  return (
    <section className="ch-card ch-composer" aria-label={t("CSKH:History:Compose")}>
      <h3 className="ch-card-title">{t("CSKH:History:Compose")}</h3>
      <Input.TextArea
        aria-label={t("CSKH:History:Compose")}
        placeholder={t("CSKH:History:ComposePlaceholder")}
        autoSize={{ minRows: 2, maxRows: 6 }}
        maxLength={NOTE_LIMITS.content}
        value={content}
        disabled={create.isPending}
        onChange={(event) => setContent(event.target.value)}
      />
      <div className="ch-composer-foot">
        <span className="ch-composer-label">{t("CSKH:History:CallResult")}</span>
        {NOTE_OUTCOMES.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={outcome === value}
            className={["ch-outcome", outcome === value && "ch-outcome--on"].filter(Boolean).join(" ")}
            onClick={() => setOutcome((current) => (current === value ? null : value))}
          >
            {outcomeLabel(value)}
          </button>
        ))}
        <Button
          className="ch-composer-save"
          loading={create.isPending}
          disabled={!text || create.isPending}
          onClick={handleSave}
        >
          {t("CSKH:Inbox:NoteSave")}
        </Button>
      </div>
    </section>
  );
}
