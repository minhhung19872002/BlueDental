import { useMemo } from "react";
import { Button, Modal } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { t, tRich } from "@/lib/i18n";
import type { PendingChange } from "../../types/workSchedule";
import { changeKind, type ChangeKind } from "../../utils/workScheduleShift";
import { shiftLabel, shortDate } from "../../utils/workScheduleText";

interface Props {
  open: boolean;
  changes: readonly PendingChange[];
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const KIND_KEY: Record<ChangeKind, string> = {
  new: "Timekeeping:Board:Kind:New",
  edit: "Timekeeping:Board:Kind:Edit",
  cancel: "Timekeeping:Board:Kind:Cancel",
};

function detailOf(change: PendingChange): string {
  const kind = changeKind(change);
  if (kind === "cancel") return shiftLabel(change.from);
  if (kind === "new") return shiftLabel(change.to);
  return `${shiftLabel(change.from)} → ${shiftLabel(change.to)}`;
}

function byPerson(changes: readonly PendingChange[]) {
  const people = new Map<string, { name: string; items: PendingChange[] }>();
  for (const c of changes) {
    const entry = people.get(c.staffId) ?? { name: c.staffName, items: [] };
    entry.items.push(c);
    people.set(c.staffId, entry);
  }
  return [...people.entries()]
    .map(([staffId, p]) => ({ staffId, name: p.name, items: p.items.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
}

/**
 * "Lưu n thay đổi lịch làm việc?" — every unsaved change, by person. Drawn as
 * the BA prototype's card (icon tile + title, no X, no header/footer rules),
 * not the Danh mục AppDialog shell.
 */
export function SaveScheduleDialog({ open, changes, saving, onConfirm, onClose }: Props) {
  const people = useMemo(() => byPerson(changes), [changes]);
  const counts = useMemo(() => {
    const tally: Record<ChangeKind, number> = { new: 0, edit: 0, cancel: 0 };
    for (const c of changes) tally[changeKind(c)]++;
    return tally;
  }, [changes]);

  return (
    <Modal
      open={open}
      width="min(540px, calc(100vw - 32px))"
      centered
      closable={false}
      footer={null}
      className="ws-confirm-modal"
      // In antd's title slot so the dialog is named by it; CSS drops the rule under it.
      title={
        <span className="ws-confirm-head">
          <span className="ws-confirm-icon" aria-hidden="true">
            <SaveOutlined />
          </span>
          <span className="ws-confirm-title">{t("Timekeeping:Board:Confirm:Title", changes.length)}</span>
        </span>
      }
      onCancel={saving ? undefined : onClose}
      destroyOnHidden
    >
      <div className="ws-confirm">
        <p className="ws-confirm-note">
          {tRich("Timekeeping:Board:Confirm:Note", <b key="f">{t("Timekeeping:Board:Confirm:Future")}</b>)}
        </p>
        <div className="ws-confirm-chips">
          <span className="ws-chg ws-chg--new">{t("Timekeeping:Board:Confirm:NewCount", counts.new)}</span>
          <span className="ws-chg ws-chg--edit">{t("Timekeeping:Board:Confirm:EditCount", counts.edit)}</span>
          <span className="ws-chg ws-chg--cancel">{t("Timekeeping:Board:Confirm:CancelCount", counts.cancel)}</span>
        </div>
        <div className="ws-confirm-list">
          {people.map((p) => (
            <div key={p.staffId}>
              <div className="ws-confirm-person">
                <span className="ws-confirm-name">{p.name}</span>
                <span className="ws-confirm-count">{t("Timekeeping:Board:Confirm:PersonCount", p.items.length)}</span>
              </div>
              {p.items.map((c) => {
                const kind = changeKind(c);
                return (
                  <div key={c.date} className="ws-confirm-item">
                    <span className="ws-confirm-date">{shortDate(c.date)}</span>
                    <span className={`ws-chg ws-chg--tag ws-chg--${kind}`}>{t(KIND_KEY[kind])}</span>
                    <span className="ws-confirm-detail">{detailOf(c)}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="ws-confirm-foot">
          <Button className="ws-confirm-btn" disabled={saving} onClick={onClose}>
            {t("Timekeeping:Board:Confirm:Back")}
          </Button>
          <Button
            type="primary"
            className="ws-confirm-btn ws-confirm-btn--primary"
            loading={saving}
            disabled={saving || changes.length === 0}
            onClick={onConfirm}
          >
            {t("Timekeeping:Board:Confirm:Save")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
