// FileUploader — wraps Ant Design Upload for consistent file upload UX.
// Supports drag-and-drop, previewing images, and upload progress.

import { Upload, type UploadProps } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

interface Props extends UploadProps {
  hint?: string;
}

export function FileUploader({ hint, ...uploadProps }: Props) {
  const { t } = useTranslation();
  return (
    <Upload.Dragger
      {...uploadProps}
      style={{ borderRadius: 10, ...uploadProps.style }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">
        {t("common.dragDropOrClick")}
      </p>
      {hint && (
        <p className="ant-upload-hint" style={{ fontSize: 12 }}>
          {hint}
        </p>
      )}
    </Upload.Dragger>
  );
}
