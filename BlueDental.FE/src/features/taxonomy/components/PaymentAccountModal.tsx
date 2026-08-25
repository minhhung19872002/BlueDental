import { Button, message } from "antd";
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
import { LabeledField } from "@/components/LabeledField";
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

type Errors = Partial<
  Record<"holderName" | "phoneNumber" | "bankName" | "accountNumber" | "qrImage", string>
>;

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

  const [holderName, setHolderName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  /** A QR picked in this dialog but not uploaded yet — the row must exist first. */
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  /** The saved QR was removed here; the deletion goes out with the save. */
  const [qrRemoved, setQrRemoved] = useState(false);
  const qrInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setHolderName(account?.holderName ?? "");
    setPhoneNumber(account?.phoneNumber ?? "");
    setBankName(account?.bankName ?? "");
    setAccountNumber(account?.accountNumber ?? "");
    setErrors({});
    setQrFile(null);
    setQrPreview(null);
    setQrRemoved(false);
  }, [open, account]);

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
      setErrors((current) => ({
        ...current,
        qrImage: t("Chỉ chấp nhận ảnh PNG, JPG hoặc WEBP"),
      }));
      return;
    }

    if (file.size > MAX_QR_BYTES) {
      setErrors((current) => ({ ...current, qrImage: t("Ảnh QR phải nhỏ hơn 5 MB") }));
      return;
    }

    setErrors((current) => ({ ...current, qrImage: undefined }));
    setQrFile(file);
    setQrRemoved(false);
  };

  const clearQrImage = () => {
    setQrFile(null);
    setQrPreview(null);
    setQrRemoved(true);
    setErrors((current) => ({ ...current, qrImage: undefined }));
    if (qrInputRef.current) qrInputRef.current.value = "";
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!holderName.trim()) next.holderName = t("Vui lòng nhập tên chủ tài khoản");

    if (isMoMo) {
      if (!phoneNumber.trim()) next.phoneNumber = t("Vui lòng nhập số điện thoại");
    } else {
      if (!bankName.trim()) next.bankName = t("Vui lòng nhập tên ngân hàng");
      if (!accountNumber.trim()) next.accountNumber = t("Vui lòng nhập số tài khoản");
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async () => {
    if (!validate()) return;

    const payload = {
      holderName: holderName.trim(),
      phoneNumber: isMoMo ? phoneNumber.trim() : undefined,
      bankName: isMoMo ? undefined : bankName.trim(),
      accountNumber: isMoMo ? undefined : accountNumber.trim(),
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
      onSave={() => void submit()}
      onClose={onClose}
    >
      <div className="bd-dialog-stack">
        {isMoMo ? (
          <LabeledField
            id="payment-phone"
            label={t("Số điện thoại")}
            required
            type="tel"
            value={phoneNumber}
            error={errors.phoneNumber}
            onChange={setPhoneNumber}
          />
        ) : (
          <LabeledField
            id="payment-bank"
            label={t("Tên ngân hàng")}
            required
            value={bankName}
            error={errors.bankName}
            onChange={setBankName}
          />
        )}

        <LabeledField
          id="payment-holder"
          label={t("Tên chủ tài khoản")}
          required
          value={holderName}
          error={errors.holderName}
          onChange={setHolderName}
        />

        {!isMoMo && (
          <LabeledField
            id="payment-number"
            label={t("Số tài khoản")}
            required
            value={accountNumber}
            error={errors.accountNumber}
            onChange={setAccountNumber}
          />
        )}

        <div className="bd-dialog-stack bd-dialog-stack--tight">
          <label htmlFor="payment-qr" className="bd-cat-strong">
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
            aria-invalid={Boolean(errors.qrImage)}
            aria-describedby={errors.qrImage ? "payment-qr-error" : undefined}
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

          {errors.qrImage && (
            <p id="payment-qr-error" role="alert" className="bd-error-text">
              {errors.qrImage}
            </p>
          )}
        </div>
      </div>
    </AppDialog>
  );
}
