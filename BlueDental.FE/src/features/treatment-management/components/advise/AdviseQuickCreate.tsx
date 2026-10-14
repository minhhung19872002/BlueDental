import { useState } from "react";
import { Button, Tooltip } from "antd";
import { Plus } from "lucide-react";
import {
  TAXONOMY_GROUP,
  useTaxonomyGroups,
  type CatalogEntryDto,
} from "@/features/taxonomy/api/taxonomyApi";
import { ComboDialog } from "@/features/taxonomy/components/ComboDialog";
import { ServiceDialog } from "@/features/taxonomy/components/ServiceDialog";
import { useAbility } from "@/hooks/useAbility";
import { toComboOption, type CatalogComboOption } from "@/hooks/useCatalogCombos";
import type { CatalogOption } from "@/hooks/useCatalogOptions";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import type { AdviseKind } from "./AdvisePickerHead";

interface Props {
  /** The tab open: Dịch vụ lẻ adds a service, Combo adds a combo. */
  kind: AdviseKind;
  /** The group picked on the strip — the new entry starts in it. */
  groupId: string | null;
  onServiceCreated: (service: CatalogOption) => void;
  onComboCreated: (combo: CatalogComboOption) => void;
}

/** A service just saved, in the shape the "Chọn Dịch Vụ" table ticks. */
function serviceOptionOf(entry: CatalogEntryDto): CatalogOption {
  return {
    id: entry.id,
    name: entry.name,
    code: entry.code,
    price: entry.price,
    salePrice: entry.serviceConfig?.priceAfterDiscount ?? entry.price,
    taxonomyId: entry.taxonomyId,
    taxonomyName: entry.taxonomyName,
    isImageRequired: entry.serviceConfig?.requireImage ?? false,
    content: entry.content,
    description: entry.description,
    prescriptionLines: [],
  };
}

/**
 * The round + beside "Tìm dịch vụ" (BA #34): adds a missing service — or, on
 * the Combo tab, a combo — on the spot instead of a trip to Danh mục. It opens
 * Danh mục's own dialog, the same form as there, and the saved entry comes
 * back ticked. Offered to whoever may add to the Dịch vụ catalog; the server
 * checks the same right on the call.
 */
export function AdviseQuickCreate({ kind, groupId, onServiceCreated, onComboCreated }: Props) {
  const { canCreate } = useAbility("catalogService");
  const branchId = useCurrentBranchId();
  const groups = useTaxonomyGroups(branchId, TAXONOMY_GROUP.CareService).data?.items;
  const [openKind, setOpenKind] = useState<AdviseKind | null>(null);

  if (!canCreate) return null;

  const label = kind === "combo" ? t("Treatment:Advise:QuickCreateCombo") : t("Treatment:Advise:QuickCreateService");
  const shared = {
    entry: null,
    groups: groups ?? [],
    defaultTaxonomyId: groupId ?? undefined,
    onClose: () => setOpenKind(null),
  };

  return (
    <>
      <Tooltip title={label}>
        <Button
          shape="circle"
          className="am-round"
          aria-label={label}
          icon={<Plus size={18} />}
          // The dialog starts on a group, so it waits for the list.
          disabled={!groups}
          onClick={() => setOpenKind(kind)}
        />
      </Tooltip>
      <ServiceDialog
        open={openKind === "single"}
        onCreated={(entry) => onServiceCreated(serviceOptionOf(entry))}
        {...shared}
      />
      <ComboDialog
        open={openKind === "combo"}
        onCreated={(entry) => onComboCreated(toComboOption(entry))}
        {...shared}
      />
    </>
  );
}
