import { useRef, useState, type ChangeEvent } from "react";
import { Button, Form } from "antd";
import { CloseOutlined, LoadingOutlined, PaperClipOutlined, UploadOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useUploadGuardianDocument } from "../../api/patientMutations";
import { GUARDIAN_FILE_ACCEPT, guardianFileProblem } from "../../utils/guardian";

interface Props {
  index: number;
}

/**
 * "Tải ảnh / PDF giấy tờ (JPG, PNG, PDF ≤ 5MB)". Not required for now (BA,
 * 2026-10-07) — but a file that is chosen must be one of those types and
 * size, checked here before it is sent and again by the server.
 */
export function GuardianProofUpload({ index }: Props) {
  const form = Form.useFormInstance();
  const fileName: string | null | undefined = Form.useWatch(["guardians", index, "proofFileName"], {
    form,
    // The file fields have no Form.Item of their own, so the watch must read the whole store.
    preserve: true,
  });
  const upload = useUploadGuardianDocument();
  const [problem, setProblem] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const setDocument = (blobName: string | null, name: string | null) => {
    form.setFieldValue(["guardians", index, "proofBlobName"], blobName);
    form.setFieldValue(["guardians", index, "proofFileName"], name);
  };

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared so picking the same file again still fires a change.
    event.target.value = "";
    if (!file) return;

    const fileProblem = guardianFileProblem(file);
    setProblem(fileProblem);
    if (fileProblem) return;

    const stored = await upload.mutateAsync(file).catch(() => null);
    if (stored) setDocument(stored.blobName, stored.fileName);
  };

  return (
    <div className="bd-guardian-upload">
      <input
        ref={input}
        type="file"
        hidden
        accept={GUARDIAN_FILE_ACCEPT}
        data-testid={`guardian-proof-file-${index}`}
        onChange={(event) => void handleChange(event)}
      />
      <Button
        icon={upload.isPending ? <LoadingOutlined /> : <UploadOutlined />}
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
      >
        {t("Patient:Guardian:Upload")}
      </Button>

      {fileName && (
        <span className="bd-guardian-upload-file">
          <PaperClipOutlined /> {fileName}
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            aria-label={t("Patient:Guardian:RemoveFile")}
            onClick={() => setDocument(null, null)}
          />
        </span>
      )}

      {problem && <div className="ant-form-item-explain-error">{t(problem)}</div>}
    </div>
  );
}
