import { useState } from "react";
import { Spin } from "antd";
import { toast } from "sonner";
import { AppDialog } from "@/components/AppDialog";
import { PatientSearchSelect } from "@/components/SearchSelect";
import { useT } from "@/lib/i18n";
import type { XrayInboxItemViewModel, XraySuggestionViewModel } from "../api/xrayInboxAdapters";
import type { XraySuggestionReason } from "../api/xrayInboxApi";
import { useAssignXrayInboxItem } from "../api/xrayInboxMutations";
import { useXraySuggestions } from "../api/xrayInboxQueries";

interface Props {
  item: XrayInboxItemViewModel | null;
  onClose: () => void;
}

const REASON_KEYS: Record<XraySuggestionReason, string> = {
  1: "XrayInbox:ReasonCode",
  2: "XrayInbox:ReasonNameYear",
  3: "XrayInbox:ReasonName",
};

/**
 * "Gán hồ sơ" (F-95). The owner's rule: a name and birth year are never enough
 * to file a film on their own, so the records they point to are only offered
 * here, above a search over every record; nothing is filed until "Gán" is pressed.
 */
export function XrayAssignDialog({ item, onClose }: Props) {
  const t = useT();
  const suggestions = useXraySuggestions(item?.id ?? null);
  const assign = useAssignXrayInboxItem();
  const [patientId, setPatientId] = useState<string | undefined>();

  const handleClose = () => {
    setPatientId(undefined);
    onClose();
  };

  const handleSave = () => {
    if (!item || !patientId) return;
    assign.mutate(
      { id: item.id, patientId },
      {
        onSuccess: () => {
          toast.success(t("XrayInbox:Assigned"));
          handleClose();
        },
      },
    );
  };

  const suggested = suggestions.data ?? [];
  const pickedSuggestion = suggested.some((s) => s.patientId === patientId);

  return (
    <AppDialog
      open={item !== null}
      title={t("XrayInbox:AssignTitle")}
      subtitle={item?.fileName}
      width={560}
      canSave={Boolean(patientId)}
      saving={assign.isPending}
      saveLabel={t("XrayInbox:AssignSave")}
      onSave={handleSave}
      onClose={handleClose}
    >
      <div className="xi-assign">
        {item && <img className="xi-assign-preview" src={item.url} alt={item.fileName} />}
        <div className="xi-assign-label">{t("XrayInbox:Suggestions")}</div>
        {suggestions.isLoading ? (
          <Spin size="small" />
        ) : (
          <SuggestionList items={suggested} pickedId={patientId} onPick={setPatientId} />
        )}
        <div className="xi-assign-label">{t("XrayInbox:SearchRecord")}</div>
        <PatientSearchSelect
          value={pickedSuggestion ? undefined : patientId}
          placeholder={t("XrayInbox:SearchPlaceholder")}
          allowClear
          onChange={setPatientId}
        />
      </div>
    </AppDialog>
  );
}

interface ListProps {
  items: XraySuggestionViewModel[];
  pickedId: string | undefined;
  onPick: (patientId: string) => void;
}

function SuggestionList({ items, pickedId, onPick }: ListProps) {
  const t = useT();
  if (items.length === 0) return <div className="xi-assign-empty">{t("XrayInbox:NoSuggestions")}</div>;

  return (
    <div className="xi-suggestions" role="radiogroup" aria-label={t("XrayInbox:Suggestions")}>
      {items.map((s) => (
        <button
          key={s.patientId}
          type="button"
          role="radio"
          aria-checked={s.patientId === pickedId}
          className={["xi-suggestion", s.patientId === pickedId && "xi-suggestion--picked"]
            .filter(Boolean)
            .join(" ")}
          onClick={() => onPick(s.patientId)}
        >
          <span className="xi-suggestion-name">{s.label}</span>
          <span className="xi-suggestion-reason">{t(REASON_KEYS[s.reason])}</span>
        </button>
      ))}
    </div>
  );
}
