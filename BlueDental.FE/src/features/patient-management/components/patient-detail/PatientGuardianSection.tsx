import { useState } from "react";
import { Button } from "antd";
import { PlusOutlined, TeamOutlined } from "@ant-design/icons";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { CATALOG_GROUP, useCatalogOptions } from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { useAddressLabel } from "../../hooks/useGuardianSubject";
import { usePatientGuardianBlock } from "../../hooks/usePatientGuardianBlock";
import { GUARDIAN_LIMITS, type PatientDto } from "../../types/patient";
import { GuardianDialog } from "../guardian/GuardianDialog";
import { PatientGuardianCard } from "./PatientGuardianCard";

interface Props {
  patient: PatientDto;
  /** patient.update — the +, pencil and trash all write the record. */
  canEdit: boolean;
}

/**
 * "NGƯỜI GIÁM HỘ (n)" under the identity grid of the Hồ sơ tab (BA mock
 * 2026-10-07). + and the pencil open the same "Thông tin người giám hộ" popup
 * the hồ sơ dialog uses; here its save is written at once.
 */
export function PatientGuardianSection({ patient, canEdit }: Props) {
  const block = usePatientGuardianBlock(patient);
  const occupations = useCatalogOptions(CATALOG_GROUP.Occupation).data ?? [];
  const patientAddress = useAddressLabel(
    patient.address ?? "",
    patient.provinceCode ?? undefined,
    patient.wardCode ?? undefined,
  );
  /** Cards whose fold differs from the default: the primary open, the rest closed. */
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(new Set());
  const guardians = patient.guardians ?? [];
  const full = guardians.length >= GUARDIAN_LIMITS.maxPerPatient;
  const lastRequired = t("Patient:Guardian:LastRequired", GUARDIAN_LIMITS.requiredUnderAge);
  const deleteBlocked = block.summary.required && guardians.length === 1 ? lastRequired : null;

  const handleToggle = (id: string) =>
    setFlipped((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <section className="pd-guardians" aria-label={t("Patient:Guardian:Tab")}>
      <header className="pd-guardians-head">
        <TeamOutlined className="pd-guardians-icon" />
        <h4>{t("Patient:Guardian:SectionTitle")}</h4>
        <span className="pd-guardians-count">{guardians.length}</span>
        {canEdit && (
          <Button
            type="primary"
            shape="circle"
            size="small"
            className="pd-guardians-add"
            icon={<PlusOutlined />}
            disabled={full}
            title={full ? t("Patient:Guardian:LimitReached", GUARDIAN_LIMITS.maxPerPatient) : undefined}
            aria-label={t("Patient:Guardian:Add")}
            onClick={block.openNew}
          />
        )}
      </header>

      {guardians.length === 0 ? (
        <p className={block.summary.required ? "pd-guardians-empty pd-guardians-empty--warn" : "pd-guardians-empty"}>
          {block.summary.required ? lastRequired : t("Patient:Guardian:Empty")}
        </p>
      ) : (
        <div className="pd-guardians-list">
          {guardians.map((guardian, index) => (
            <PatientGuardianCard
              key={guardian.id}
              guardian={guardian}
              occupation={occupations.find((row) => row.id === guardian.occupationEntryId)?.name ?? null}
              expanded={guardian.isPrimaryContact !== flipped.has(guardian.id)}
              onToggle={() => handleToggle(guardian.id)}
              actions={
                canEdit
                  ? {
                      onEdit: () => block.openExisting(index),
                      onDelete: () => block.askDelete(index),
                      deleteBlockedReason: deleteBlocked,
                    }
                  : null
              }
            />
          ))}
        </div>
      )}

      <GuardianDialog
        focus={block.focus}
        group={block.group}
        parentTitle={t("Patient:Tab:Profile")}
        patient={block.summary}
        patientAddress={patientAddress}
        patientId={patient.id}
        saving={block.pending}
        onSave={block.save}
        onClose={block.closePopup}
      />
      <ConfirmDeleteDialog
        open={block.deleting !== null}
        noun={t("Patient:Guardian:DeleteNoun")}
        name={block.deleting?.fullName}
        pending={block.pending}
        onConfirm={block.confirmDelete}
        onClose={block.cancelDelete}
      />
    </section>
  );
}
