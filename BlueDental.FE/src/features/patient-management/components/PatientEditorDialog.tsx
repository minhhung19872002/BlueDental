import { useEffect, useState } from "react";
import { Alert, Col, Form, Row } from "antd";
import { toast } from "sonner";
import dayjs from "dayjs";
import { AppDialog } from "@/components/AppDialog";
import { CATALOG_GROUP, useCreateTaxonomyGroupOption } from "@/hooks/useCatalogOptions";
import { describeApiError } from "@/lib/apiError";
import { notifyError } from "@/lib/notify";
import { t } from "@/lib/i18n";
// The dialog carries its own styling: it opens from the list *and* from a
// patient's record, and the record's page does not import the list's CSS.
import "./patient.css";
import { useRegisterPatient, useUpdatePatient } from "../api/patientMutations";
import { usePatientCodeEstimate } from "../api/patientQueries";
import type { PatientDto, PatientPrefill, PhoneGuardian } from "../types/patient";
import { PATIENT_PHONE_PATTERN } from "../utils/patientPhone";
import {
  buildPatientPayload,
  DUPLICATE_NAME_ON_PHONE,
  DUPLICATE_NATIONAL_ID,
  DUPLICATE_PHONE,
  EMPTY_PATIENT_FORM,
  GUARDIAN_ERROR,
  INVALID_NAME,
  SHARED_PHONE_LINK_ERROR,
  splitPatientCode,
  valuesFromGuardian,
  valuesFromPatient,
  valuesFromPrefill,
  type PatientFormValues,
} from "../utils/patientEditorForm";
import { PatientAddressColumn } from "./PatientAddressColumn";
import { useGuardianSubject } from "../hooks/useGuardianSubject";
import { useHolderNavigation } from "../hooks/useHolderNavigation";
import { usePatientGuardians } from "../hooks/usePatientGuardians";
import { usePatientNameCasing } from "../hooks/usePatientNameCasing";
import { usePhoneHolders } from "../hooks/usePhoneHolders";
import { useSharedPhoneLink } from "../hooks/useSharedPhoneLink";
import { PatientBasicColumn, type PatientEditorTab } from "./PatientBasicColumn";
import { PatientSourceColumn } from "./PatientSourceColumn";
import { AddSourceGroupDialog } from "./AddSourceGroupDialog";
import { GuardianDialog } from "./guardian/GuardianDialog";
import { GuardianPane } from "./guardian/GuardianPane";
import { GuardianRequiredBanner } from "./guardian/GuardianRequiredBanner";
import { SharedPhoneField } from "./shared-phone/SharedPhoneField";

interface Props {
  open: boolean;
  /** Null opens "Tạo hồ sơ"; a record opens "Chỉnh sửa hồ sơ". */
  patient: PatientDto | null;
  onClose: () => void;
  onCreated?: (patient: PatientDto) => void;
  /** "Quét CCCD" — what a scanned card fills into a new record. */
  prefill?: PatientPrefill;
}

/**
 * "Tạo hồ sơ" / "Chỉnh sửa hồ sơ" — the reference's three-column dialog.
 *
 * Column one is who the patient is and where they came from, column two the
 * basic details behind a pair of pills, column three insurance and address.
 * The save stays disabled until a name and a valid phone are in, which is what
 * the reference greys its own out on.
 */
