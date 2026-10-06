import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import type { PagedResult } from "@/types";
import { CATALOG_GROUP, catalogOptionKeys } from "./useCatalogOptions";

/** One component of a combo, as "Chọn Dịch Vụ" shows it. */
export interface CatalogComboPart {
  serviceId: string;
  name: string;
  quantity: number;
  /** The service's own price — what it would cost bought alone. */
  retailPrice: number;
}

/** A combo of the dịch vụ catalog, shaped for the "Combo" tab of "Chọn Dịch Vụ". */
export interface CatalogComboOption {
  id: string;
  name: string;
  description: string | null;
  /** Giá combo. */
  price: number;
  /** What an advise line sells it at — "Giá sau giảm", as for a single service. */
  salePrice: number;
  /** Tổng giá lẻ. */
  retailPrice: number;
  /** Tổng giá lẻ − Giá combo, never below zero. */
  savings: number;
  /** The same saving as a whole percentage of Tổng giá lẻ. */
  savingsPercent: number;
  parts: CatalogComboPart[];
}

interface ComboEntryResponse {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  retailPrice: number | null;
  serviceConfig?: { priceAfterDiscount: number } | null;
  comboItems: {
    componentEntryId: string;
    componentName: string | null;
    componentPrice: number | null;
    quantity: number;
  }[];
}

/** A branch holds a handful of combos; one request carries them all. */
const COMBO_LIMIT = 100;

function toComboOption(entry: ComboEntryResponse): CatalogComboOption {
  const price = entry.price ?? 0;
  const retailPrice = entry.retailPrice ?? 0;
  const savings = Math.max(retailPrice - price, 0);
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    price,
    salePrice: entry.serviceConfig?.priceAfterDiscount ?? price,
    retailPrice,
    savings,
    savingsPercent: retailPrice > 0 ? Math.round((savings / retailPrice) * 100) : 0,
    parts: entry.comboItems.map((item) => ({
      serviceId: item.componentEntryId,
      name: item.componentName ?? "",
      quantity: item.quantity,
      retailPrice: item.componentPrice ?? 0,
    })),
  };
}

/**
 * The live combos of the current branch, searched on the server — the
 * "Combo" tab of "Chọn Dịch Vụ" and its suggestion both read them (review
 * P0510). Deleted combos are left out, as deleted services are.
 */
export function useCatalogComboOptions(search: string, enabled = true) {
  const branchId = useCurrentBranchId();
  const term = search.trim();

  return useQuery({
    queryKey: [...catalogOptionKeys.group(branchId, CATALOG_GROUP.CareService), "combos", term] as const,
    queryFn: async () => {
      const page = await api
        .get<PagedResult<ComboEntryResponse>>("/v1/app/catalog-entries", {
          params: {
            clinicBranchId: branchId,
            group: CATALOG_GROUP.CareService,
            isCombo: true,
            isDeleted: false,
            filter: term || undefined,
            maxResultCount: COMBO_LIMIT,
          },
        })
        .then((r) => r.data);
      return { items: page.items.map(toComboOption), totalCount: page.totalCount };
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(branchId) && enabled,
  });
}
