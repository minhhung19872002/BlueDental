import { Input } from "antd";
import { Search } from "lucide-react";
import { t } from "@/lib/i18n";

export type AdviseKind = "single" | "combo";

interface Props {
  kind: AdviseKind;
  singleCount: number;
  comboCount: number;
  search: string;
  onKindChange: (kind: AdviseKind) => void;
  onSearchChange: (search: string) => void;
}

/**
 * "Lựa chọn dịch vụ" with its "Dịch vụ lẻ (n) | Combo (m)" switch and the
 * search box, which looks for services or for combos by the tab open
 * (review P0510).
 */
export function AdvisePickerHead({ kind, singleCount, comboCount, search, onKindChange, onSearchChange }: Props) {
  const placeholder = kind === "combo" ? t("Treatment:Combo:SearchCombo") : t("Treatment:Advise:SearchService");
  const tabs: { kind: AdviseKind; label: string }[] = [
    { kind: "single", label: t("Treatment:Combo:TabSingle", singleCount) },
    { kind: "combo", label: t("Treatment:Combo:TabCombo", comboCount) },
  ];

  return (
    <div className="am-picker-head">
      <p>{t("Treatment:Advise:ServiceSelection")}</p>
      <div className="am-kind-tabs" role="tablist" aria-label={t("Treatment:Advise:ServiceSelection")}>
        {tabs.map((tab) => (
          <button
            key={tab.kind}
            type="button"
            role="tab"
            aria-selected={kind === tab.kind}
            className={kind === tab.kind ? "active" : undefined}
            onClick={() => onKindChange(tab.kind)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <Input
        className="am-picker-search"
        allowClear
        prefix={<Search size={16} />}
        placeholder={placeholder}
        aria-label={placeholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
      />
    </div>
  );
}
