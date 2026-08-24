// FileUploader — wraps Ant Design Upload for consistent file upload UX.
// Supports drag-and-drop, previewing images, and upload progress.

import { Upload, type UploadProps } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface Props extends UploadProps {
  hint?: string;
}

export function FileUploader({ hint, ...uploadProps }: Props) {
  return (
    <Upload.Dragger
      {...uploadProps}
      style={{ borderRadius: 10, ...uploadProps.style }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">
        {t("Kéo thả hoặc nhấp để chọn tệp")}
      </p>
      {hint && (
        <p className="ant-upload-hint" style={{ fontSize: 12 }}>
          {hint}
        </p>
      )}
    </Upload.Dragger>
  );
}
