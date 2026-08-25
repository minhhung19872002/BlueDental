import { Button, message } from "antd";
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

/** Kept in step with PaymentAccount.MaxQrImageBytes on the server. */
const MAX_QR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_QR_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

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
    if (!ACCEPTED_QR_TYPES.includes(file.type)) {
      setQrError(t("Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP"));
      return;
    }

    if (file.size > MAX_QR_BYTES) {
      setQrError(t("Ảnh QR phải nhỏ hơn 5 MB"));
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
    } catch (cause) {
      message.error(extractApiError(cause));
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
      message.error(
        `${t("Đã lưu phương thức thanh toán nhưng chưa lưu được ảnh QR")}: ${extractApiError(cause)}`,
      );
      onClose();
      return;
    }

    message.success(
      account ? t("Đã cập nhật phương thức thanh toán") : t("Đã thêm phương thức thanh toán"),
    );
    onClose();
  };

  const canSave = isMoMo
    ? phoneNumber.trim().length > 0 && holderName.trim().length > 0
    : bankName.trim().length > 0 && holderName.trim().length > 0 && accountNumber.trim().length > 0;

  return (
    <AppDialog
      open={open}
      title={account ? t("Cập nhật phương thức") : t("Thêm phương thức")}
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
            label={t("Số điện thoại")}
            required
            rules={[{ required: true, message: t("Vui lòng nhập số điện thoại") }]}
          >
            <Input type="tel" autoFocus />
          </FloatingField>
        ) : (
          <FloatingField
            name="bankName"
            label={t("Tên ngân hàng")}
            required
            rules={[{ required: true, message: t("Vui lòng nhập tên ngân hàng") }]}
          >
            <Input autoFocus />
          </FloatingField>
        )}

        <FloatingField
          name="holderName"
          label={t("Tên chủ tài khoản")}
          required
          rules={[{ required: true, message: t("Vui lòng nhập tên chủ tài khoản") }]}
        >
          <Input />
        </FloatingField>

        {!isMoMo && (
          <FloatingField
            name="accountNumber"
            label={t("Số tài khoản")}
            required
            rules={[{ required: true, message: t("Vui lòng nhập số tài khoản") }]}
          >
            <Input />
          </FloatingField>
        )}

        <div className="bd-dialog-section">
          <label htmlFor="payment-qr" className="bd-dialog-section-title">
            {t("Tải ảnh QR")}
          </label>

          {/* A plain input keeps the upload a real multipart POST. */}
          <input
            ref={qrInputRef}
            id="payment-qr"
            type="file"
            accept="image/png,image/jpeg,image/webp"
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
                alt={t("Ảnh QR")}
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
                    {t("Đổi ảnh")}
                  </Button>
                  <Button
                    htmlType="button"
                    variant="text"
                    size="small"
                    className="bd-danger-text"
                    onClick={clearQrImage}
                  >
                    <Trash2 className="bd-icon bd-icon--sm" aria-hidden="true" />
                    {t("Xoá ảnh")}
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
              {t("Tải ảnh QR")}
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
