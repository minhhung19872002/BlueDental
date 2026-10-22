import { Spin } from "antd";
import type { UseQueryResult } from "@tanstack/react-query";
import { t } from "@/lib/i18n";
import { extractApiError } from "@/lib/apiError";
import type { MessageVariable, ZnsTemplateDetail } from "../../api/templateApi";
import { isZaloNotConnected } from "./zaloErrors";
import { ZnsParamRow } from "./ZnsParamRow";

interface ZnsParamListProps {
  templateId: string | null;
  detail: UseQueryResult<ZnsTemplateDetail>;
  paramMap: Record<string, string>;
  variables: readonly MessageVariable[];
  readOnly: boolean;
  onParamMapChange: (paramMap: Record<string, string>) => void;
  onParamFocus: (name: string) => void;
}

function ParamRows({ templateId, detail, paramMap, variables, readOnly, onParamMapChange, onParamFocus }: ZnsParamListProps) {
  if (!templateId) return <p className="tpl-muted">{t("CSKH:Template:ZnsPickFirst")}</p>;
  if (detail.isLoading) return <Spin size="small" />;
  // "Chưa kết nối" is already said once, above the ZNS picker.
  if (detail.isError) return isZaloNotConnected(detail.error) ? null : <p className="tpe-warn">{extractApiError(detail.error)}</p>;

  const handleChange = (name: string, value: string) => {
    const next = { ...paramMap };
    if (value.trim()) next[name] = value;
    else delete next[name];
    onParamMapChange(next);
  };

  return (
    <div className="tpe-zns-params">
      {(detail.data?.params ?? []).map((param) => (
        <ZnsParamRow
          key={param.name}
          param={param}
          value={paramMap[param.name] ?? ""}
          variables={variables}
          readOnly={readOnly}
          onChange={(value) => handleChange(param.name, value)}
          onFocus={() => onParamFocus(param.name)}
        />
      ))}
    </div>
  );
}

/** Tham số của mẫu ZNS: what each of Zalo's parameters is filled with. */
export function ZnsParamList(props: ZnsParamListProps) {
  return (
    <div className="tpe-field">
      <div className="tpe-field-head">
        <span className="tpe-label">{t("CSKH:Template:ZnsParams")}</span>
        <span className="tpe-card-hint">{t("CSKH:Template:ZnsParamsHint")}</span>
      </div>
      <ParamRows {...props} />
    </div>
  );
}
