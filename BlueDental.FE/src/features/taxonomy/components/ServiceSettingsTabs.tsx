import { Button, Checkbox, Col, Form, Input, InputNumber, Row, Tabs } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {
  SERVICE_STAGE_VALUE_TYPE,
  WARRANTY_PRESETS,
  type ServiceStageDto,
} from "../api/taxonomyApi";
import { FloatingField } from "@/components/FloatingField";
import type { PickerOption } from "@/hooks/useLaboPickers";
import { t } from "@/lib/i18n";
import { ServiceLaboTab } from "./ServiceLaboTab";
import { ServiceStageTable } from "./ServiceStageTable";

/** The form fields these tabs edit; both the service and the combo dialog hold them. */
type SettingField =
  | "requireImage"
  | "deductDoctorOnWarranty"
  | "separateRevenue"
  | "showToothOnInvoice"
  | "revenueByStage"
  | "requireStageSequence";

interface Props {
  stages: ServiceStageDto[];
  onStagesChange: (next: ServiceStageDto[]) => void;
  suppliers: PickerOption[];
  suppliersLoading: boolean;
}

/** Labels for the reference's fixed row of warranty choices. */
function warrantyLabel(days: number): string {
  if (days === 0) return t("Taxonomy:Service:WarrantyNone");
  if (days === 365) return t("Taxonomy:Service:Warranty1Year");
  if (days === 730) return t("Taxonomy:Service:Warranty2Years");
  return t("Taxonomy:Service:WarrantyMonths", String(Math.round(days / 30)));
}

/** One labelled checkbox with any number of explanation lines under it. */
function CheckRow({ name, label, hints = [] }: { name: SettingField; label: string; hints?: string[] }) {
  return (
    <div className="bd-check-row">
      <Form.Item name={name} valuePropName="checked" noStyle>
        <Checkbox>{label}</Checkbox>
      </Form.Item>
      {hints.map((hint) => (
        <p key={hint} className="bd-check-hint">
          {hint}
        </p>
      ))}
    </div>
  );
}

/**
 * "Cài đặt | Công đoạn | Bảo hành | Labo" — the setting tabs under a
 * service's price block. A combo carries the same four (review P0510), so
 * both dialogs render this inside their own Form; the fields bind to it.
 */
export function ServiceSettingsTabs({ stages, onStagesChange, suppliers, suppliersLoading }: Props) {
  const form = Form.useFormInstance();
  const warrantyDays = Form.useWatch("warrantyDays", form) ?? 0;

  const addStage = () => {
    const trimmed = (form.getFieldValue("stageDraft") as string | undefined)?.trim() ?? "";
    if (!trimmed) return;
    // A new row starts as a percentage share, as the reference's does.
    onStagesChange([
      ...stages,
      { name: trimmed, value: 0, valueType: SERVICE_STAGE_VALUE_TYPE.Percentage, isMarketingSalary: false },
    ]);
    form.setFieldValue("stageDraft", "");
  };

  return (
    <Tabs
      className="bd-dialog-tabs"
      items={[
        {
          key: "settings",
          label: t("Taxonomy:Service:Settings"),
          children: (
            <div className="bd-check-list">
              <CheckRow name="requireImage" label={t("Taxonomy:Service:RequireImage")} />
              <CheckRow name="deductDoctorOnWarranty" label={t("Taxonomy:Service:DeductOnWarranty")} />
              <CheckRow name="separateRevenue" label={t("Taxonomy:Service:SeparateRevenue")} />
              <CheckRow name="showToothOnInvoice" label={t("Taxonomy:Service:ShowToothInvoice")} />
            </div>
          ),
        },
        {
          key: "stages",
          label: t("Taxonomy:Service:Stages"),
          children: (
            <div className="bd-check-list">
              <CheckRow
                name="revenueByStage"
                label={t("Taxonomy:Service:RevenueByStage")}
                hints={[t("Taxonomy:Service:RevenueByStageHint")]}
              />
              <CheckRow
                name="requireStageSequence"
                label={t("Taxonomy:Service:RequireSequence")}
                hints={[
                  t("Taxonomy:Service:RequireStageSequenceHint"),
                  t("Taxonomy:Service:RequireStageSequenceHintOn"),
                ]}
              />

              <Row gutter={[8, 12]} align="middle" className="bd-stage-add">
                <Col flex="auto">
                  <FloatingField name="stageDraft" label={t("Taxonomy:Service:AddStageBtn")}>
                    <Input
                      maxLength={100}
                      onPressEnter={(event) => {
                        event.preventDefault();
                        addStage();
                      }}
                    />
                  </FloatingField>
                </Col>
                <Col flex="none">
                  <Button type="primary" icon={<PlusOutlined />} onClick={addStage}>
                    {t("Taxonomy:Service:AddStageBtn")}
                  </Button>
                </Col>
              </Row>

              <ServiceStageTable stages={stages} onChange={onStagesChange} />
            </div>
          ),
        },
        {
          key: "warranty",
          label: t("Taxonomy:Service:Warranty"),
          children: (
            <div className="bd-check-list">
              <Row gutter={[16, 8]}>
                {WARRANTY_PRESETS.map((days) => (
                  <Col xs={12} sm={8} key={days}>
                    <Checkbox
                      // The reference shows these as checkboxes but only one
                      // period can be in force, so picking one clears the rest.
                      checked={warrantyDays === days}
                      onChange={() => form.setFieldValue("warrantyDays", days)}
                    >
                      {warrantyLabel(days)}
                    </Checkbox>
                  </Col>
                ))}
              </Row>

              <Row gutter={[16, { xs: 20, sm: 12 }]} className="bd-mt3">
                <Col xs={24} sm={12}>
                  <FloatingField name="warrantyDays" label={t("Taxonomy:Service:Custom")}>
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </FloatingField>
                </Col>
              </Row>
              <p className="bd-cat-hint">{t("Taxonomy:Service:UnitDays")}</p>
            </div>
          ),
        },
        {
          key: "labo",
          label: t("Taxonomy:Service:TabLabo"),
          children: <ServiceLaboTab options={suppliers} loading={suppliersLoading} />,
        },
      ]}
    />
  );
}
