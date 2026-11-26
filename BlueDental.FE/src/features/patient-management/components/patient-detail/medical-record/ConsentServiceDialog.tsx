import { Checkbox, Spin } from "antd";
import { AppDialog } from "@/components/AppDialog";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import type { ConsentPickDialog } from "./useConsentServicePick";
import "./consent-services.css";

/**
 * "Dịch vụ của phiếu" — which of the set's services one copy of Phiếu tư vấn và
 * xác nhận đồng ý điều trị prints (R-1326). A service already on another copy
 * says which, so the clinic can keep one copy per package.
 */
export function ConsentServiceDialog({ pick }: { pick: ConsentPickDialog }) {
  const { rows, picked } = pick;
  const allPicked = rows.length > 0 && picked.length === rows.length;
  const toggle = (id: string) =>
    pick.onPickedChange(picked.includes(id) ? picked.filter((item) => item !== id) : [...picked, id]);

  return (
    <AppDialog
      open={pick.open}
      title={t("Patient:MedRecord:ConsentServices")}
      subtitle={t("Patient:MedRecord:ConsentServicesHint")}
      width={640}
      canSave={!pick.loading && (picked.length > 0 || rows.length === 0)}
      saving={pick.saving}
      saveLabel={pick.mode === "add" ? t("Patient:MedRecord:ConsentServicesCreate") : undefined}
      cancelLabel={t("Patient:Misc:CancelVN")}
      footerLeft={
        rows.length > 0 && (
          <span className="mr-consent-count">
            {t("Patient:MedRecord:ConsentServicesCount", picked.length, rows.length)}
          </span>
        )
      }
      onSave={pick.onSave}
      onClose={pick.onClose}
    >
      {pick.loading ? (
        <div className="mr-consent-loading">
          <Spin />
        </div>
      ) : rows.length === 0 ? (
        <p className="mr-consent-empty">{t("Patient:MedRecord:ConsentServicesNone")}</p>
      ) : (
        <div className="mr-consent-list" role="group" aria-label={t("Patient:MedRecord:ConsentServices")}>
          <label className="mr-consent-all">
            <Checkbox
              checked={allPicked}
              indeterminate={picked.length > 0 && !allPicked}
              onChange={(event) => pick.onPickedChange(event.target.checked ? rows.map((row) => row.id) : [])}
            />
            {t("Patient:MedRecord:ConsentServicesAll")}
          </label>
          {rows.map((row) => (
            <label key={row.id} className="mr-consent-row">
              <Checkbox
                checked={picked.includes(row.id)}
                aria-label={row.name}
                onChange={() => toggle(row.id)}
              />
              <span className="mr-consent-main">
                <span className="mr-consent-name">{row.name}</span>
                <span className="mr-consent-meta">
                  {[row.planCode, row.teeth].filter(Boolean).join(" · ")}
                </span>
                {row.heldBy.length > 0 && (
                  <span className="mr-consent-held">
                    {t("Patient:MedRecord:ConsentServicesOn", row.heldBy.join(", "))}
                  </span>
                )}
              </span>
              <span className="mr-consent-amount">{formatVND(row.amount)}</span>
            </label>
          ))}
        </div>
      )}
    </AppDialog>
  );
}
