import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button, Card, Empty, Image, Popconfirm, Space, Typography } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import {
  useDeletePatientImage,
  usePatientImages,
  useUploadPatientImage,
} from "../api/patientImageApi";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDateTime } from "@/utils/format";
import { t } from "@/lib/i18n";

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
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
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
        <Button
          type="primary"
          icon={<UploadOutlined />}
          loading={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {t("Thêm ảnh")}
        </Button>
      </div>

      <Card size="small" loading={isLoading}>
        {images.length === 0 ? (
          <Empty description={t("Chưa có hình ảnh")} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: 12 }}
            data-testid="patient-image-grid"
          >
            {images.map((image) => (
              <div key={image.id} style={{ width: 180 }}>
                <Image
                  // The server already returns an app-relative path, prefix and all.
                  src={image.url}
                  alt={image.fileName}
                  width={180}
                  height={140}
                  style={{ objectFit: "cover", borderRadius: 8 }}
                />
                <div style={{ marginTop: 4 }}>
                  <Text ellipsis style={{ fontSize: 12, display: "block" }}>
                    {image.fileName}
                  </Text>
                  <Space size={4} style={{ fontSize: 11, color: "#98a4b4" }}>
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
      </Card>
    </div>
  );
}
