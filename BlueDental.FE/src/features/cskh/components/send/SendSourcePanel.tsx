import { LockOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useSendLists } from "../../api/sendApi";
import type { SendParams } from "../../hooks/useSendParams";
import { CareDateBar } from "../CareDateBar";
import { SendCustomerPicker } from "./SendCustomerPicker";
import { SendListChips } from "./SendListChips";

interface SendSourcePanelProps {
  params: SendParams;
  onAddCustomer: (patientId: string) => void;
}

/**
 * Where the customers come from: a CSKH tab over the period (the date bar
 * decides the list, as on /cskh-grouping), or customers found one by one. A
 * row's SMS / Zalo button locks Khách lẻ to that customer.
 */
export function SendSourcePanel({ params, onAddCustomer }: SendSourcePanelProps) {
  const isList = params.source === "list";
  const lists = useSendLists(params.period, isList);

  if (isList) {
    return (
      <div className="snd-source">
        <CareDateBar mode={params.mode} date={params.date} onModeChange={params.setMode} onDateChange={params.setDate} />
        <SendListChips active={params.careTab.key} counts={lists.data} onChange={params.setCareTab} />
      </div>
    );
  }
  if (params.lockedPatientId) {
    return (
      <div className="snd-source">
        <p className="tpe-note">
          <LockOutlined />
          {t("CSKH:Send:Locked")}
        </p>
      </div>
    );
  }
  return (
    <div className="snd-source">
      <SendCustomerPicker onAdd={onAddCustomer} />
    </div>
  );
}
