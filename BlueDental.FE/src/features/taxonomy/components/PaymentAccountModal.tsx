import { Button } from "antd";
import { toast } from "sonner";
import { Form, Input } from "antd";
import { useEffect, useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import {
  PAYMENT_ACCOUNT_KIND,
  useCreatePaymentAccount,
  useDeletePaymentAccountQrImage,
  useUpdatePaymentAccount,
  useUploadPaymentAccountQrImage,
  type PaymentAccountDto,
  type PaymentAccountKind,
} from "../api/paymentAccountApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { extractApiError } from "@/lib/apiError";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { validateImageFile, IMAGE_ACCEPT } from "@/utils/validateImageFile";

interface Props {
  open: boolean;
  /** Which tab the screen is on; a saved account never changes kind. */
  kind: PaymentAccountKind;
  account: PaymentAccountDto | null;
  onClose: () => void;
}

interface FormValues {
  holderName: string;
  phoneNumber: string;
  bankName: string;
  accountNumber: string;
}

/** @see validateImageFile — shared type + size check used app-wide. */

export function PaymentAccountModal({ open, kind, account, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const createAccount = useCreatePaymentAccount();
  const updateAccount = useUpdatePaymentAccount();
  const uploadQrImage = useUploadPaymentAccountQrImage();
  const deleteQrImage = useDeletePaymentAccountQrImage();

  const activeKind = account?.kind ?? kind;
  const isMoMo = activeKind === PAYMENT_ACCOUNT_KIND.MoMo;

  const [form] = Form.useForm<FormValues>();
  const holderName = Form.useWatch("holderName", form) ?? "";
  const phoneNumber = Form.useWatch("phoneNumber", form) ?? "";
  const bankName = Form.useWatch("bankName", form) ?? "";
  const accountNumber = Form.useWatch("accountNumber", form) ?? "";
  /** The QR is a file, not a form value, so its own error lives here. */
  const [qrError, setQrError] = useState<string | null>(null);

  /** A QR picked in this dialog but not uploaded yet — the row must exist first. */
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  /** The saved QR was removed here; the deletion goes out with the save. */
  const [qrRemoved, setQrRemoved] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      holderName: account?.holderName ?? "",
      phoneNumber: account?.phoneNumber ?? "",
      bankName: account?.bankName ?? "",
      accountNumber: account?.accountNumber ?? "",
    });
    setQrError(null);
    setQrFile(null);
    setQrPreview(null);
    setQrRemoved(false);
  }, [open, account, form]);

  // The preview of a locally picked file is an object URL, so it has to be
  // released when it is replaced or the dialog goes away.
  useEffect(() => {
    if (!qrFile) return undefined;

    const url = URL.createObjectURL(qrFile);
    setQrPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [qrFile]);

  const pending =
    createAccount.isPending ||
    updateAccount.isPending ||
    uploadQrImage.isPending ||
    deleteQrImage.isPending;

  /** The saved QR, unless it was replaced or removed in this dialog. */
  const savedQrUrl = qrFile || qrRemoved ? null : account?.qrImageUrl;
  const shownQrUrl = qrPreview ?? savedQrUrl ?? null;
  const shownQrName = qrFile?.name ?? (savedQrUrl ? (account?.qrImageFileName ?? "") : "");

  const pickQrFile = (file: File) => {
    const error = validateImageFile(file);
    if (error) {
      setQrError(error);
      return;
    }

    setQrError(null);
    setQrFile(file);
    setQrRemoved(false);
  };

  const clearQrImage = () => {
    setQrFile(null);
    setQrPreview(null);
    setQrRemoved(true);
    setQrError(null);
    if (qrInputRef.current) qrInputRef.current.value = "";
  };

  const submit = async (values: FormValues) => {
    const payload = {
      holderName: values.holderName.trim(),
      phoneNumber: isMoMo ? values.phoneNumber.trim() : undefined,
      bankName: isMoMo ? undefined : values.bankName.trim(),
      accountNumber: isMoMo ? undefined : values.accountNumber.trim(),
    };

    let saved: PaymentAccountDto;

    try {
      saved = account
        ? await updateAccount.mutateAsync({
            id: account.id,
            input: { ...payload, isActive: account.isActive },
          })
        : await createAccount.mutateAsync({
            clinicBranchId: branchId,
            kind: activeKind,
            ...payload,
          });
    } catch {
      // queryClient reports the failure; nothing to add here.
      return;
    }

    // The QR is a second call: a new account has no id to attach bytes to until
    // it has been created.
    try {
      if (qrFile) {
        await uploadQrImage.mutateAsync({ id: saved.id, file: qrFile });
      } else if (qrRemoved && account?.hasQrImage) {
        await deleteQrImage.mutateAsync(saved.id);
      }
    } catch (cause) {
      // The account itself is already saved, so the dialog closes rather than
      // inviting a second submit that would create a duplicate.
      toast.error(
        `${t("Taxonomy:Payment:SavedNoQR")}: ${extractApiError(cause)}`,
      );
      onClose();
      return;
    }

    toast.success(
      account ? t("Taxonomy:Payment:Updated") : t("Taxonomy:Payment:Created"),
    );
    onClose();
  };

  const canSave = isMoMo
    ? phoneNumber.trim().length > 0 && holderName.trim().length > 0
    : bankName.trim().length > 0 && holderName.trim().length > 0 && accountNumber.trim().length > 0;

  return (
    <AppDialog
      open={open}
      title={account ? t("Taxonomy:Payment:UpdateTitle") : t("Taxonomy:Payment:CreateTitle")}
      width={440}
      canSave={canSave}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ holderName: "", phoneNumber: "", bankName: "", accountNumber: "" }}
        onFinish={(values) => void submit(values)}
      >
        {isMoMo ? (
          <FloatingField
            name="phoneNumber"
            label={t("Taxonomy:Payment:Phone")}
            required
            rules={[{ required: true, message: t("Taxonomy:Payment:PhoneRequired") }]}
          >
            <Input type="tel" autoFocus />
          </FloatingField>
        ) : (
          <FloatingField
            name="bankName"
            label={t("Taxonomy:Payment:BankName")}
            required
            rules={[{ required: true, message: t("Taxonomy:Payment:BankNameRequired") }]}
          >
            <Input autoFocus />
          </FloatingField>
        )}

        <FloatingField
          name="holderName"
          label={t("Taxonomy:Payment:AccountHolder")}
          required
          rules={[{ required: true, message: t("Taxonomy:Payment:AccountHolderRequired") }]}
        >
          <Input />
        </FloatingField>

        {!isMoMo && (
          <FloatingField
            name="accountNumber"
            label={t("Taxonomy:Payment:AccountNumber")}
            required
            rules={[{ required: true, message: t("Taxonomy:Payment:AccountNumberRequired") }]}
          >
            <Input />
          </FloatingField>
        )}

        <div className="bd-dialog-section">
          <label htmlFor="payment-qr" className="bd-dialog-section-title">
            {t("Taxonomy:Payment:UploadQR")}
          </label>

          {/* A plain input keeps the upload a real multipart POST. */}
          <input
            ref={qrInputRef}
            id="payment-qr"
            type="file"
            accept={IMAGE_ACCEPT}
            data-testid="payment-qr-input"
            className="bd-sr-only"
            aria-invalid={Boolean(qrError)}
            aria-describedby={qrError ? "payment-qr-error" : undefined}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) pickQrFile(file);
            }}
          />

          {shownQrUrl ? (
            <div className="bd-pay-qr">
              <img
                src={shownQrUrl}
                alt={t("Taxonomy:Payment:QRImage")}
                data-testid="payment-qr-preview"
                className="bd-pay-qr-img"
              />
              <div className="bd-pay-qr-meta">
                <span className="bd-cat-filename">{shownQrName}</span>
                <div className="bd-cat-inline">
                  <Button
                    htmlType="button"
                    variant="outlined"
                    size="small"
                    onClick={() => qrInputRef.current?.click()}
                  >
                    {t("Taxonomy:Payment:ChangeImage")}
                  </Button>
                  <Button
                    htmlType="button"
                    variant="text"
                    size="small"
                    className="bd-danger-text"
                    onClick={clearQrImage}
                  >
                    <Trash2 className="bd-icon bd-icon--sm" aria-hidden="true" />
                    {t("Taxonomy:Payment:RemoveImage")}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* The reference draws a small dashed button here, not a full-width
               drop zone. */
            <button
              type="button"
              data-testid="payment-qr-upload"
              onClick={() => qrInputRef.current?.click()}
              className="bd-pay-upload"
            >
              <ImageUp className="bd-icon bd-icon--lg" aria-hidden="true" />
              {t("Taxonomy:Payment:UploadQR")}
            </button>
          )}

          {qrError && (
            <p id="payment-qr-error" role="alert" className="bd-error-text">
              {qrError}
            </p>
          )}
        </div>
      </Form>
    </AppDialog>
  );
}