export function PatientEditorDialog({ open, patient, onClose, onCreated, prefill }: Props) {
  const [form] = Form.useForm<PatientFormValues>();
  const [tab, setTab] = useState<PatientEditorTab>("basic");
  const [guardianError, setGuardianError] = useState<string | null>(null);
  const guardians = usePatientGuardians();
  const [diseaseHistoryEntryIds, setDiseaseHistoryEntryIds] = useState<string[]>([]);
  const [addingSource, setAddingSource] = useState(false);
  /** The guardian a new hồ sơ was filled from — their card then links to it (P2710_02). */
  const [sourceGuardianId, setSourceGuardianId] = useState<string | null>(null);

  const fullName = Form.useWatch("fullName", form) ?? "";
  const phone = Form.useWatch("phone", form) ?? "";
  const uppercase = Form.useWatch("uppercase", form) ?? false;
  const sourceTaxonomyId = Form.useWatch("sourceTaxonomyId", form);
  const provinceCode = Form.useWatch("provinceCode", form);

  const estimate = usePatientCodeEstimate(open && !patient);
  const { holders, masked } = usePhoneHolders(phone, patient);
  const link = useSharedPhoneLink(holders.owners, prefill?.sharedPhoneAnchorId);
  // Edit has no flow waiting on a patient, whatever the caller passed.
  const navigation = useHolderNavigation({ onCreated: patient ? undefined : onCreated, onClose });
  const createSourceGroup = useCreateTaxonomyGroupOption();

  const create = useRegisterPatient();
  const update = useUpdatePatient(patient?.id ?? "");
  const saving = create.isPending || update.isPending;

  /** The prefix the code field greys out, and the half the user may edit. */
  const { prefix: codePrefix, sequence: storedSequence } = patient
    ? splitPatientCode(patient.patientCode)
    : { prefix: estimate.data?.prefix ?? "", sequence: estimate.data?.sequence ?? "" };

  const subject = useGuardianSubject(form, codePrefix);
  const guardianMissing = subject.summary.required && guardians.group.guardians.length === 0;

  useEffect(() => {
    if (!open) return;

    setTab("basic");
    setDiseaseHistoryEntryIds(patient?.diseaseHistoryEntryIds ?? []);
    guardians.reset(patient);
    setGuardianError(null);
    setSourceGuardianId(null);
    link.reset();

    form.setFieldsValue(
      patient
        ? valuesFromPatient(patient, storedSequence)
        : {
            ...EMPTY_PATIENT_FORM,
            ...(prefill ? valuesFromPrefill(prefill) : {}),
            country: t("Patient:DefaultCountry"),
            createdAtLabel: dayjs().format("DD/MM/YYYY"),
          },
    );
    // `guardians.reset` and `link.reset` are stable callbacks; they are left out of the list on purpose.
  }, [open, patient, prefill, form]);

  // The suggestion only arrives once the dialog is open, so it is filled in
  // when it lands rather than in the reset above.
  useEffect(() => {
    if (open && !patient && estimate.data) {
      form.setFieldValue("codeSequence", estimate.data.sequence);
    }
  }, [open, patient, estimate.data, form]);

  usePatientNameCasing(form, uppercase, fullName);

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
    toast.success(t("Patient:SourceGroup:AddSuccess"));
  };

  const handlePickGuardian = (guardian: PhoneGuardian) => {
    form.setFieldsValue(valuesFromGuardian(guardian));
    setSourceGuardianId(guardian.guardianId);
    link.suggestFromGuardian(guardian);
  };

  const submit = async (values: PatientFormValues) => {
    const payload = buildPatientPayload(values, codePrefix, {
      sourceAppointmentId: prefill?.sourceAppointmentId,
      // The tag button on the record owns these; carry them through untouched
      // rather than clearing them on every edit.
      tagIds: patient?.tagIds ?? [],
      diseaseHistoryEntryIds,
      ...guardians.toPayload(),
      sharedPhoneLink: link.link,
      // Dropped once the number no longer carries that guardian.
      sourceGuardianId: holders.guardians.some((g) => g.guardianId === sourceGuardianId) ? sourceGuardianId : null,
    });

    try {
      if (patient) {
        await update.mutateAsync(payload);
      } else {
        const created = await create.mutateAsync(payload);
        onCreated?.(created);
      }

      toast.success(patient ? t("Patient:Profile:Updated") : t("Patient:Profile:CreateSuccess"));
      onClose();
    } catch (error) {
      const failure = describeApiError(error);
      // A refused field is a field error, not a toast: it goes under the box
      // it was typed in, on the pane that box sits on.
      if (failure.code === DUPLICATE_NATIONAL_ID) {
        setTab("basic");
        form.setFields([{ name: "nationalId", errors: [failure.message] }]);
        return;
      }
      if (failure.code && GUARDIAN_ERROR.test(failure.code)) {
        setTab("guardian");
        setGuardianError(failure.message);
        return;
      }
      if (failure.code === INVALID_NAME || failure.code === DUPLICATE_NAME_ON_PHONE) {
        form.setFields([{ name: "fullName", errors: [failure.message] }]);
        return;
      }
      if (failure.code === DUPLICATE_PHONE) {
        form.setFields([{ name: "phone", errors: [failure.message] }]);
        return;
      }
      if (failure.code && SHARED_PHONE_LINK_ERROR.test(failure.code)) {
        link.setError(failure.message);
        return;
      }
      notifyError(failure.message);
    }
  };

  // A name with no given name is still a name; the server only needs one word.
  // BA: under 16 the record cannot be saved without a guardian.
  // P2710_02: a number already on file is saved once "Là … của …" is chosen;
  // an account that sees phones masked is still refused (bug list item 29).
  const canSave =
    fullName.trim().length > 0 &&
    PATIENT_PHONE_PATTERN.test(phone.trim()) &&
    !guardianMissing &&
    !masked &&
    link.ready;

  const handleGuardianDelete = (index: number) => {
    guardians.remove(index);
    setGuardianError(null);
  };

  return (
    <AppDialog
      open={open}
      width={1240}
      className="bd-patient-dialog"
      title={patient ? t("Patient:Form:EditTitle") : t("Patient:Profile:CreateTitle")}
      canSave={canSave}
      saving={saving}
      footerLeft={
        guardianMissing ? <span className="bd-guardian-footnote">{t("Patient:Guardian:FooterMissing")}</span> : null
      }
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={EMPTY_PATIENT_FORM}
        onFinish={(values) => void submit(values)}
      >
        {masked && (
          <Alert
            type="error"
            showIcon
            className="bd-patient-dupe"
            message={t("Patient:Editor:PhoneTakenHidden")}
            description={t("Patient:Editor:PhoneTakenBlocked")}
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
              phoneField={
                <SharedPhoneField
                  holders={holders}
                  link={link}
                  handlers={{ ...navigation, onPickGuardian: handlePickGuardian }}
                  footerLabel={patient ? t("Patient:SharedPhone:KeepThisRecord") : t("Patient:SharedPhone:NewPerson")}
                  quietPhone={prefill?.sharedPhoneAnchorId ? prefill.phone : undefined}
                />
              }
            />
          </Col>

          <Col xs={24} md={12} lg={8}>
            <PatientBasicColumn
              tab={tab}
              onTabChange={setTab}
              diseaseHistoryEntryIds={diseaseHistoryEntryIds}
              onDiseaseHistoryChange={setDiseaseHistoryEntryIds}
              age={subject.summary.age}
              guardianMark={guardianMissing ? "missing" : guardians.group.guardians.length > 0 ? "filled" : "none"}
              ageNotice={guardianMissing && <GuardianRequiredBanner onEnter={guardians.openNew} />}
              guardianPane={
                <>
                  {guardianError && <div className="ant-form-item-explain-error">{guardianError}</div>}
                  <GuardianPane
                    group={guardians.group}
                    onAdd={guardians.openNew}
                    onEdit={guardians.openExisting}
                    onDelete={handleGuardianDelete}
                  />
                </>
              }
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

      <GuardianDialog
        focus={guardians.popupFocus}
        group={guardians.group}
        parentTitle={patient ? t("Patient:Form:EditTitle") : t("Patient:Profile:CreateTitle")}
        patient={subject.summary}
        patientAddress={subject.address}
        patientId={patient?.id}
        onSave={(next) => {
          guardians.commitPopup(next);
          setGuardianError(null);
        }}
        onClose={guardians.closePopup}
      />
    </AppDialog>
  );
}
