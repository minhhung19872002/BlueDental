import { useMemo } from "react";
import {
  laboMaterialGroupCode,
  laboMaterialGroupRank,
  type LaboMaterialGroupCode,
} from "@/hooks/useLaboPickers";
import { LABO_GROUP } from "../laboTabs";
import { useLaboCatalogOptions, type LaboCatalogItem } from "./laboCatalogListApi";

/** One of the three fixed groups of Vật liệu & loại phục hình, with its code. */
export interface LaboMaterialGroupItem extends LaboCatalogItem {
  code: LaboMaterialGroupCode;
}

/**
 * The fixed groups only, in their order (BA P1011). A group made before P1011
 * stays in the database for the old orders that name its materials, but the
 * catalog no longer lists it.
 */
export function adaptMaterialGroups(rows: LaboCatalogItem[]): LaboMaterialGroupItem[] {
  return rows
    .flatMap((row) => {
      const code = laboMaterialGroupCode(row);
      return code ? [{ ...row, code }] : [];
    })
    .sort((a, b) => laboMaterialGroupRank(a.code) - laboMaterialGroupRank(b.code));
}

/** The groups panel of Vật liệu & loại phục hình, searched on the server. */
export function useLaboMaterialGroups(filter?: string) {
  const query = useLaboCatalogOptions(LABO_GROUP.Material, filter);
  const groups = useMemo(() => adaptMaterialGroups(query.data ?? []), [query.data]);
  return { groups, isLoading: query.isLoading, isFetching: query.isFetching };
}
