import { t } from "@/lib/i18n";
import type { CatalogComboHolderDto } from "../api/taxonomyApi";

interface Props {
  holders: CatalogComboHolderDto[] | undefined;
}

const namesOf = (holders: CatalogComboHolderDto[]) => holders.map((holder) => holder.name).join(", ");

/**
 * "Dịch vụ đang được sử dụng trong combo: …" — deleting a service takes it out
 * of the combos that hold it, so the confirmation names them first. A combo
 * the service is the only part of cannot lose it; the server refuses that
 * delete, and the notice says so up front.
 *
 * A span, not a block element: the confirmation draws its note inside a <p>.
 */
export function ComboHoldersNotice({ holders }: Props) {
  if (!holders?.length) return null;

  const blocking = holders.filter((holder) => holder.isLastComponent);
  if (blocking.length > 0) {
    return (
      <span role="alert" className="bd-combo-holders bd-combo-holders--blocked">
        {t("Taxonomy:Catalog:LastInCombos", namesOf(blocking))}
      </span>
    );
  }

  return (
    <span role="alert" className="bd-combo-holders">
      {t("Taxonomy:Catalog:InCombos", namesOf(holders))}
    </span>
  );
}
