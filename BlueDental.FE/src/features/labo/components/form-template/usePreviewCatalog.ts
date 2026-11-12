import { useMemo } from "react";
import {
  useLaboFinishLineOptions,
  useLaboMaterialOptions,
  useLaboServiceOptions,
  type LaboFinishLineOption,
} from "@/hooks/useLaboPickers";
import { restorationGroups, type RestorationGroup } from "../request-slip/restorationGroups";

/** The branch's own lists the preview draws its blocks from (R-1202). */
export interface PreviewCatalog {
  groups: RestorationGroup[];
  finishLines: LaboFinishLineOption[];
}

/**
 * Loại phục hình and Đường hoàn tất as a new slip of the branch would list
 * them — the same catalog calls the Phiếu yêu cầu makes — whole, so each
 * card shows ten rows and scrolls as on the slip.
 */
export function usePreviewCatalog(branchId: string, enabled: boolean): PreviewCatalog {
  const services = useLaboServiceOptions(branchId, enabled).data;
  const materials = useLaboMaterialOptions(branchId, enabled).data;
  const finishLines = useLaboFinishLineOptions(branchId, enabled).data;

  return useMemo(
    () => ({
      groups: restorationGroups(services ?? [], materials ?? [], []),
      finishLines: finishLines ?? [],
    }),
    [services, materials, finishLines],
  );
}
