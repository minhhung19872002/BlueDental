import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button, Tag, Tooltip } from "antd";
import { DeleteOutlined, EditOutlined, LinkOutlined, LockOutlined } from "@ant-design/icons";
import type { PatientRelationRow } from "@/hooks/usePatientFamily";
import { t } from "@/lib/i18n";
import { isEditableRelation, needsRelation, type FamilyPerson } from "../../../utils/familyPeople";
import { describePerson } from "../../../utils/familyPersonView";
import { initialsOf } from "../../../utils/guardian";

/** What a row can do. Guardian cards are the editor's; relation writes need patient.update. */
export interface FamilyPersonActions {
  editGuardian: (index: number) => void;
  deleteGuardian: (index: number) => void;
  editRelation?: (row: PatientRelationRow) => void;
  deleteRelation?: (row: PatientRelationRow) => void;
  relate?: (row: PatientRelationRow) => void;
}

interface Props {
  person: FamilyPerson;
  actions: FamilyPersonActions;
}

function IconAction({ label, danger, icon, onClick }: { label: string; danger?: boolean; icon: ReactNode; onClick: () => void }) {
  return (
    <Tooltip title={label}>
      <Button type="text" size="small" danger={danger} icon={icon} aria-label={label} onClick={onClick} />
    </Tooltip>
  );
}

/** The buttons of a row: a guardian card is edited in its popup, a relation in its dialog. */
function RowActions({ person, actions }: Props) {
  if (person.kind === "guardian") {
    return (
      <span className="pf-relation__actions">
        <IconAction label={t("Patient:Guardian:Edit")} icon={<EditOutlined />} onClick={() => actions.editGuardian(person.index)} />
        <IconAction label={t("Patient:Guardian:Delete")} danger icon={<DeleteOutlined />} onClick={() => actions.deleteGuardian(person.index)} />
      </span>
    );
  }

  const { row } = person;
  if (row.setByGuardian) {
    return (
      <Tooltip title={t("Patient:Family:SetByGuardian")}>
        <LockOutlined className="pf-relation__lock" aria-label={t("Patient:Family:SetByGuardian")} />
      </Tooltip>
    );
  }
  if (needsRelation(row) && actions.relate) {
    const relate = actions.relate;
    return (
      <Button size="small" icon={<LinkOutlined />} onClick={() => relate(row)}>
        {t("Patient:Family:SetRelation")}
      </Button>
    );
  }
  if (!isEditableRelation(row)) return null;
  const { editRelation, deleteRelation } = actions;
  return (
    <span className="pf-relation__actions">
      {editRelation ? <IconAction label={t("Common:Edit")} icon={<EditOutlined />} onClick={() => editRelation(row)} /> : null}
      {deleteRelation ? (
        <IconAction label={t("Common:Delete")} danger icon={<DeleteOutlined />} onClick={() => deleteRelation(row)} />
      ) : null}
    </span>
  );
}

/** One person tied to the record: who, what to this patient, and every other way they are tied. */
export function FamilyPersonRow({ person, actions }: Props) {
  const view = describePerson(person);

  return (
    <article className="pf-relation" aria-label={view.name}>
      <span className="pf-avatar" aria-hidden="true">
        {initialsOf(view.name)}
      </span>
      <div className="pf-relation__body">
        <div className="pf-relation__title">
          {view.patientId ? (
            // A new browser tab: the row sits in the hồ sơ editor, and following
            // it in place would drop whatever is typed there.
            <Link to={`/patient/${view.patientId}`} target="_blank" rel="noreferrer" className="pf-relation__name">
              {view.name}
            </Link>
          ) : (
            <span className="pf-relation__name">{view.name}</span>
          )}
          {view.relation ? <Tag color={view.isFamily ? "green" : "default"}>{view.relation}</Tag> : null}
          {view.badges.map((badge) => (
            <Tag key={badge.key} color={badge.color}>
              {badge.label}
            </Tag>
          ))}
        </div>
        {view.details ? <small>{view.details}</small> : null}
      </div>
      <RowActions person={person} actions={actions} />
    </article>
  );
}
