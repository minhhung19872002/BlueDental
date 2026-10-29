import { useMemo, useState } from "react";
import { Button, Checkbox, Input } from "antd";
import { FileSearchOutlined, FileTextOutlined, SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { matchesSearch } from "@/utils/foldForSearch";
import { ServiceCard } from "./ServiceCard";
import type { PaymentForm } from "./usePaymentForm";

/** "Dịch vụ": the chosen slip's services that still owe money. */
export function PaymentServiceList({ payment }: { payment: PaymentForm }) {
  const { lines, form } = payment;
  const slipCode = payment.slip?.code ?? null;
  const [searching, setSearching] = useState(false);
  const [keyword, setKeyword] = useState("");
  const visible = useMemo(() => {
    return lines.filter((line) => matchesSearch(line.serviceName ?? line.code, keyword));
  }, [keyword, lines]);
  const pickedCount = lines.filter((line) => form.picked.includes(line.id)).length;

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
            onChange={(event) => payment.toggleAll(event.target.checked)}
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
            <ServiceCard key={line.id} payment={payment} line={line} />
          ))}
        </ul>
      )}
      {slipCode && pickedCount === 0 ? (
        <p className="pd-newpay-error">{t("Patient:Payment:SelectMinOne")}</p>
      ) : null}
    </section>
  );
}
