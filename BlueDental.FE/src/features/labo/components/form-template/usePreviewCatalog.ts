import { useMemo } from "react";
import {
  useLaboFinishLineOptions,
  useLaboMaterialOptions,
  useLaboServiceOptions,
  type LaboFinishLineOption,
  type LaboMaterialOption,
  type LaboServiceOption,
} from "@/hooks/useLaboPickers";

/** The branch's own lists the preview draws its blocks from (R-1202). */
export interface PreviewCatalog {
  services: LaboServiceOption[];
  materials: LaboMaterialOption[];
  finishLines: LaboFinishLineOption[];
}

/**
 * Loại phục hình's Dịch vụ and Vật liệu (R-1216) and Đường hoàn tất as a new
 * slip of the branch would list them — the same catalog calls the Phiếu yêu
 * cầu makes.
 */
export function usePreviewCatalog(branchId: string, enabled: boolean): PreviewCatalog {
  const services = useLaboServiceOptions(branchId, enabled).data;
  const materials = useLaboMaterialOptions(branchId, enabled).data;
  const finishLines = useLaboFinishLineOptions(branchId, enabled).data;

  return useMemo(
    () => ({ services: services ?? [], materials: materials ?? [], finishLines: finishLines ?? [] }),
    [services, materials, finishLines],
  );
}
