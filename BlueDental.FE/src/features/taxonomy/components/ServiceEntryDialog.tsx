import { useState } from "react";
import type { CatalogEntryDto, TaxonomyDto } from "../api/taxonomyApi";
import { ComboDialog } from "./ComboDialog";
import { ServiceDialog } from "./ServiceDialog";
import { ServiceKindSwitch, type ServiceKind } from "./ServiceKindSwitch";

interface Props {
  open: boolean;
  entry: CatalogEntryDto | null;
  /** "Sao chép" on a combo row: a new combo prefilled from it. */
  copyOf?: CatalogEntryDto | null;
  groups: TaxonomyDto[];
  defaultTaxonomyId?: string;
  onClose: () => void;
}

/**
 * The Dịch vụ tab's add/edit dialog. A new entry starts as a single service
 * with "Loại: Dịch vụ lẻ | Combo" on top; switching swaps the form beneath.
 * A saved entry opens in the form of its own kind, the switch only showing it.
 */
export function ServiceEntryDialog({ open, entry, copyOf, groups, defaultTaxonomyId, onClose }: Props) {
  // A saved entry (or a copy of a combo) has its kind already; the switch
  // only chooses for a brand-new one.
  const savedKind: ServiceKind | null = entry ? (entry.isCombo ? "combo" : "single") : copyOf ? "combo" : null;
  const [chosen, setChosen] = useState<ServiceKind>("single");
  const [wasOpen, setWasOpen] = useState(open);

  // Every new entry starts as a single service. Reset while rendering, not in
  // an effect, so the first frame of an open never shows the other form.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setChosen("single");
  }

  const kind = savedKind ?? chosen;
  const kindSwitch = <ServiceKindSwitch value={kind} onChange={setChosen} disabled={savedKind !== null} />;
  const shared = { entry, groups, defaultTaxonomyId, kindSwitch, onClose };

  return (
    <>
      <ServiceDialog open={open && kind === "single"} {...shared} />
      <ComboDialog open={open && kind === "combo"} copyOf={copyOf} {...shared} />
    </>
  );
}
