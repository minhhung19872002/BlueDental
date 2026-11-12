import { useState } from "react";
import { Button, Spin } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { RecordSetPlanDto } from "../../../api/medicalRecordSetApi";
import { SlipPickTable } from "./SlipPickTable";

/**
 * Bệnh án for a patient with no bộ hồ sơ yet: a white card of the treatment
 * slips not in any set — tick the ones of one course of treatment and
 * "Tạo hồ sơ" opens the set dialog with them already picked. The intro and the
 * nine forms above it are gone (the clinic's ask, 2026-10-29).
 */

interface Props {
  /** The slips no live set holds, cancelled ones left out. */
  freeSlips: RecordSetPlanDto[];
  loading: boolean;
  /** Absent without the right to create a set. */
  onCreate?: (planIds: string[]) => void;
}

export function RecordSetEmptyState({ freeSlips, loading, onCreate }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const toggle = (planId: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(planId);
      else next.delete(planId);
      return next;
    });

  const toggleAll = (checked: boolean) =>
    setSelected(checked ? new Set(freeSlips.map((plan) => plan.treatmentPlanId)) : new Set());

  return (
    <section className="pd-pane pd-pane--fill rs-empty-pane">
      <div className="rs-free">
        <header className="rs-free-head">
          <div>
            <h3>{t("Patient:RecordSet:FreeTitle")}</h3>
            <p>{t("Patient:RecordSet:FreeHint")}</p>
          </div>
          <span className="rs-count-chip">
            {t("Patient:RecordSet:Picked", selected.size, freeSlips.length)}
          </span>
          {onCreate && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={selected.size === 0}
              onClick={() => onCreate([...selected])}
            >
              {t("Patient:RecordSet:CreateShort")}
            </Button>
          )}
        </header>

        <Spin spinning={loading} className="rs-free-body">
          {freeSlips.length === 0 && !loading ? (
            <p className="rs-free-none">{t("Patient:RecordSet:NoFreeSlips")}</p>
          ) : (
            <div className="rs-slips-wrap">
              <SlipPickTable
                plans={freeSlips}
                selected={selected}
                columns="free"
                setId={null}
                onToggle={toggle}
                onToggleAll={toggleAll}
              />
            </div>
          )}
        </Spin>
      </div>
    </section>
  );
}
