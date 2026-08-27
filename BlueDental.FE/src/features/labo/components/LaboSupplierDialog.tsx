import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Col, Form, Input, Row, Select } from "antd";
import { toast } from "sonner";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
  laboSupplierLogoApi,
  useLaboSupplierCommands,
  type LaboSupplierDto,
  type LaboSupplierInput,
} from "../api/laboCatalogApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { t } from "@/lib/i18n";
import { getAllProvinces, getWardsByProvince, type LocationOption } from "@/utils/vietnamLocations";

interface Props {
  open: boolean;
  supplier: LaboSupplierDto | null;
  onClose: () => void;
}

interface FormValues {
  name: string;
  email: string;
  phone: string;
  contactPerson: string;
  taxCode: string;
  provinceCode?: string;
  wardCode?: string;
  address: string;
}

const EMPTY: FormValues = {
  name: "",
  email: "",
  phone: "",
  contactPerson: "",
  taxCode: "",
  provinceCode: undefined,
  wardCode: undefined,
  address: "",
};

/**
 * Tạo / Sửa nhà cung cấp.
 *
 * Laid out as the reference lays it out: a round logo over its own commands,
 * then name / email / phone, then contact and tax code, then the address, with
 * the street line on its own row underneath.
 *
 * The save stays disabled until both name and email are filled — the reference
 * greys its own out on exactly those two.
 */
