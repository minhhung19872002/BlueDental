import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  useDeletePatientImage,
  usePatientImages,
  useUploadPatientImage,
} from "../api/patientImageApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDateTime } from "@/utils/format";
import { t } from "@/lib/i18n";

interface PatientImagePanelProps {
  patientId: string;
}

/**
 * Hình ảnh — clinical photos and X-rays of one patient.
 *
 * The bytes live in object storage; this only ever handles a URL, which is why an
 * X-ray never lands in PostgreSQL.
 */
export function PatientImagePanel({ patientId }: PatientImagePanelProps) {
  const branchId = useCurrentBranchId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data, isLoading } = usePatientImages(patientId, branchId);

  const uploadImage = useUploadPatientImage();
  const deleteImage = useDeletePatientImage();

  const images = data?.items ?? [];

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      await uploadImage.mutateAsync({ patientId, clinicBranchId: branchId, file });
      toast.success(t("Đã tải ảnh lên"));
    } catch (error) {
      toast.error(extractApiError(error));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        {/* A plain input keeps the upload a real multipart POST. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          data-testid="patient-image-input"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="size-4 animate-spin mr-2" /> : <Upload size={14} className="mr-2" />}
          {t("Thêm ảnh")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="grid place-items-center py-8">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : images.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t("Chưa có hình ảnh")}</div>
          ) : (
            <div
              className="flex flex-wrap gap-3"
              data-testid="patient-image-grid"
            >
              {images.map((image) => (
                <div key={image.id} style={{ width: 180 }}>
                  <img
                    src={image.url}
                    alt={image.fileName}
                    width={180}
                    height={140}
                    style={{ objectFit: "cover", borderRadius: 8 }}
                  />
                  <div className="mt-1">
                    <span className="text-xs block truncate">{image.fileName}</span>
                    <div className="flex items-center gap-1 text-xs" style={{ color: "#98a4b4" }}>
                      <span>{formatDateTime(image.takenAt)}</span>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-6 w-6 p-0">
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("Xoá ảnh này?")}</AlertDialogTitle>
                            <AlertDialogDescription>{image.fileName}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("Huỷ")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await deleteImage.mutateAsync(image.id);
                                  toast.success(t("Đã xoá ảnh"));
                                } catch (error) {
                                  toast.error(extractApiError(error));
                                }
                              }}
                            >
                              {t("Xoá")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
