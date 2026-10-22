import { useEffect, useState } from "react";
import { Alert, Select } from "antd";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import { useZnsTemplate, useZnsTemplates, type MessageVariable } from "../../api/templateApi";
import { prefillParamMap } from "../../znsParamDefaults";
import { znsStatusLabel } from "../templates/templateLook";
import { isZaloNotConnected } from "./zaloErrors";
import { ZnsParamList } from "./ZnsParamList";

interface ZaloTemplateSectionProps {
  externalTemplateId: string | null;
  paramMap: Record<string, string>;
  variables: readonly MessageVariable[];
  readOnly: boolean;
  onTemplateChange: (templateId: string | null) => void;
  onParamMapChange: (paramMap: Record<string, string>) => void;
  onParamFocus: (name: string) => void;
}

/**
 * A Zalo template is a ZNS template Zalo already approved: pick it, then say
 * what fills each parameter. A fresh pick pre-fills the parameters whose names
 * say what they want (znsParamDefaults).
 */
export function ZaloTemplateSection(props: ZaloTemplateSectionProps) {
  const { externalTemplateId, paramMap, variables, readOnly, onTemplateChange, onParamMapChange, onParamFocus } = props;
  const list = useZnsTemplates(true);
  const detail = useZnsTemplate(externalTemplateId);
  const [prefillFor, setPrefillFor] = useState<string | null>(null);
  const notConnected = isZaloNotConnected(list.error);

  useEffect(() => {
    if (!prefillFor || detail.data?.templateId !== prefillFor) return;
    setPrefillFor(null);
    onParamMapChange(prefillParamMap(detail.data.params, variables.map((variable) => variable.key)));
  }, [prefillFor, detail.data, variables, onParamMapChange]);

  const options = (list.data ?? []).map((template) => ({
    value: template.templateId,
    label: `${template.name} · #${template.templateId}`,
  }));
  // A template removed on Zalo since it was saved still shows what it was.
  if (externalTemplateId && !options.some((option) => option.value === externalTemplateId)) {
    options.unshift({ value: externalTemplateId, label: t("CSKH:Template:ZnsRef", externalTemplateId) });
  }

  const handleTemplateChange = (templateId: string | undefined) => {
    onTemplateChange(templateId ?? null);
    setPrefillFor(templateId ?? null);
  };

  return (
    <>
      <div className="tpe-field">
        <label className="tpe-label tpe-label--required" htmlFor="tpe-zns">
          {t("CSKH:Template:Zns")}
        </label>
        {notConnected && <Alert type="warning" showIcon message={t("CSKH:Template:ZaloNotConnected")} />}
        {list.isError && !notConnected && <p className="tpe-warn">{extractApiError(list.error)}</p>}
        <Select
          id="tpe-zns"
          showSearch
          allowClear
          optionFilterProp="label"
          loading={list.isLoading}
          disabled={readOnly || notConnected}
          value={externalTemplateId ?? undefined}
          options={options}
          placeholder={t("CSKH:Template:ZnsPlaceholder")}
          onChange={handleTemplateChange}
        />
        {detail.data && (
          <span className="tpe-hint">{t("CSKH:Template:ZnsStatus", znsStatusLabel(detail.data.status))}</span>
        )}
      </div>
      <ZnsParamList
        templateId={externalTemplateId}
        detail={detail}
        paramMap={paramMap}
        variables={variables}
        readOnly={readOnly}
        onParamMapChange={onParamMapChange}
        onParamFocus={onParamFocus}
      />
    </>
  );
}
