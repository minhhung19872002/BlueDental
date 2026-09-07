import { useEffect } from "react";
import { Form } from "antd";
import { Pill, Plus, Printer, Receipt } from "lucide-react";
import {
  CATALOG_GROUP,
  useCatalogOptions,
  useTaxonomyGroupOptions,
  type CatalogOption,
} from "@/hooks/useCatalogOptions";
import { t } from "@/lib/i18n";
import { PlanServicePicker } from "../plan/PlanServicePicker";

interface Props {
  /** The service on the inline new row, or null once it was saved or discarded. */
  draftServiceId: string | null;
  onPickService: (service: CatalogOption) => void;
  onAddStage: () => void;
  onPrescription: () => void;
  onInvoice: () => void;
  onPrint: () => void;
}

interface PickerValues {
  serviceId?: string;
}

/**
 * The strip above the service table: the service picker and "Thêm công đoạn"
 * on the left, the prescription, invoice and print buttons on the right. The
 * printer icon opens the slip's "Chi tiết phiếu".
 *
 * Picking a service hands it to the tab, which puts the inline new row on top
 * of the table. The field keeps showing that service until the row is saved
 * or discarded, as on the reference; only then does it read empty again.
 */
export function PlanServicesToolbar({
  draftServiceId,
  onPickService,
  onAddStage,
  onPrescription,
  onInvoice,
  onPrint,
}: Props) {
  const [form] = Form.useForm<PickerValues>();
  const services = useCatalogOptions(CATALOG_GROUP.CareService);
  const groups = useTaxonomyGroupOptions(CATALOG_GROUP.CareService);

  useEffect(() => {
    form.setFieldValue("serviceId", draftServiceId ?? undefined);
  }, [form, draftServiceId]);

  return (
    <div className="pdt-toolbar">
      <div className="pdt-toolbar-start">
        <Form form={form} className="pdt-picker">
          <PlanServicePicker
            services={services.data ?? []}
            groups={groups.data ?? []}
            loading={services.isLoading || groups.isLoading}
            onPickService={onPickService}
          />
        </Form>
        <button type="button" className="tp-btn tp-btn--primary" onClick={onAddStage}>
          <Plus size={16} aria-hidden="true" />
          {t("Thêm công đoạn")}
        </button>
      </div>
      <div className="pdt-toolbar-end">
        <button type="button" className="tp-btn tp-btn--outline" onClick={onPrescription}>
          <Pill size={16} aria-hidden="true" />
          {t("Tạo Đơn Thuốc")}
        </button>
        <button type="button" className="tp-btn tp-btn--outline" onClick={onInvoice}>
          <Receipt size={16} aria-hidden="true" />
          {t("In Hóa Đơn")}
        </button>
        <button type="button" className="pdt-print" aria-label={t("In phiếu điều trị")} onClick={onPrint}>
          <Printer size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
