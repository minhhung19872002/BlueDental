import { useEffect, useState } from "react";
import { Alert, Col, Form, Row } from "antd";
import { toast } from "sonner";
import dayjs, { type Dayjs } from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { CATALOG_GROUP, useCreateTaxonomyGroupOption } from "@/hooks/useCatalogOptions";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { useRegisterPatient, useUpdatePatient } from "../api/patientMutations";
import { usePatientCodeEstimate, usePhoneAvailability } from "../api/patientQueries";
import { GENDER_BY_CODE } from "../api/patientAdapters";
import type { Gender, PatientDto, RegisterPatientRequest } from "../types/patient";
import { PatientAddressColumn } from "./PatientAddressColumn";
import { PatientBasicColumn } from "./PatientBasicColumn";
import { PatientSourceColumn } from "./PatientSourceColumn";
import { AddSourceGroupDialog } from "./AddSourceGroupDialog";

interface Props {
  open: boolean;
  /** Null opens "Tạo hồ sơ"; a record opens "Chỉnh sửa hồ sơ". */
  patient: PatientDto | null;
  onClose: () => void;
  onCreated?: (patient: PatientDto) => void;
}

export interface PatientFormValues {
  codeSequence: string;
  createdAtLabel: string;
  fullName: string;
  uppercase: boolean;
  phone: string;
  sourceTaxonomyId?: string;
  sourceEntryId?: string;
  examinationReason: string;
  tagIds: string[];
  gender: Gender;
  dateOfBirth: Dayjs | null;
  email: string;
  note: string;
  occupationEntryId?: string;
  insuranceNumber: string;
  country: string;
  address: string;
  provinceCode?: string;
  wardCode?: string;
}

const EMPTY: PatientFormValues = {
  codeSequence: "",
  createdAtLabel: "",
  fullName: "",
  uppercase: false,
  phone: "",
  sourceTaxonomyId: undefined,
  sourceEntryId: undefined,
  examinationReason: "",
  tagIds: [],
  gender: "male",
  dateOfBirth: null,
  email: "",
  note: "",
  occupationEntryId: undefined,
  insuranceNumber: "",
  country: "",
  address: "",
  provinceCode: undefined,
  wardCode: undefined,
};

/**
 * A stored code split the way the server builds it and the dialog renders it:
 * a clinic prefix and a two-digit year that are shown but not edited, then the
 * sequence that is. A code that does not fit that shape is left whole in the
 * editable half rather than being silently cut somewhere arbitrary.
 */
function splitPatientCode(code: string): { prefix: string; sequence: string } {
  const match = /^(\D+\d{2})(\d+)$/.exec(code);
  return match ? { prefix: match[1], sequence: match[2] } : { prefix: "", sequence: code };
}

/**
 * "Tạo hồ sơ" / "Chỉnh sửa hồ sơ" — the reference's three-column dialog.
 *
 * Column one is who the patient is and where they came from, column two the
 * basic details behind a pair of pills, column three insurance and address.
 * The save stays disabled until a name and a valid phone are in, which is what
 * the reference greys its own out on.
 */
