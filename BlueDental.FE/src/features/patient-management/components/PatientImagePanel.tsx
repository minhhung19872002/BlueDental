import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Image, Popconfirm, Select, Space, Spin, Typography } from "antd";
import { DeleteOutlined, PictureOutlined, UploadOutlined } from "@ant-design/icons";
import {
  useDeletePatientImage,
  usePatientImages,
  useUploadPatientImage,
} from "../api/patientImageApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDateTime } from "@/utils/format";
import { t } from "@/lib/i18n";
import { useTreatmentStages } from "@/features/treatment-management/api/stageApi";

const { Text } = Typography;

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
  const [stageId, setStageId] = useState<string>();

  const { data, isLoading } = usePatientImages(patientId, branchId);
  const stages =
    useTreatmentStages({ patientId, clinicBranchId: branchId, maxResultCount: 200 }).data?.items ??
    [];

  const uploadImage = useUploadPatientImage();
  const deleteImage = useDeletePatientImage();

  const images = (data?.items ?? []).filter(
    (image) => !stageId || image.treatmentStageId === stageId,
  );

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
    <div className="pd-images">
      <div className="pd-image-controls">
        {/* A plain input keeps the upload a real multipart POST. */}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          data-testid="patient-image-input"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <Select
          allowClear
          placeholder={t("Giai đoạn điều trị")}
          value={stageId}
          onChange={setStageId}
          options={stages.map((stage) => ({ value: stage.id, label: stage.name }))}
        />
        <Button
          icon={<UploadOutlined />}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {t("Tải ảnh")}
        </Button>
      </div>

      <div
        className={
          images.length === 0 ? "pd-image-gallery pd-image-gallery--empty" : "pd-image-gallery"
        }
      >
        {isLoading ? (
          <Spin />
        ) : images.length === 0 ? (
          <div>
            <PictureOutlined />
            <strong>{t("Không có ảnh trong bộ lọc đã chọn")}</strong>
            <span>{t("Hãy đổi bộ lọc hoặc tải thêm ảnh để tiếp tục.")}</span>
          </div>
        ) : (
          <div className="pd-image-grid" data-testid="patient-image-grid">
            {images.map((image) => (
              <div key={image.id} className="pd-image-item">
                <Image
                  // The server already returns an app-relative path, prefix and all.
                  src={image.url}
                  alt={image.fileName}
                  width="100%"
                  height={140}
                  style={{ objectFit: "cover", borderRadius: 8 }}
                />
                <div className="pd-image-meta">
                  <Text ellipsis style={{ fontSize: 12, display: "block" }}>
                    {image.fileName}
                  </Text>
                  <Space size={4} style={{ fontSize: 11, color: "#99a0bd" }}>
                    <span>{formatDateTime(image.takenAt)}</span>
                    <Popconfirm
                      title={t("Xoá ảnh này?")}
                      okText={t("Xoá")}
                      cancelText={t("Huỷ")}
                      onConfirm={async () => {
                        try {
                          await deleteImage.mutateAsync(image.id);
                          toast.success(t("Đã xoá ảnh"));
                        } catch (error) {
                          toast.error(extractApiError(error));
                        }
                      }}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
