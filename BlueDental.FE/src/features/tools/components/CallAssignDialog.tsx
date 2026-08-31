import { useEffect } from "react";
import { Form, Input, Select, Switch } from "antd";
import { toast } from "sonner";
import {
  useCallConfigurations,
  useCreateCallAssignment,
  useUpdateCallAssignment,
  type CallAssignmentDto,
} from "../api/toolsApi";
import { AppDialog } from "@/components/AppDialog";
import { FloatingField } from "@/components/FloatingField";
import { useClinicBranches } from "@/features/organizations/api";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { useStaffOptions } from "@/hooks/useStaffOptions";
import { t } from "@/lib/i18n";

interface Props {
  open: boolean;
  assignment: CallAssignmentDto | null;
  onClose: () => void;
}

interface FormValues {
  sip: string;
  callConfigurationId: string;
  staffId: string;
  branchId: string;
  isActive: boolean;
}

/**
 * The reference's "Phân công gọi" dialog: which SIP extension, under which
 * configuration, belongs to which staff member.
 */
export function CallAssignDialog({ open, assignment, onClose }: Props) {
  const currentBranchId = useCurrentBranchId();
  const { data: branches } = useClinicBranches(true);
  const { data: staff, isLoading: staffLoading } = useStaffOptions();
  const { data: configurations } = useCallConfigurations({ maxResultCount: 100 });
  const createAssignment = useCreateCallAssignment();
  const updateAssignment = useUpdateCallAssignment();

  const [form] = Form.useForm<FormValues>();
  const sip = Form.useWatch("sip", form) ?? "";
  const callConfigurationId = Form.useWatch("callConfigurationId", form) ?? "";
  const staffId = Form.useWatch("staffId", form) ?? "";

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({
      sip: assignment?.sip ?? "",
      callConfigurationId: assignment?.callConfigurationId ?? "",
      staffId: assignment?.staffId ?? "",
      branchId: currentBranchId,
      isActive: assignment?.isActive ?? true,
    });
  }, [open, assignment, currentBranchId, form]);

  const pending = createAssignment.isPending || updateAssignment.isPending;

  const submit = async (values: FormValues) => {
    try {
      if (assignment) {
        await updateAssignment.mutateAsync({
          id: assignment.id,
          data: {
            sip: values.sip.trim(),
            callConfigurationId: values.callConfigurationId,
            staffId: values.staffId,
            isActive: values.isActive,
          },
        });
        toast.success(t("Đã cập nhật phân công"));
      } else {
        await createAssignment.mutateAsync({
          branchId: values.branchId,
          sip: values.sip.trim(),
          callConfigurationId: values.callConfigurationId,
          staffId: values.staffId,
          isActive: values.isActive,
        });
        toast.success(t("Đã tạo phân công"));
      }
      onClose();
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  return (
    <AppDialog
      open={open}
      title={t("Phân công gọi")}
      canSave={sip.trim().length > 0 && callConfigurationId !== "" && staffId !== ""}
      saving={pending}
      onSave={() => form.submit()}
      onClose={onClose}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ sip: "", callConfigurationId: "", staffId: "", branchId: "", isActive: true }}
        onFinish={(values) => void submit(values)}
      >
        <FloatingField
          name="sip"
          label={t("SIP")}
          required
          rules={[{ required: true, message: t("Vui lòng nhập SIP") }]}
        >
          <Input autoFocus />
        </FloatingField>

        <FloatingField
          name="callConfigurationId"
          label={t("Cấu hình")}
          required
          rules={[{ required: true, message: t("Vui lòng chọn cấu hình") }]}
        >
          <Select
            options={(configurations?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
            notFoundContent={t("Chưa có cấu hình nào")}
          />
        </FloatingField>

        <FloatingField
          name="staffId"
          label={t("Nhân viên")}
          required
          rules={[{ required: true, message: t("Vui lòng chọn nhân viên") }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            loading={staffLoading}
            options={staff ?? []}
          />
        </FloatingField>

        <FloatingField name="branchId" label={t("Chi nhánh")}>
          <Select
            // The update API keeps an assignment in its branch.
            disabled={assignment !== null}
            options={(branches ?? []).map((b) => ({ value: b.id, label: b.name }))}
          />
        </FloatingField>

        <div className="bd-call-dialog-switch">
          <span>{t("Trạng thái")}</span>
          <Form.Item name="isActive" valuePropName="checked">
            <Switch aria-label={t("Trạng thái")} />
          </Form.Item>
        </div>
      </Form>
    </AppDialog>
  );
}
