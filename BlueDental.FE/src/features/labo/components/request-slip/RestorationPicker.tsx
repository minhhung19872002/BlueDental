import { useMemo } from "react";
import type { LaboMaterialOption, LaboServiceOption } from "@/hooks/useLaboPickers";
import { MaterialMultiPicker } from "./MaterialMultiPicker";
import { serviceOfMaterials, slipMaterials, slipServices } from "./restorationChoices";
import { ServiceRadioList } from "./ServiceRadioList";

export interface RestorationChoice {
  serviceId: string | undefined;
  materialIds: string[];
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
 * Dịch vụ & vật liệu of the Phiếu yêu cầu (P1311, replacing R-1216's one
 * Dịch vụ → one Vật liệu): one Dịch vụ by radio, then any of its Vật liệu.
 * Picking another Dịch vụ lets go of every material picked.
 */
export function RestorationPicker({ services, materials, serviceId, materialIds, editable, onChange, title }: Props) {
  const service = serviceId ?? serviceOfMaterials(materials, materialIds);
  const serviceItems = useMemo(
    () => slipServices(services, materials, materialIds),
    [services, materials, materialIds],
  );
  const options = slipMaterials(materials, service, materialIds);

  const handleService = (next: string) => {
    if (next !== service) onChange({ serviceId: next, materialIds: [] });
  };

  return (
    <div className="rs-restoration">
      <ServiceRadioList items={serviceItems} value={service} editable={editable} title={title} onChange={handleService} />
      <MaterialMultiPicker
        key={service ?? "none"}
        options={options}
        serviceId={service}
        value={materialIds}
        editable={editable}
        onChange={(next) => onChange({ serviceId: service, materialIds: next })}
      />
    </div>
  );
}
