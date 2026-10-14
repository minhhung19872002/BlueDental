import { useMemo, useState } from "react";
import { Button, Checkbox, Input } from "antd";
import { FileSearchOutlined, FileTextOutlined, SearchOutlined } from "@ant-design/icons";
import type { TreatmentServiceDto } from "@/features/treatment-management/api/treatmentPlanApi";
import { t } from "@/lib/i18n";
import { formatMoneyUnit } from "@/utils/format";

interface Props {
  /** The chosen slip's code; null until one is chosen. */
  slipCode: string | null;
  lines: TreatmentServiceDto[];
  picked: string[];
  onToggle: (id: string, on: boolean) => void;
  onToggleAll: (on: boolean) => void;
}

function ServiceCard({ line, checked, onToggle }: {
  line: TreatmentServiceDto;
  checked: boolean;
  onToggle: (id: string, on: boolean) => void;
}) {
  const vat =
    line.taxAmount > 0
      ? t("Patient:Payment:IncludesVat", line.taxPercent, formatMoneyUnit(line.taxAmount))
      : t("Patient:Payment:NoVat");
  return (
    <li className={checked ? "pd-newpay-card pd-newpay-card--on" : "pd-newpay-card"}>
      <Checkbox checked={checked} onChange={(event) => onToggle(line.id, event.target.checked)}>
        <span className="pd-newpay-name">{line.serviceName ?? line.code}</span>
        <span className="pd-newpay-qty">
          {[t("Patient:Payment:QuantityValue", line.quantity), vat,
            t("Patient:Payment:PaidValue", formatMoneyUnit(line.paidAmount))].join(" · ")}
        </span>
      </Checkbox>
      <div className="pd-newpay-card-money">
        {/* Before VAT — after the slip discount and voucher — so the price reads
            as the price; Còn nợ is VAT included, as it is what the receipt collects. */}
        <b>{formatMoneyUnit(line.chargedAmount)}</b>
        <span className="pd-newpay-due">
          {t("Patient:Payment:OutstandingValue", formatMoneyUnit(line.outstandingAmount))}
        </span>
      </div>
    </li>
  );
}

/** "Dịch vụ": the chosen slip's services that still owe money. */
export function PaymentServiceList({ slipCode, lines, picked, onToggle, onToggleAll }: Props) {
  const [searching, setSearching] = useState(false);
  const [keyword, setKeyword] = useState("");
  const visible = useMemo(() => {
    const needle = keyword.trim().toLocaleLowerCase("vi");
    if (!needle) return lines;
    return lines.filter((line) => (line.serviceName ?? line.code).toLocaleLowerCase("vi").includes(needle));
  }, [keyword, lines]);
  const pickedCount = lines.filter((line) => picked.includes(line.id)).length;

  return (
    <section>
      <h4 className="pd-newpay-head pd-newpay-head--split">
        <span>
          <FileTextOutlined /> {t("Patient:Payment:ServiceHeader")}
          {slipCode ? <span className="pd-newpay-slipchip">{slipCode}</span> : null}
          <Button
            type="text"
            className="pd-newpay-search"
            icon={<SearchOutlined />}
            aria-label={t("Patient:Payment:SearchService")}
            aria-expanded={searching}
            disabled={!slipCode}
            onClick={() => setSearching((on) => !on)}
          />
        </span>
        {slipCode ? (
          <Checkbox
            checked={lines.length > 0 && pickedCount === lines.length}
            indeterminate={pickedCount > 0 && pickedCount < lines.length}
            disabled={lines.length === 0}
            onChange={(event) => onToggleAll(event.target.checked)}
          >
            {t("Patient:Payment:SelectAll")}
          </Checkbox>
        ) : null}
      </h4>

      {searching && slipCode ? (
        <Input
          autoFocus
          allowClear
          value={keyword}
          prefix={<SearchOutlined />}
          className="pd-newpay-searchbox"
          placeholder={t("Patient:Payment:SearchService")}
          onChange={(event) => setKeyword(event.target.value)}
        />
      ) : null}

      {!slipCode ? (
        <div className="pd-newpay-noslip">
          <FileSearchOutlined />
          <b>{t("Patient:Payment:NoSlipTitle")}</b>
          <span>{t("Patient:Payment:NoSlipHint")}</span>
        </div>
      ) : lines.length === 0 ? (
        <p className="pd-newpay-empty">{t("Patient:Payment:NoServices")}</p>
      ) : (
        <ul className="pd-newpay-lines">
          {visible.map((line) => (
            <ServiceCard key={line.id} line={line} checked={picked.includes(line.id)} onToggle={onToggle} />
          ))}
        </ul>
      )}
      {slipCode && pickedCount === 0 ? (
        <p className="pd-newpay-error">{t("Patient:Payment:SelectMinOne")}</p>
      ) : null}
    </section>
  );
}
