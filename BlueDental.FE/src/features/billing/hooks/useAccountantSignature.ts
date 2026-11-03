import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { signatureImageFrom } from "@/utils/signatureImage";
import {
  ACCOUNTANT_SIGNATURE_SOURCE,
  useMyAccountantSignature,
  useSaveAccountantSignature,
  type AccountantSignatureSource,
} from "../api/accountantSignatureApi";

/** A picked picture waiting on "Dùng chữ ký này" in the Xem ảnh chữ ký popup. */
export interface SignatureUpload {
  dataUrl: string;
  fileName: string;
  sizeKb: number;
}

/**
 * Ký điện tử on the export column (P2910_02): the user's saved signature,
 * or the pad when there is none yet or they chose Ký lại; a picture picked
 * with Tải ảnh lên waits in the preview until it is used. Each save replaces
 * the saved one and the server logs it. Failures are toasted by the global
 * MutationCache.
 */
export function useAccountantSignature(enabled: boolean) {
  const { data, isLoading } = useMyAccountantSignature(enabled);
  const save = useSaveAccountantSignature();
  const [signingAgain, setSigningAgain] = useState(false);
  const [upload, setUpload] = useState<SignatureUpload | null>(null);
  const signature = data ?? null;

  const saveAs = (dataUrl: string, source: AccountantSignatureSource) =>
    save.mutate(
      { signatureDataUrl: dataUrl, source },
      {
        onSuccess: () => {
          setSigningAgain(false);
          setUpload(null);
          toast.success(t("Receipt:Export:SignatureSaved"));
        },
      },
    );

  const handlePick = async (file: File) => {
    const picked = await signatureImageFrom(file);
    if (!picked.ok) {
      toast.error(t(`Receipt:Upload:${picked.error}`));
      return;
    }
    setUpload({ dataUrl: picked.dataUrl, fileName: file.name, sizeKb: Math.max(1, Math.round(file.size / 1024)) });
  };

  return {
    signature,
    loading: enabled && isLoading,
    saving: save.isPending,
    /** The pad shows until a signature is saved, and again on Ký lại. */
    padOpen: !signature || signingAgain,
    upload,
    signAgain: () => setSigningAgain(true),
    cancelSignAgain: () => setSigningAgain(false),
    saveDrawn: (dataUrl: string) => saveAs(dataUrl, ACCOUNTANT_SIGNATURE_SOURCE.Drawn),
    pick: (file: File) => void handlePick(file),
    /** Dùng chữ ký này: its saved time is this click (BA). */
    applyUpload: () => {
      if (upload) saveAs(upload.dataUrl, ACCOUNTANT_SIGNATURE_SOURCE.Uploaded);
    },
    dropUpload: () => setUpload(null),
  };
}

export type AccountantSignatureState = ReturnType<typeof useAccountantSignature>;
