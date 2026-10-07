import { useCallback, useEffect, useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import { toast } from "sonner";
import {
  useCreateBranch,
  useUpdateBranch,
  type ClinicBranchDto,
} from "../api";
import dayjs, { type Dayjs } from "dayjs";
import { BranchIpRangesField } from "./BranchIpRangesField";
import { BranchUsageHoursField, USAGE_TIME_FORMAT } from "./BranchUsageHoursField";
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
  allowedIpRanges?: string;
  usageStartTime?: Dayjs | null;
  usageEndTime?: Dayjs | null;
}

const toClockTime = (text: string | null | undefined) => (text ? dayjs(text, USAGE_TIME_FORMAT) : null);
const fromClockTime = (value: Dayjs | null | undefined) => value?.format(USAGE_TIME_FORMAT) ?? "";

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
          allowedIpRanges: branch.allowedIpRanges ?? "",
          usageStartTime: toClockTime(branch.usageStartTime),
          usageEndTime: toClockTime(branch.usageEndTime),
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
      // Always sent: "" is how the dialog clears the list (omitted = keep).
      allowedIpRanges: values.allowedIpRanges?.trim() ?? "",
      // Same for the hours: "" clears the window.
      usageStartTime: fromClockTime(values.usageStartTime),
      usageEndTime: fromClockTime(values.usageEndTime),
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
            allowedIpRanges: payload.allowedIpRanges,
            usageStartTime: payload.usageStartTime,
            usageEndTime: payload.usageEndTime,
          },
        });
        toast.success(t("Organization:BranchUpdated"));
      } else {
        await createBranch.mutateAsync(payload);
        toast.success(t("Organization:BranchCreated"));
      }
      onClose();
    } catch {
      // Global MutationCache.onError already shows the toast
    }
  };

  return (
    <Modal
      open={open}
      title={isEditing ? t("Organization:UpdateBranch") : t("Organization:AddBranch")}
      onCancel={onClose}
      onOk={() => void handleOk()}
      confirmLoading={saving}
      okText={t("Organization:SaveLabel")}
      cancelText={t("Organization:CancelLabel")}
      destroyOnClose
      width={720}
    >
      <Form form={form} layout="vertical" className="branch-editor-form">
        <div className="settings-row">
          <Form.Item
            name="code"
            label={t("Organization:BranchCodeLabel")}
            rules={isEditing ? [] : [{ required: true, message: t("Organization:BranchCodeRequired") }]}
          >
            <Input disabled={isEditing} placeholder={t("Organization:BranchCodePlaceholder")} />
          </Form.Item>
          <Form.Item
            name="name"
            label={t("Organization:BranchNameLabel")}
            rules={[{ required: true, message: t("Organization:BranchNameRequired") }]}
          >
            <Input />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item name="taxCode" label={t("Organization:TaxCodeLabel")}>
            <Input placeholder={t("Organization:TaxCodePlaceholder")} />
          </Form.Item>
          <Form.Item name="contactPerson" label={t("Organization:ContactPersonLabel")}>
            <Input placeholder={t("Organization:ContactPersonPlaceholder")} />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item
            name="email"
            label={t("Email")}
            rules={[{ type: "email", message: t("Organization:EmailInvalid") }]}
          >
            <Input placeholder={t("Email")} />
          </Form.Item>
          <Form.Item
            name="phoneNumber"
            label={t("Organization:PhoneLabel")}
            rules={[{ pattern: /^0\d{9,10}$/, message: t("Organization:PhoneInvalid") }]}
          >
            <Input placeholder={t("Organization:PhonePlaceholder")} />
          </Form.Item>
        </div>
        <div className="settings-row">
          <Form.Item name="provinceId" label={t("Organization:ProvinceLabel")}>
            <Select
              showSearch
              allowClear
              placeholder={t("Organization:ProvincePlaceholder")}
              options={provinces.map((p) => ({ label: p.name, value: p.code }))}
              filterOption={(input, option) =>
                (option?.label as string).toLowerCase().includes(input.toLowerCase())
              }
              onChange={() => form.setFieldValue("wardId", undefined)}
            />
          </Form.Item>
          <Form.Item name="wardId" label={t("Organization:WardLabel")}>
            <Select
              showSearch
              allowClear
              placeholder={t("Organization:WardPlaceholder")}
              options={wards.map((w) => ({ label: w.name, value: w.code }))}
              filterOption={(input, option) =>
                (option?.label as string).toLowerCase().includes(input.toLowerCase())
              }
              disabled={!selectedProvinceId}
            />
          </Form.Item>
        </div>
        <Form.Item name="address" label={t("Organization:AddressLabel")}>
          <Input placeholder={t("Organization:AddressPlaceholder")} />
        </Form.Item>
        <BranchIpRangesField />
        <BranchUsageHoursField />
      </Form>
    </Modal>
  );
}
