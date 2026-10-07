import type { ReactNode } from "react";
import { Button, Collapse } from "antd";
import { CheckCircleFilled, DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { GUARDIAN_LIMITS } from "../../types/patient";
import { initialsOf, isGuardianComplete, RELATION_LABEL, type GuardianDraft } from "../../utils/guardian";

interface Props {
  guardians: GuardianDraft[];
  activeKeys: string[];
  onActiveKeysChange: (keys: string[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderForm: (index: number) => ReactNode;
}

function PanelHeader({ guardian, index }: { guardian: GuardianDraft; index: number }) {
  const complete = isGuardianComplete(guardian);
  const name = guardian.fullName?.trim() || t("Patient:Guardian:Numbered", index + 1);

  return (
    <div className="bd-guardian-panel-head">
      <span className="bd-guardian-avatar bd-guardian-avatar--sm" aria-hidden>
        {initialsOf(guardian.fullName ?? "")}
      </span>
      <div className="bd-min0">
        <strong>{name}</strong>
        {guardian.relation && <span className="bd-guardian-panel-relation">{t(RELATION_LABEL[guardian.relation])}</span>}
        {guardian.isPrimaryContact && <span className="bd-guardian-panel-primary">{t("Patient:Guardian:PrimaryBadge")}</span>}
      </div>
      <span className={complete ? "bd-guardian-status bd-guardian-status--done" : "bd-guardian-status"}>
        {complete ? <CheckCircleFilled /> : <EditOutlined />}
        {complete ? t("Patient:Guardian:StatusComplete") : t("Patient:Guardian:StatusEditing")}
      </span>
    </div>
  );
}

/**
 * Two guardians or more: the "NHÓM NGƯỜI GIÁM HỘ" header and an accordion of
 * forms. Every panel is rendered even while folded, so a save validates them all.
 */
export function GuardianGroupList({ guardians, activeKeys, onActiveKeysChange, onAdd, onRemove, renderForm }: Props) {
  const full = guardians.length >= GUARDIAN_LIMITS.maxPerPatient;

  return (
    <section className="bd-guardian-group">
      <header className="bd-guardian-group-head">
        <div>
          <h3>{t("Patient:Guardian:GroupTitle", guardians.length)}</h3>
          <p>{t("Patient:Guardian:GroupRules", GUARDIAN_LIMITS.maxPerPatient)}</p>
        </div>
        <Button icon={<PlusOutlined />} disabled={full} onClick={onAdd}>
          {t("Patient:Guardian:Add")}
        </Button>
      </header>

      <Collapse
        activeKey={activeKeys}
        onChange={(keys) => onActiveKeysChange(Array.isArray(keys) ? keys : [keys])}
        items={guardians.map((guardian, index) => ({
          key: guardian.uid,
          forceRender: true,
          label: <PanelHeader guardian={guardian} index={index} />,
          extra: (
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t("Patient:Guardian:DeleteNumbered", index + 1)}
              onClick={(event) => {
                // The delete sits on the header; it must not also fold the panel.
                event.stopPropagation();
                onRemove(index);
              }}
            />
          ),
          children: renderForm(index),
        }))}
      />
    </section>
  );
}
