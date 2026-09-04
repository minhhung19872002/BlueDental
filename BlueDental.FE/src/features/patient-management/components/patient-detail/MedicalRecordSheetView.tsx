import {
  MedicalRecordSheet,
  type MedicalRecordFields,
} from "@/features/taxonomy/components/MedicalRecordSheet";
import { TAXONOMY_GROUP, useCatalogEntries } from "@/features/taxonomy/api/taxonomyApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PatientMedicalRecordDto } from "../../api/medicalRecordApi";
import type { PatientDto } from "../../types/patient";
import { MedicalRecordCoverSheet } from "./MedicalRecordCoverSheet";
import { MedicalRecordConsultationSheet } from "./MedicalRecordConsultationSheet";
import { MedicalRecordFreeSheet } from "./MedicalRecordFreeSheet";
import { formSpecOf } from "./medicalRecordForms";
import type { SheetDraft } from "./medicalRecordDraft";
import { parseFields, parseBody } from "./medicalRecordDraft";

/**
 * Draws one sheet, choosing the layout its form calls for.
 *
 * Three of the nine forms were observed on the reference and are drawn to its
 * printed layout; the rest open the clinic's own plain A4 page. See
 * docs/clone/pages/patient-detail.md §Bệnh án.
 */

interface Props {
  sheet: PatientMedicalRecordDto;
  zoom: number;
  /** Only the open sheet takes edits; the others are shown read-only. */
  editable: boolean;
  draft: SheetDraft | null;
  onChange: (next: SheetDraft) => void;
  /** The cover prints the patient's identity, as the reference prints it. */
  patient?: PatientDto;
}

export function MedicalRecordSheetView({ sheet, zoom, editable, draft, onChange, patient }: Props) {
  const branchId = useCurrentBranchId();
  const spec = formSpecOf(sheet.form);

  // "Bệnh án mẫu" from Danh mục: what a free sheet may be started from. One
  // request no matter how many sheets are on screen — the query key is shared.
  const templates = (
    useCatalogEntries(branchId ?? undefined, TAXONOMY_GROUP.MedicalRecordTemplate, {
      scope: "catalog",
      skipCount: 0,
      maxResultCount: 200,
    }).data?.items ?? []
  ).map((entry) => ({ id: entry.id, name: entry.name, content: entry.content ?? null }));

  const fields = draft ? draft.fields : parseFields(sheet.content);
  const body = draft ? draft.body : parseBody(sheet.content);
  const setFields = (next: typeof fields) => onChange({ fields: next, body });
  // The outpatient sheet only knows its own seventeen cells, so its edits are
  // merged over the rest rather than replacing them.
  const mergeFields = (next: MedicalRecordFields) =>
    onChange({ fields: { ...fields, ...next }, body });
  const setBody = (next: string) => onChange({ fields, body: next });

  if (spec.kind === "outpatient") {
    return (
      <MedicalRecordSheet
        zoom={zoom}
        value={fields}
        onChange={editable ? mergeFields : () => undefined}
      />
    );
  }

  if (spec.kind === "cover") {
    return (
      <MedicalRecordCoverSheet
        zoom={zoom}
        value={fields}
        patient={patient}
        onChange={editable ? setFields : () => undefined}
      />
    );
  }

  if (spec.kind === "consultation") {
    return <MedicalRecordConsultationSheet zoom={zoom} />;
  }

  return (
    <MedicalRecordFreeSheet
      zoom={zoom}
      title={sheet.title}
      templates={templates}
      readOnly={!editable}
      value={body}
      onChange={editable ? setBody : () => undefined}
    />
  );
}
