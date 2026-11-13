import { useState } from "react";
import { Select } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";
import { useFullAddress } from "@/hooks/useFullAddress";
import { foldFilterOption } from "@/utils/foldForSearch";
import { useLaboSupplierPicks, type LaboSupplierDto } from "@/features/labo/api/laboCatalogApi";
import { LaboSupplierDialog } from "../LaboSupplierDialog";

interface Props {
  branchId: string;
  value: string | undefined;
  editable: boolean;
  onChange: (supplierId: string) => void;
}

/**
 * Nhà cung cấp (Labo) * of the Phiếu yêu cầu (P1311): the branch's suppliers,
 * a + that makes one and picks it, and the picked one's address,
 * read only. Two cells of the Thông tin phiếu grid; Ngày gửi and Ngày nhận dự
 * kiến fill the rest of the row (R-1228).
 */
export function SupplierField({ branchId, value, editable, onChange }: Props) {
  const [creating, setCreating] = useState(false);
  // The one just made, shown until the list refetches with it.
  const [fresh, setFresh] = useState<LaboSupplierDto>();
  const canCreate = useAbility("laboSupplier").canCreate;
  const loaded = useLaboSupplierPicks(branchId).data ?? [];
  const suppliers = fresh && !loaded.some((one) => one.id === fresh.id) ? [...loaded, fresh] : loaded;
  const supplier = suppliers.find((one) => one.id === value);
  const address = useFullAddress({
    street: supplier?.address,
    provinceCode: supplier?.provinceCode,
    wardCode: supplier?.wardCode,
  });
  const options = suppliers
    .filter((one) => one.isActive || one.id === value)
    .map((one) => ({ value: one.id, label: one.name }));
  const missing = editable && !value;

  return (
    <>
      <div className="rs-span2">
        <span className="rs-lbl">
          {t("Labo:Slip:Supplier")} <span className="rs-req">*</span>
        </span>
        <div className="rs-supplier">
          <Select
            className={missing ? "rs-inp rs-err" : "rs-inp"}
            value={value}
            options={options}
            showSearch={{ filterOption: foldFilterOption }}
            disabled={!editable}
            placeholder={t("Labo:Slip:SupplierPlaceholder")}
            aria-label={t("Labo:Slip:Supplier")}
            onChange={onChange}
          />
          {editable && canCreate && (
            <button
              type="button"
              className="rs-addsup"
              title={t("Labo:Slip:AddSupplier")}
              aria-label={t("Labo:Slip:AddSupplier")}
              onClick={() => setCreating(true)}
            >
              <PlusOutlined aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      <div className="rs-span2">
        <span className="rs-lbl">{t("Labo:Slip:SupplierAddress")}</span>
        <div className="rs-ro" role="textbox" aria-readonly="true" aria-label={t("Labo:Slip:SupplierAddress")} title={address}>
          {supplier ? address : <span className="rs-ph">{t("Labo:Slip:ChooseSupplierFirst")}</span>}
        </div>
      </div>
      {creating && (
        <LaboSupplierDialog
          open
          supplier={null}
          onClose={() => setCreating(false)}
          onSaved={(saved) => {
            setFresh(saved);
            onChange(saved.id);
          }}
        />
      )}
    </>
  );
}