export function LaboSupplierDialog({ open, supplier, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const name = Form.useWatch("name", form) ?? "";
  const email = Form.useWatch("email", form) ?? "";
  const provinceCode = Form.useWatch("provinceCode", form);

  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const { create, update } = useLaboSupplierCommands();

  /**
   * The logo, held until the record is saved.
   *
   * `undefined` means untouched, a File means upload it, `null` means remove
   * the one that is there — the same three states the staff dialog keeps.
   */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null | undefined>(undefined);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void getAllProvinces().then(setProvinces);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLogoFile(undefined);
    setLogoPreview(supplier?.logoPath ?? null);
  }, [open, supplier]);

  // A preview made from a File holds an object URL until it is let go of.
  useEffect(
    () => () => {
      if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    },
    [logoPreview],
  );

  useEffect(() => {
    if (!open) return;

    form.setFieldsValue(
      supplier
        ? {
            name: supplier.name,
            email: supplier.email ?? "",
            phone: supplier.phone ?? "",
            contactPerson: supplier.contactPerson ?? "",
            taxCode: supplier.taxCode ?? "",
            provinceCode: supplier.provinceCode ?? undefined,
            wardCode: supplier.wardCode ?? undefined,
            address: supplier.address ?? "",
          }
        : EMPTY,
    );
  }, [open, supplier, form]);

  // The wards of whichever province is selected, including the one a saved
  // supplier arrives with.
  useEffect(() => {
    if (!provinceCode) {
      setWards([]);
      return;
    }
    void getWardsByProvince(provinceCode).then(setWards);
  }, [provinceCode]);

  const handleProvinceChange = useCallback(() => {
    // A ward outside its province is not an address.
    form.setFieldValue("wardCode", undefined);
  }, [form]);

  const pending = create.isPending || update.isPending;

  const submit = async (values: FormValues) => {
    const input: LaboSupplierInput = {
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim() || undefined,
      contactPerson: values.contactPerson.trim() || undefined,
      taxCode: values.taxCode.trim() || undefined,
      provinceCode: values.provinceCode || undefined,
      wardCode: values.wardCode || undefined,
      address: values.address.trim() || undefined,
    };

    try {
      // The record first — a new supplier has no id to hang a logo off yet.
      const saved = supplier
        ? await update.mutateAsync({ id: supplier.id, input })
        : await create.mutateAsync(input);

      if (logoFile instanceof File) {
        await laboSupplierLogoApi.upload(saved.id, logoFile);
      } else if (logoFile === null && supplier?.logoPath) {
        await laboSupplierLogoApi.remove(saved.id);
      }

      toast.success(supplier ? t("Đã cập nhật") : t("Đã thêm"));
      onClose();
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  const pickLogo = (file: File | undefined) => {
    if (!file) return;
    setLogoFile(file);
    setLogoPreview((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  };

  const clearLogo = () => {
    setLogoFile(null);
    setLogoPreview((previous) => {
      if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
      return null;
    });
  };

  return (
    <AppDialog
      open={open}
      width={780}
      title={supplier ? t("Sửa nhà cung cấp") : t("Tạo nhà cung cấp")}
      canSave={name.trim().length > 0 && email.trim().length > 0}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      {/* The logo well, wearing what the staff dialog wears: a round preview
          that is itself the picker, with its two commands under it. */}
      <div className="bd-labo-avatar">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="bd-hidden"
          onChange={(event) => {
            pickLogo(event.target.files?.[0]);
            event.target.value = "";
          }}
        />

        <button
          type="button"
          className="bd-labo-avatar-btn"
          aria-label={t("Ảnh nhà cung cấp")}
          onClick={() => fileInputRef.current?.click()}
        >
          {logoPreview ? (
            <img src={logoPreview} alt="" />
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
        </button>

        <div className="bd-labo-avatar-actions">
          <Button
            size="small"
            icon={<PlusOutlined />}
            onClick={() => fileInputRef.current?.click()}
          >
            {t("Tải ảnh lên")}
          </Button>
          {logoPreview && (
            <Button size="small" danger icon={<DeleteOutlined />} onClick={clearLogo}>
              {t("Xóa ảnh")}
            </Button>
          )}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={EMPTY}
        onFinish={(values) => void submit(values)}
      >
        <Row gutter={[16, 12]}>
          <Col xs={24} md={8}>
            <FloatingField
              name="name"
              label={t("Tên nhà cung cấp")}
              required
              rules={[
                { required: true, message: t("Vui lòng nhập tên nhà cung cấp") },
                { min: 2, message: t("Tên phải có ít nhất 2 ký tự") },
              ]}
            >
              <Input autoFocus maxLength={200} />
            </FloatingField>
          </Col>
          <Col xs={24} md={8}>
            <FloatingField
              name="email"
              label={t("Email")}
              required
              rules={[
                { required: true, message: t("Vui lòng nhập email") },
                { type: "email", message: t("Email không hợp lệ") },
              ]}
            >
              <Input maxLength={256} />
            </FloatingField>
          </Col>
          <Col xs={24} md={8}>
            <FloatingField name="phone" label={t("Số điện thoại")}>
              <Input maxLength={15} inputMode="numeric" />
            </FloatingField>
          </Col>
        </Row>

        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField name="contactPerson" label={t("Người liên hệ")}>
              <Input maxLength={200} />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="taxCode" label={t("Mã số thuế")}>
              <Input maxLength={100} />
            </FloatingField>
          </Col>
        </Row>

        <Row gutter={[16, 12]}>
          <Col xs={24} md={12}>
            <FloatingField name="provinceCode" label={t("Tỉnh/ Thành phố")}>
              <Select
                showSearch
                allowClear
                optionFilterProp="label"
                onChange={handleProvinceChange}
                options={provinces.map((p) => ({ value: p.code, label: p.name }))}
              />
            </FloatingField>
          </Col>
          <Col xs={24} md={12}>
            <FloatingField name="wardCode" label={t("Xã/ Phường")}>
              <Select
                showSearch
                allowClear
                disabled={!provinceCode}
                optionFilterProp="label"
                options={wards.map((w) => ({ value: w.code, label: w.name }))}
              />
            </FloatingField>
          </Col>
        </Row>

        <FloatingField name="address" label={t("Địa chỉ")}>
          <Input maxLength={500} />
        </FloatingField>
      </Form>
    </AppDialog>
  );
}
