import { useMemo } from "react";
import {
  isAddedLaboService,
  laboMaterialGroupCode,
  laboMaterialGroupRank,
  type LaboMaterialGroupCode,
} from "@/hooks/useLaboPickers";
import { LABO_GROUP } from "../laboTabs";
import { useLaboCatalogOptions, type LaboCatalogItem } from "./laboCatalogListApi";

/** A Dịch vụ of Dịch vụ Labo: one of the three fixed ones, with its code, or one the branch added. */
export interface LaboMaterialGroupItem extends LaboCatalogItem {
  /** Set on the three fixed groups (BA P1011); undefined on an added Dịch vụ (P1311). */
  code?: LaboMaterialGroupCode;
}

const rankOf = (group: LaboMaterialGroupItem): number =>
  group.code ? laboMaterialGroupRank(group.code) : Number.MAX_SAFE_INTEGER;

/**
 * The fixed groups first, in their order (BA P1011), then the Dịch vụ the
 * branch added (P1311) in the server's order — priority, then newest. A group
 * made before P1011 stays in the database for the old orders that name its
 * materials, but the catalog no longer lists it.
 */
export function adaptMaterialGroups(rows: LaboCatalogItem[]): LaboMaterialGroupItem[] {
  return rows
    .flatMap((row): LaboMaterialGroupItem[] => {
      const code = laboMaterialGroupCode(row);
      if (code) return [{ ...row, code }];
      return isAddedLaboService(row) ? [{ ...row, code: undefined }] : [];
    })
    .sort((a, b) => rankOf(a) - rankOf(b));
}

/** The groups panel of Dịch vụ Labo, searched on the server. */
export function useLaboMaterialGroups(filter?: string) {
  const query = useLaboCatalogOptions(LABO_GROUP.Material, filter);
  const groups = useMemo(() => adaptMaterialGroups(query.data ?? []), [query.data]);
  return { groups, isLoading: query.isLoading, isFetching: query.isFetching };
}
