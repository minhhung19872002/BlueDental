import { useCallback, useEffect, useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import { toast } from "sonner";
import {
  useCreateBranch,
  useUpdateBranch,
  type ClinicBranchDto,
} from "../api";
import { getAllProvinces, getWardsByProvince, type LocationOption } from "@/utils/vietnamLocations";
import { t } from "@/lib/i18n";

interface BranchFormValues {
  code: string;
  name: string;
  taxCode?: string;
  email?: string;
  phoneNumber?: string;
  contactPerson?: string;
  provinceId?: string;
  wardId?: string;
  address?: string;
}

interface BranchEditorModalProps {
  open: boolean;
  branch: ClinicBranchDto | null;
  onClose: () => void;
}

export function BranchEditorModal({ open, branch, onClose }: BranchEditorModalProps) {
  const [form] = Form.useForm<BranchFormValues>();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();
  const isEditing = Boolean(branch);
  const saving = createBranch.isPending || updateBranch.isPending;

  const selectedProvinceId = Form.useWatch("provinceId", form);
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);

  useEffect(() => {
    getAllProvinces().then(setProvinces);
  }, []);

  const loadWards = useCallback((provinceCode: string) => {
    if (!provinceCode) { setWards([]); return; }
    getWardsByProvince(provinceCode).then(setWards);
  }, []);

  useEffect(() => {
    if (selectedProvinceId) {
      loadWards(selectedProvinceId);
    } else {
      setWards([]);
    }
  }, [selectedProvinceId, loadWards]);

  useEffect(() => {
    if (open) {
      if (branch) {
        form.setFieldsValue({
          code: branch.code,
          name: branch.name,
          taxCode: branch.taxCode ?? "",
          email: branch.email ?? "",
          phoneNumber: branch.phoneNumber ?? "",
          contactPerson: branch.contactPerson ?? "",
          provinceId: branch.provinceId ?? undefined,
          wardId: branch.wardId ?? undefined,
          address: branch.address ?? "",
        });
        if (branch.provinceId) loadWards(branch.provinceId);
      } else {
        form.resetFields();
        setWards([]);
      }
    }
  }, [open, branch, form, loadWards]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const clean = (v: string | undefined) => v?.trim() || undefined;
    const payload = {
      ...values,
      address: clean(values.address),
      phoneNumber: clean(values.phoneNumber),
      email: clean(values.email),
      taxCode: clean(values.taxCode),
      contactPerson: clean(values.contactPerson),
      provinceId: values.provinceId || undefined,
      wardId: values.wardId || undefined,
    };
    try {
      if (branch) {
        await updateBranch.mutateAsync({
          id: branch.id,
          data: {
            name: payload.name,
            provinceId: payload.provinceId,
            wardId: payload.wardId,
            address: payload.address,
            phoneNumber: payload.phoneNumber,
            email: payload.email,
            taxCode: payload.taxCode,
            contactPerson: payload.contactPerson,
          },
        });
        toast.success(t("Cập nhật chi nhánh thành công"));
      } else {
        await createBranch.mutateAsync(payload);
        toast.success(t("Tạo chi nhánh thành công"));
      }
      onClose();
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  return (
    <Modal
      open={open}
      title={isEditing ? t("Cập nhật chi nhánh") : t("Thêm chi nhánh")}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      okText={t("Lưu")}
      cancelText={t("Hủy")}
      destroyOnClose
      width={720}
    >
      <Form form={form} layout="vertical" className="branch-editor-form">
        <div className="settings-row">
          <Form.Item
            name="code"
            label={t("Mã chi nhánh")}
            rules={isEditing ? [] : [{ required: true, message: t("Vui lòng nhập mã chi nhánh") }]}
          >
            <Input disabled={isEditing} placeholder={t("Mã chi nhánh")} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t("Tên chi nhánh")}
            rules={[{ required: true, message: t("Vui lòng nhập tên") }]}
          >
            <Input />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item name="taxCode" label={t("Mã số thuế")}>
            <Input placeholder={t("Mã số thuế")} />
          </Form.Item>
          <Form.Item name="contactPerson" label={t("Người liên hệ")}>
            <Input placeholder={t("Người liên hệ")} />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item
            name="email"
            label="Email"
            rules={[{ type: "email", message: t("Email không hợp lệ") }]}
          >
            <Input placeholder="Email" />
          </Form.Item>
          <Form.Item
            name="phoneNumber"
            label={t("Số điện thoại")}
            rules={[{ pattern: /^0\d{9,10}$/, message: t("Số điện thoại không hợp lệ") }]}
          >
            <Input placeholder={t("Số điện thoại")} />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item name="provinceId" label={t("Tỉnh/ Thành phố")}>
            <Select
              showSearch
              allowClear
              placeholder={t("Chọn tỉnh/ thành phố")}
              options={provinces.map((p) => ({ label: p.name, value: p.code }))}
              filterOption={(input, option) =>
                (option?.label as string).toLowerCase().includes(input.toLowerCase())
              }
              onChange={() => form.setFieldValue("wardId", undefined)}
            />
          </Form.Item>
          <Form.Item name="wardId" label={t("Xã/ Phường")}>
            <Select
              showSearch
              allowClear
              placeholder={t("Chọn xã/ phường")}
              options={wards.map((w) => ({ label: w.name, value: w.code }))}
              filterOption={(input, option) =>
                (option?.label as string).toLowerCase().includes(input.toLowerCase())
              }
              disabled={!selectedProvinceId}
            />
          </Form.Item>
        </div>
        <Form.Item name="address" label={t("Địa chỉ chi nhánh")}>
          <Input placeholder={t("Địa chỉ chi nhánh")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
