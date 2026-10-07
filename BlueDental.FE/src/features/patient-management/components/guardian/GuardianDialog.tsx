import { Button, Checkbox, Form, Modal } from "antd";
import { ArrowLeftOutlined, PlusOutlined, RightOutlined, SaveOutlined } from "@ant-design/icons";
import { notifyError } from "@/lib/notify";
import { describeApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { useFetchPatientDto } from "../../api/patientQueries";
import { useGuardianPopupForm } from "../../hooks/useGuardianPopupForm";
import type { GuardianPopupFocus } from "../../hooks/usePatientGuardians";
import { GUARDIAN_LIMITS } from "../../types/patient";
import type { GuardianGroup } from "../../utils/guardian";
import { GuardianForm } from "./GuardianForm";
import { GuardianGroupList } from "./GuardianGroupList";
import { GuardianPatientSummary, type GuardianPatientSummaryData } from "./GuardianPatientSummary";

interface Props {
  focus: GuardianPopupFocus | null;
  group: GuardianGroup;
  /** "Tạo hồ sơ" or "Chỉnh sửa hồ sơ" — the breadcrumb's first step. */
  parentTitle: string;
  patient: GuardianPatientSummaryData;
  patientAddress: string;
  /** The record being edited; it cannot be picked as its own guardian. */
  patientId?: string;
  onSave: (group: GuardianGroup) => void;
  onClose: () => void;
  /** The Hồ sơ tab writes on save; the button waits for the server. */
  saving?: boolean;
}

const consentRule = {
  validator: (_: unknown, value: boolean | undefined) =>
    value ? Promise.resolve() : Promise.reject(new Error(t("Patient:Guardian:ConsentRequired"))),
};

/**
 * "Thông tin người giám hộ" — edits a copy of the guardian group. Every way
 * out but "Lưu & quay lại hồ sơ" drops the copy; that one hands it back. The
 * hồ sơ dialog holds it until its own Lưu; the Hồ sơ tab writes it at once.
 */
export function GuardianDialog({
  focus,
  group,
  parentTitle,
  patient,
  patientAddress,
  patientId,
  onSave,
  onClose,
  saving,
}: Props) {
  const popup = useGuardianPopupForm(focus, group);
  const fetchPatient = useFetchPatientDto();
  const grouped = popup.guardians.length > 1;
  const full = popup.guardians.length >= GUARDIAN_LIMITS.maxPerPatient;

  const handlePick = async (index: number, id: string) => {
    try {
      popup.fillFromPatient(index, await fetchPatient(id));
    } catch (error) {
      notifyError(describeApiError(error).message);
    }
  };

  const handleSave = async () => {
    const next = await popup.submit();
    if (next) onSave(next);
  };

  const renderForm = (index: number) => (
    <GuardianForm
      index={index}
      patientAddress={patientAddress}
      excludePatientId={patientId}
      onPick={(id) => void handlePick(index, id)}
      onPrimaryChange={(checked) => popup.setPrimary(index, checked)}
    />
  );

  return (
    <Modal
      open={focus !== null}
      width={1000}
      destroyOnHidden
      mask={{ closable: false }}
      className="app-dialog bd-guardian-dialog"
      onCancel={onClose}
      title={
        <div className="bd-guardian-dialog-head">
          <Button
            className="bd-guardian-back"
            icon={<ArrowLeftOutlined />}
            aria-label={t("Patient:Guardian:Back")}
            onClick={onClose}
          />
          <div className="bd-min0">
            <h2 className="bd-modal-title">{t("Patient:Guardian:DialogTitle")}</h2>
            <p className="bd-guardian-crumb">
              {parentTitle} <RightOutlined /> {t("Patient:Guardian:Tab")}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="bd-modal-foot">
          <div className="bd-min0">
            {grouped ? (
              <span className="bd-guardian-count">{t("Patient:Guardian:GroupCount", popup.guardians.length)}</span>
            ) : (
              <Button type="link" icon={<PlusOutlined />} disabled={full} onClick={popup.add}>
                {t("Patient:Guardian:AddSecond")}
              </Button>
            )}
          </div>
          <div className="bd-modal-foot-actions">
            <Button onClick={onClose}>{t("Common:Cancel")}</Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {t("Patient:Guardian:SaveAndBack")}
            </Button>
          </div>
        </div>
      }
    >
      <Form form={popup.form} layout="vertical" requiredMark={false} component="div">
        <GuardianPatientSummary patient={patient} />

        {grouped ? (
          <GuardianGroupList
            guardians={popup.guardians}
            activeKeys={popup.activeKeys}
            onActiveKeysChange={popup.setActiveKeys}
            onAdd={popup.add}
            onRemove={popup.remove}
            renderForm={renderForm}
          />
        ) : (
          popup.guardians.length === 1 && renderForm(0)
        )}

        <Form.Item name="consented" valuePropName="checked" rules={[consentRule]} className="bd-guardian-consent">
          <Checkbox>
            {t("Patient:Guardian:Consent")}
            <span className="floating-field-required">*</span>
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
}
