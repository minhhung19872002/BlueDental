import { useState } from "react";
import { Button, Spin } from "antd";
import { PlusOutlined, TeamOutlined, UserAddOutlined } from "@ant-design/icons";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import type { PatientRelationRow } from "@/hooks/usePatientFamily";
import { t } from "@/lib/i18n";
import { useRelationCommands, usePatientRelations, type RelationInput } from "../../../api/familyApi";
import { GUARDIAN_LIMITS, type PatientDto } from "../../../types/patient";
import { buildFamilyPeople } from "../../../utils/familyPeople";
import type { GuardianGroup } from "../../../utils/guardian";
import { FamilyPersonRow, type FamilyPersonActions } from "./FamilyPersonRow";
import { RelationDialog } from "./RelationDialog";

/** The hồ sơ editor's guardian cards — staged, written by the editor's own Lưu. */
export interface GuardianCardsControl {
  group: GuardianGroup;
  /** The server's refusal of a guardian on the last save. */
  error: string | null;
  add: () => void;
  edit: (index: number) => void;
  remove: (index: number) => void;
}

interface Props {
  /** Null while the record is being created: only its guardians so far. */
  patient: PatientDto | null;
  guardians: GuardianCardsControl;
  /** patient.update — relations are part of the record. */
  canEdit: boolean;
}

/**
 * "NGƯỜI NHÀ & QUAN HỆ" (owner, 2026-10-12): everyone tied to the record in
 * one list — the guardian cards, the declared relations, the wards and the
 * family group's members — one row per person, with a badge for each tie.
 */
export function FamilyPeopleSection({ patient, guardians, canEdit }: Props) {
  const patientId = patient?.id ?? "";
  const { data: rows = [], isLoading } = usePatientRelations(patientId, patient !== null);
  const commands = useRelationCommands(patientId);
  const [editing, setEditing] = useState<PatientRelationRow | "new" | null>(null);
  const [deleting, setDeleting] = useState<PatientRelationRow | null>(null);
  const people = buildFamilyPeople(guardians.group.guardians, rows);
  const guardiansFull = guardians.group.guardians.length >= GUARDIAN_LIMITS.maxPerPatient;
  const canRelate = patient !== null && canEdit;

  const handleSave = async (input: RelationInput) => {
    try {
      if (editing !== "new" && editing?.id) await commands.update.mutateAsync({ id: editing.id, type: input.type, note: input.note });
      else await commands.create.mutateAsync(input);
      toast.success(t("PatientRelation:Saved"));
      setEditing(null);
    } catch {
      // The query client reports the server's refusal; the dialog stays open.
    }
  };

  const handleDelete = async () => {
    if (!deleting?.id) return;
    try {
      await commands.remove.mutateAsync(deleting.id);
      toast.success(t("PatientRelation:Deleted"));
      setDeleting(null);
    } catch {
      // Reported by the query client.
    }
  };

  const actions: FamilyPersonActions = {
    editGuardian: guardians.edit,
    deleteGuardian: guardians.remove,
    ...(canRelate ? { editRelation: setEditing, deleteRelation: setDeleting, relate: setEditing } : {}),
  };

  return (
    <section className="pf-section" aria-label={t("Patient:Family:People")}>
      <header className="pf-section__head">
        <TeamOutlined className="pf-section__icon" />
        <h4>{t("Patient:Family:People")}</h4>
        <span className="pf-section__count">{people.length}</span>
        <span className="pf-section__tools">
          <Button size="small" icon={<UserAddOutlined />} disabled={guardiansFull} onClick={guardians.add}>
            {t("Patient:Guardian:Add")}
          </Button>
          {canRelate ? (
            <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setEditing("new")}>
              {t("PatientRelation:Add")}
            </Button>
          ) : null}
        </span>
      </header>

      {guardians.error ? <div className="ant-form-item-explain-error">{guardians.error}</div> : null}
      {isLoading && patient !== null ? (
        <Spin size="small" />
      ) : people.length === 0 ? (
        <p className="pf-empty">{t("Patient:Family:Empty")}</p>
      ) : (
        <div className="pf-list">
          {people.map((person) => (
            <FamilyPersonRow key={person.key} person={person} actions={actions} />
          ))}
        </div>
      )}
      <p className="pf-note">{t(patient ? "Patient:Family:GuardiansSavedWithRecord" : "Patient:Family:SaveFirst")}</p>

      {patient ? (
        <RelationDialog
          editing={editing}
          patientId={patient.id}
          patientName={patient.fullName}
          saving={commands.create.isPending || commands.update.isPending}
          onSubmit={(input) => void handleSave(input)}
          onClose={() => setEditing(null)}
        />
      ) : null}
      <ConfirmDeleteDialog
        open={deleting !== null}
        noun={t("PatientRelation:Noun")}
        name={deleting?.relatedPatientName}
        pending={commands.remove.isPending}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
