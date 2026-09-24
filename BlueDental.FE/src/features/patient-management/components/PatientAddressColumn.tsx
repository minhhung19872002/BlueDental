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
        label={t("Patient:Form:InsuranceCardNo")}
        name="insuranceNumber"
        rules={[{ max: 30, message: t("Patient:Misc:Max30Chars") }]}
      >
        <Input maxLength={30} />
      </FloatingField>

      <FloatingField label={t("Patient:Form:Country")} name="country">
        <Input readOnly value={t("Patient:Form:Vietnam")} />
      </FloatingField>

      <FloatingField label={t("Patient:Form:Street")} name="address">
        <Input maxLength={500} />
      </FloatingField>

      <FloatingField label={t("Patient:Form:Province")} name="provinceCode">
        <SearchSelect
          options={provinces.map((row) => ({ value: row.code, label: row.name }))}
          placeholder={t("Patient:Form:Province")}
          emptyText={t("Patient:Form:ProvinceNotFound")}
          allowClear
          onChange={onProvinceChange}
        />
      </FloatingField>

      <FloatingField label={t("Patient:Form:Ward")} name="wardCode">
        <SearchSelect
          options={wards.map((row) => ({ value: row.code, label: row.name }))}
          placeholder={t("Patient:Form:Ward")}
          emptyText={t("Patient:Form:WardNotFound")}
          disabled={!provinceCode}
          allowClear
        />
      </FloatingField>

      {/* The card's address in the old province / district / ward shape.
          Kept apart: the two shapes do not map one to one. */}
      <FloatingField label={t("Patient:Form:OldAddress")} name="oldAddress">
        <Input.TextArea rows={2} maxLength={500} />
      </FloatingField>
    </>
  );
}
