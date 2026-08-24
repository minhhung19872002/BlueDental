import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  useClinicBranch,
  useClinicBranches,
  useUpdateClinicBranch,
} from "../api";
import { useStaffList, useStaffRoleNames } from "@/features/staff/api/staffQueries";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BranchFormValues {
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
}

/**
 * Cài đặt phòng khám.
 *
 * The design's general-info card lists a tagline, opening hours and a calendar
 * step. None of those exist on the branch the API updates, so the card carries
 * the fields the server actually stores — a Save that silently drops what was
 * typed would be worse than a shorter form.
 */
export function ClinicSettingsPage() {
  const branchId = useCurrentBranchId();

  const { data: branch, isLoading } = useClinicBranch(branchId);
  const { data: branches } = useClinicBranches();
  const { data: roleNames } = useStaffRoleNames();
  const { data: staff } = useStaffList({ maxResultCount: 200 });
  const updateBranch = useUpdateClinicBranch();

  const [form, setForm] = useState<BranchFormValues>({ name: "", address: "", phoneNumber: "", email: "" });

  useEffect(() => {
    if (branch) {
      setForm({
        name: branch.name,
        address: branch.address ?? "",
        phoneNumber: branch.phoneNumber ?? "",
        email: branch.email ?? "",
      });
    }
  }, [branch]);

  const setField = <K extends keyof BranchFormValues>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      await updateBranch.mutateAsync({ id: branchId, input: form });
      toast.success(t("Đã lưu cài đặt phòng khám"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  const staffPerRole = new Map<string, number>();
  for (const member of staff?.items ?? []) {
    for (const role of member.roleNames) {
      staffPerRole.set(role, (staffPerRole.get(role) ?? 0) + 1);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-header-title">{t("Cài đặt phòng khám")}</h1>
          <p className="page-header-subtitle">
            {t("Thông tin thương hiệu, chi nhánh và phân quyền")}
          </p>
        </div>
      </div>

      <div className="settings-split">
        <div className="page-card">
          <div className="dash-card-title" style={{ marginBottom: 15 }}>
            {t("Thông tin chung")}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  {t("Tên phòng khám")} <span className="text-destructive">*</span>
                </label>
                <Input value={form.name} onChange={(e) => setField("name", e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">{t("Địa chỉ")}</label>
                <Input value={form.address} onChange={(e) => setField("address", e.target.value)} />
              </div>
              <div className="settings-row">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">{t("Số điện thoại")}</label>
                  <Input value={form.phoneNumber} onChange={(e) => setField("phoneNumber", e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Email</label>
                  <Input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
                </div>
              </div>
              <Button
                className="w-full"
                size="lg"
                disabled={updateBranch.isPending}
                onClick={() => void handleSave()}
              >
                {updateBranch.isPending ? (
                  <><Loader2 className="size-4 animate-spin mr-2" />{t("Đang lưu...")}</>
                ) : t("Lưu thay đổi")}
              </Button>
            </div>
          )}
        </div>

        <div className="settings-side">
          <div className="page-card">
            <div className="dash-card-title" style={{ marginBottom: 14 }}>
              {t("Chi nhánh")}
            </div>
            {(branches ?? []).length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm">{t("Chưa có chi nhánh")}</div>
            ) : (
              <div className="dash-list">
                {(branches ?? []).map((item) => (
                  <div key={item.id} className="settings-branch">
                    <span className="settings-dot" />
                    <span className="dash-row-main">
                      <span className="dash-row-title">{item.name}</span>
                      <span className="dash-row-caption">{item.address ?? "—"}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="page-card">
            <div className="dash-card-title" style={{ marginBottom: 14 }}>
              {t("Phân quyền")}
            </div>
            {(roleNames ?? []).length === 0 ? (
              <div className="py-4 text-center text-muted-foreground text-sm">{t("Chưa có vai trò")}</div>
            ) : (
              <div className="settings-roles">
                {(roleNames ?? []).map((role) => (
                  <div key={role} className="settings-role">
                    <span className="settings-role-name">{role}</span>
                    <span className="settings-role-count">
                      {t("{0} người", staffPerRole.get(role) ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
