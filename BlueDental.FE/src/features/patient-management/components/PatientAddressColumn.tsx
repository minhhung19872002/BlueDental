import { useEffect, useState } from "react";
import { Input } from "antd";
import { FloatingField } from "@/components/FloatingField";
import { SearchSelect } from "@/components/SearchSelect";
import { t } from "@/lib/i18n";
import { getAllProvinces, getWardsByProvince, type LocationOption } from "@/utils/vietnamLocations";

interface Props {
  provinceCode?: string;
  onProvinceChange: () => void;
}

/**
 * Column three: bảo hiểm and where the patient lives.
 *
 * The reference still asks for Tỉnh / Quận / Xã. Vietnam's 2025 reform removed
 * the district tier and BlueDental follows the two that remain — the same pair
 * the staff and labo-supplier dialogs already collect — so the address stays
 * one shape across the app rather than carrying a level nothing can fill.
 */
export function PatientAddressColumn({ provinceCode, onProvinceChange }: Props) {
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);

  useEffect(() => {
    void getAllProvinces().then(setProvinces);
  }, []);

  useEffect(() => {
    if (!provinceCode) {
      setWards([]);
      return;
    }
    void getWardsByProvince(provinceCode).then(setWards);
  }, [provinceCode]);

  return (
    <>
      <FloatingField
        label={t("Số thẻ BHYT")}
        name="insuranceNumber"
        rules={[{ max: 30, message: t("Tối đa 30 ký tự") }]}
      >
        <Input maxLength={30} />
      </FloatingField>

      <FloatingField label={t("Quốc gia")} name="country">
        <Input readOnly value={t("Việt Nam")} />
      </FloatingField>

      <FloatingField label={t("Số nhà/ Đường")} name="address">
        <Input maxLength={500} />
      </FloatingField>

      <FloatingField label={t("Tỉnh/ Thành phố")} name="provinceCode">
        <SearchSelect
          options={provinces.map((row) => ({ value: row.code, label: row.name }))}
          placeholder={t("Tỉnh/ Thành phố")}
          emptyText={t("Không tìm thấy tỉnh/ thành phố")}
          allowClear
          onChange={onProvinceChange}
        />
      </FloatingField>

      <FloatingField label={t("Xã/ Phường")} name="wardCode">
        <SearchSelect
          options={wards.map((row) => ({ value: row.code, label: row.name }))}
          placeholder={t("Xã/ Phường")}
          emptyText={t("Không tìm thấy xã/ phường")}
          disabled={!provinceCode}
          allowClear
        />
      </FloatingField>
    </>
  );
}
