import { Modal } from "antd";
import { useSearchParams } from "react-router-dom";
import { PillTabs } from "@/components/PillTabs";
import { t } from "@/lib/i18n";
import { usePatientLaboOrders } from "@/features/labo/api/laboApi";
import { LaboChildForm } from "./LaboChildForm";
import { LaboNewOrderTab } from "./LaboNewOrderTab";
import {
  LABO_MODAL_KEYS,
  LABO_MODAL_LABELS,
  LABO_MODAL_PARAM,
  LABO_ROW_PARAM,
  isLaboModalKey,
  type LaboModalKey,
} from "./laboModalKeys";

interface Props {
  branchId: string;
  patient: { id: string; code: string; name: string };
}

/**
 * How many of the patient's orders the parent picker offers. The tab itself
 * pages at 20; the picker is a select, so it reads the record in one go.
 */
const PARENT_CANDIDATE_LIMIT = 200;

/**
 * The Labo tab's order dialog: Đặt mới / Làm tiếp công đoạn / Bảo hành as
 * pills, driven by the URL the way the reference does it — `laboModal` names
 * the open tab, `laboRowId` the parent order on the two child tabs, and both
 * go when the dialog closes.
 */
export function LaboOrderTabsDialog({ branchId, patient }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const modal = searchParams.get(LABO_MODAL_PARAM);
  const activeKey: LaboModalKey = isLaboModalKey(modal) ? modal : "new-order";
  const parentId = searchParams.get(LABO_ROW_PARAM) ?? undefined;
  const open = isLaboModalKey(modal);

  // The two child tabs pick a parent among the patient's orders; only they
  // need the list, and only while the dialog is up.
  const candidates = usePatientLaboOrders(
    { patientId: patient.id, maxResultCount: PARENT_CANDIDATE_LIMIT },
    open && activeKey !== "new-order",
  );
  const orders = candidates.data?.items ?? [];

  const update = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams);
    mutate(next);
    setSearchParams(next, { replace: true });
  };
  const switchTab = (key: string) => update((next) => next.set(LABO_MODAL_PARAM, key));
  const pickParent = (id: string | undefined) =>
    update((next) => (id ? next.set(LABO_ROW_PARAM, id) : next.delete(LABO_ROW_PARAM)));
  const close = () =>
    update((next) => {
      next.delete(LABO_MODAL_PARAM);
      next.delete(LABO_ROW_PARAM);
    });

  const body = (key: LaboModalKey) =>
    key === "new-order" ? (
      <LaboNewOrderTab open={open} branchId={branchId} patient={patient} onSaved={close} />
    ) : (
      <LaboChildForm
        open={open && activeKey === key}
        kind={key}
        branchId={branchId}
        patient={patient}
        orders={orders}
        parentId={parentId}
        onPickParent={pickParent}
        onSaved={close}
      />
    );

  return (
    <Modal
      open={open}
      /* Measured on the reference: 772px, which lands its two columns on 349px. */
      width={772}
      className="pd-labo-dialog pd-labo-tabs-dialog"
      title={t(LABO_MODAL_LABELS[activeKey])}
      onCancel={close}
      footer={null}
      destroyOnHidden
    >
      <PillTabs
        className="pd-labo-tabs"
        activeKey={activeKey}
        onChange={switchTab}
        items={LABO_MODAL_KEYS.map((key) => ({
          key,
          label: t(LABO_MODAL_LABELS[key]),
          children: body(key),
        }))}
      />
    </Modal>
  );
}
