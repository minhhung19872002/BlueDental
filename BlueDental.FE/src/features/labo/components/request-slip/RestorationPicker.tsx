import { useMemo } from "react";
import { Form } from "antd";
import { t } from "@/lib/i18n";
import type { LaboMaterialOption, LaboServiceOption } from "@/hooks/useLaboPickers";
import { LaboChoiceRow } from "../order-dialogs/LaboChoiceRow";
import { useRecentLaboServices } from "../order-dialogs/useRecentLaboServices";
import { restorationMaterials, restorationServices, serviceOfMaterial } from "./restorationChoices";
import { SectionBadge } from "./SectionBadge";

export interface RestorationChoice {
  serviceId: string | undefined;
  materialId: string | undefined;
}

interface Props extends RestorationChoice {
  services: LaboServiceOption[];
  materials: LaboMaterialOption[];
  editable: boolean;
  onChange: (choice: RestorationChoice) => void;
  /** The heading a Mẫu phiếu gives this part (F-94); none keeps its own name. */
  title?: string;
}

/**
 * Loại phục hình of the Phiếu yêu cầu (R-1216, BA feedback on P1011): back to
 * the classic Đặt hàng rows — one Dịch vụ, then one of its Vật liệu, three
 * chips each and «Xem thêm» for the rest. A new Dịch vụ lets go of a material
 * it does not offer. Each row sits in a nameless Form.Item of a Form of its
 * own: LaboChoiceRow reads its status there, and it is never the slip's.
 */
export function RestorationPicker({ services, materials, serviceId, materialId, editable, onChange, title }: Props) {
  const { recent, remember } = useRecentLaboServices();
  const service = serviceId ?? serviceOfMaterial(materials, materialId);
  const serviceItems = useMemo(
    () => restorationServices(services, materials, materialId),
    [services, materials, materialId],
  );
  const materialItems = restorationMaterials(materials, service, materialId);
  const recentServices = recent.flatMap((id) => serviceItems.filter((item) => item.value === id));
  const picked = materials.find((material) => material.value === materialId)?.label;

  const handleService = (next: string) => {
    remember(next);
    const keeps = materials.some((material) => material.value === materialId && material.serviceId === next);
    onChange({ serviceId: next, materialId: keeps ? materialId : undefined });
  };

  return (
    <section className="rs-sec rs-restoration">
      <div className="rs-sech">
        <span>
          {title ?? t("Labo:Slip:Restoration")} <span className="rs-req">*</span>
        </span>
        <SectionBadge tone={picked ? "ok" : "miss"}>{picked ?? t("Labo:Slip:NotPicked")}</SectionBadge>
      </div>
      <div className="rs-secb rs-restoration-rows">
        <Form component={false}>
          <Form.Item>
            <LaboChoiceRow
              text={{ label: t("Labo:Choice:Service"), empty: t("Common:NoData") }}
              items={serviceItems}
              value={service}
              disabled={!editable}
              more={{
                label: t("Labo:Choice:MoreServices"),
                recent: recentServices,
                texts: {
                  title: t("Labo:Choice:ServiceTitle"),
                  count: t("Labo:Choice:ServiceCount", serviceItems.length),
                  search: t("Labo:Choice:ServiceSearch"),
                  confirm: t("Labo:Choice:ServiceConfirm"),
                },
              }}
              onChange={handleService}
            />
          </Form.Item>
          <Form.Item>
            <LaboChoiceRow
              text={{
                label: t("Patient:Labo:Material"),
                empty: service ? t("Patient:Labo:NoMaterial") : t("Patient:Stage:SelectServiceFirst"),
              }}
              items={materialItems}
              value={materialId}
              disabled={!editable}
              more={{
                label: t("Labo:Choice:MoreMaterials"),
                texts: {
                  title: t("Labo:Choice:MaterialTitle"),
                  count: t("Labo:Choice:MaterialCount", materialItems.length),
                  search: t("Labo:Choice:MaterialSearch"),
                  confirm: t("Labo:Choice:MaterialConfirm"),
                },
              }}
              onChange={(next) => onChange({ serviceId: service, materialId: next })}
            />
          </Form.Item>
        </Form>
      </div>
    </section>
  );
}
