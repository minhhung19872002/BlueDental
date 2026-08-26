import { useMemo } from "react";
import { Modal } from "antd";
import { t } from "@/lib/i18n";
import { formatVND } from "@/utils/format";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import {
  useCatalogEntries,
  useTaxonomyGroups,
  TAXONOMY_GROUP,
  type CatalogEntryQuery,
} from "@/features/taxonomy/api/taxonomyApi";
import type { VoucherDto } from "../api/voucherApi";

const ENTRIES_QUERY: CatalogEntryQuery = {
  scope: "catalog",
  skipCount: 0,
  maxResultCount: 500,
};

interface TargetRow {
  id: string;
  name: string;
  price: number | null;
}

interface Props {
  voucher: VoucherDto | null;
  onClose: () => void;
}

/**
 * The ref's "Xem chi tiết" modal: each applied service/group as a numbered
 * card row with its price on the right. The voucher only stores target ids,
 * so names resolve through the same taxonomy lists the picker browses.
 */
export function VoucherServicesModal({ voucher, onClose }: Props) {
  const branchId = useCurrentBranchId();
  const { data: groups } = useTaxonomyGroups(branchId, TAXONOMY_GROUP.CareService);
  const { data: entries } = useCatalogEntries(
    branchId,
    TAXONOMY_GROUP.CareService,
    ENTRIES_QUERY,
  );

  const rows = useMemo<TargetRow[]>(() => {
    const byId = new Map<string, TargetRow>();
    for (const g of groups?.items ?? []) {
      byId.set(g.id, { id: g.id, name: g.name, price: null });
    }
    for (const e of entries?.items ?? []) {
      byId.set(e.id, { id: e.id, name: e.name, price: e.price });
    }
    return (voucher?.targetIds ?? [])
      .map((id) => byId.get(id))
      .filter((row): row is TargetRow => row !== undefined);
  }, [voucher, groups, entries]);

  return (
    <Modal
      open={voucher !== null}
      title={<h2 className="bd-modal-title">{t("Dịch vụ áp dụng")}</h2>}
      onCancel={onClose}
      footer={null}
      width={520}
      className="app-dialog voucher-services-modal"
    >
      <div className="voucher-services-list">
        {rows.map((row, i) => (
          <div key={row.id} className="voucher-services-row">
            <span className="voucher-services-index">#{i + 1}</span>
            <span className="voucher-services-name">{row.name}</span>
            {row.price !== null && (
              <span className="voucher-services-price">{formatVND(row.price)} đ</span>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}