export function PatientEditorDialog({ open, patient, onClose, onCreated }: Props) {
  const [form] = Form.useForm<PatientFormValues>();
  const [tab, setTab] = useState<"basic" | "history">("basic");
  const [diseaseHistoryEntryIds, setDiseaseHistoryEntryIds] = useState<string[]>([]);
  const [addingSource, setAddingSource] = useState(false);

  const fullName = Form.useWatch("fullName", form) ?? "";
  const phone = Form.useWatch("phone", form) ?? "";
  const uppercase = Form.useWatch("uppercase", form) ?? false;
  const sourceTaxonomyId = Form.useWatch("sourceTaxonomyId", form);
  const provinceCode = Form.useWatch("provinceCode", form);

  const estimate = usePatientCodeEstimate(open && !patient);
  const duplicate = usePhoneAvailability(phone.trim(), patient?.id);
  const createSourceGroup = useCreateTaxonomyGroupOption();

  const create = useRegisterPatient();
  const update = useUpdatePatient(patient?.id ?? "");
  const saving = create.isPending || update.isPending;

  /** The prefix the code field greys out, and the half the user may edit. */
  const { prefix: codePrefix, sequence: storedSequence } = patient
    ? splitPatientCode(patient.patientCode)
    : { prefix: estimate.data?.prefix ?? "", sequence: estimate.data?.sequence ?? "" };

  useEffect(() => {
    if (!open) return;

    setTab("basic");
    setDiseaseHistoryEntryIds(patient?.diseaseHistoryEntryIds ?? []);

    form.setFieldsValue(
      patient
        ? {
            ...EMPTY,
            codeSequence: storedSequence,
            createdAtLabel: dayjs(patient.creationTime).format("DD/MM/YYYY"),
            fullName: patient.fullName,
            uppercase: patient.fullName === patient.fullName.toUpperCase(),
            phone: patient.phoneNumber ?? "",
            sourceTaxonomyId: patient.sourceTaxonomyId ?? undefined,
            sourceEntryId: patient.sourceEntryId ?? undefined,
            examinationReason: patient.examinationReason ?? "",
            tagIds: patient.tagIds,
            gender: GENDER_BY_CODE[patient.gender] ?? "other",
            dateOfBirth: patient.dateOfBirth ? dayjs(patient.dateOfBirth) : null,
            email: patient.email ?? "",
            note: patient.note ?? "",
            occupationEntryId: patient.occupationEntryId ?? undefined,
            insuranceNumber: patient.insuranceNumber ?? "",
            country: t("Việt Nam"),
            address: patient.address ?? "",
            provinceCode: patient.provinceCode ?? undefined,
            wardCode: patient.wardCode ?? undefined,
          }
        : { ...EMPTY, country: t("Việt Nam"), createdAtLabel: dayjs().format("DD/MM/YYYY") },
    );
  }, [open, patient, form]);

  // The suggestion only arrives once the dialog is open, so it is filled in
  // when it lands rather than in the reset above.
  useEffect(() => {
    if (open && !patient && estimate.data) {
      form.setFieldValue("codeSequence", estimate.data.sequence);
    }
  }, [open, patient, estimate.data, form]);

  // "IN HOA" is a switch on the name, not a separate value — the reference
  // rewrites the field the moment it is ticked.
  useEffect(() => {
    if (!uppercase) return;
    const current = form.getFieldValue("fullName") as string | undefined;
    if (current && current !== current.toUpperCase()) {
      form.setFieldValue("fullName", current.toUpperCase());
    }
  }, [uppercase, fullName, form]);

  const handleSourceGroupChange = () => {
    // A channel belongs to one source group; keeping it across a change would
    // file the patient under a channel their source does not have.
    form.setFieldValue("sourceEntryId", undefined);
  };

  const handleProvinceChange = () => {
    form.setFieldValue("wardCode", undefined);
  };

  const handleAddSourceGroup = async (name: string) => {
    await createSourceGroup.mutateAsync({ group: CATALOG_GROUP.Source, name });
    setAddingSource(false);
    toast.success(t("Đã thêm loại nguồn đến"));
  };

  const submit = async (values: PatientFormValues) => {
    const name = values.fullName.trim();
    const words = name.split(/\s+/).filter(Boolean);

    const payload: RegisterPatientRequest = {
      // The dialog collects one "Họ và tên"; the record keeps họ and tên apart,
      // so the last word is the given name and the rest the family name.
      lastName: words.length > 1 ? words.slice(0, -1).join(" ") : name,
      firstName: words.length > 1 ? words[words.length - 1] : "",
      dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format("YYYY-MM-DD") : null,
      gender: values.gender,
      phoneNumber: values.phone.trim(),
      email: values.email.trim() || undefined,
      patientCode: values.codeSequence.trim()
        ? `${codePrefix}${values.codeSequence.trim()}`
        : undefined,
      sourceTaxonomyId: values.sourceTaxonomyId ?? null,
      sourceEntryId: values.sourceEntryId ?? null,
      occupationEntryId: values.occupationEntryId ?? null,
      insuranceNumber: values.insuranceNumber.trim() || null,
      address: values.address.trim() || null,
      provinceCode: values.provinceCode ?? null,
      wardCode: values.wardCode ?? null,
      examinationReason: values.examinationReason.trim() || null,
      note: values.note.trim() || null,
      tagIds: values.tagIds ?? [],
      diseaseHistoryEntryIds,
    };

    try {
      if (patient) {
        await update.mutateAsync(payload);
      } else {
        const created = await create.mutateAsync(payload);
        onCreated?.(created);
      }

      toast.success(patient ? t("Đã cập nhật hồ sơ") : t("Đã tạo hồ sơ"));
      onClose();
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  // A name with no given name is still a name; the server only needs one word.
  const canSave = fullName.trim().length > 0 && /^\d{8,15}$/.test(phone.trim());

  return (
    <AppDialog
      open={open}
      width={1240}
      className="bd-patient-dialog"
      title={patient ? t("Chỉnh sửa hồ sơ") : t("Tạo hồ sơ")}
      canSave={canSave}
      saving={saving}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={EMPTY}
        onFinish={(values) => void submit(values)}
      >
        {duplicate.data?.exists && (
          <Alert
            type="warning"
            showIcon
            className="bd-patient-dupe"
            message={t(
              "Số điện thoại này đã thuộc về [{0}] {1}",
              duplicate.data.patientCode ?? "",
              duplicate.data.patientName ?? "",
            )}
          />
        )}

        <Row gutter={[24, 0]} className="bd-patient-columns">
          <Col xs={24} md={12} lg={8}>
            <PatientSourceColumn
              codePrefix={codePrefix}
              createdAt={patient?.creationTime ?? null}
              sourceTaxonomyId={sourceTaxonomyId}
              onAddSource={() => setAddingSource(true)}
              onSourceGroupChange={handleSourceGroupChange}
            />
          </Col>

          <Col xs={24} md={12} lg={8}>
            <PatientBasicColumn
              tab={tab}
              onTabChange={setTab}
              diseaseHistoryEntryIds={diseaseHistoryEntryIds}
              onDiseaseHistoryChange={setDiseaseHistoryEntryIds}
            />
          </Col>

          <Col xs={24} md={24} lg={8}>
            <PatientAddressColumn
              provinceCode={provinceCode}
              onProvinceChange={handleProvinceChange}
            />
          </Col>
        </Row>
      </Form>

      <AddSourceGroupDialog
        open={addingSource}
        saving={createSourceGroup.isPending}
        onSave={(name) => void handleAddSourceGroup(name)}
        onClose={() => setAddingSource(false)}
      />
    </AppDialog>
  );
}
