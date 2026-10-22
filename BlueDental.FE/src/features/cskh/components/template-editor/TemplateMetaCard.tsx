import { Form, Input, Select } from "antd";
import { t } from "@/lib/i18n";
import type { CareType } from "../../api/careApi";
import { MESSAGE_TEMPLATE_LIMITS } from "../../api/templateApi";
import { CARE_TABS } from "../../careTabs";
import { EditorCard } from "./EditorCard";

interface TemplateMetaCardProps {
  name: string;
  purpose: CareType | null;
  readOnly: boolean;
  onNameChange: (name: string) => void;
  onPurposeChange: (purpose: CareType | null) => void;
}

/**
 * Tên mẫu and Mục đích. Mục đích is one of the CSKH board's tabs, which is
 * where "Gửi tin nhắn chăm sóc" offers the template; both are required by
 * Lưu mẫu, only the name by Lưu nháp — the server says which is missing.
 */
export function TemplateMetaCard({ name, purpose, readOnly, onNameChange, onPurposeChange }: TemplateMetaCardProps) {
  return (
    <EditorCard>
      <Form layout="vertical" component="div" className="tpe-meta" disabled={readOnly}>
        <Form.Item label={t("CSKH:Template:Name")} required htmlFor="tpe-name">
          <Input
            id="tpe-name"
            value={name}
            maxLength={MESSAGE_TEMPLATE_LIMITS.name}
            placeholder={t("CSKH:Template:NamePlaceholder")}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </Form.Item>
        <Form.Item label={t("CSKH:Template:Purpose")} required htmlFor="tpe-purpose">
          <Select<CareType>
            id="tpe-purpose"
            allowClear
            value={purpose ?? undefined}
            placeholder={t("CSKH:Template:PurposePlaceholder")}
            onChange={(value) => onPurposeChange(value ?? null)}
            options={CARE_TABS.map((tab) => ({ value: tab.type, label: tab.label() }))}
          />
        </Form.Item>
      </Form>
    </EditorCard>
  );
}
