import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import {
  useClinicBranches,
  useCreateBranch,
  useUpdateBranch,
  useDeleteBranch,
  useDepartments,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type ClinicBranchDto,
  type DepartmentDto,
  type CreateClinicBranchDto,
  type UpdateClinicBranchDto,
  type CreateDepartmentDto,
  type UpdateDepartmentDto,
} from "../api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const BRANCH_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  Active: { bg: "#dcfce7", color: "#15803d" },
  Inactive: { bg: "#f3f4f6", color: "#374151" },
};

const BRANCH_STATUS_KEY: Record<string, string> = {
  Active: "Đang hoạt động",
  Inactive: "Ngừng hoạt động",
};

interface BranchFormState {
  code: string;
  name: string;
  address: string;
  phoneNumber: string;
  email: string;
}

function BranchTable() {
  const { data, isLoading } = useClinicBranches();
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const deleteMutation = useDeleteBranch();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<ClinicBranchDto | null>(null);
  const [form, setForm] = useState<BranchFormState>({ code: "", name: "", address: "", phoneNumber: "", email: "" });

  const openCreate = () => {
    setEditingBranch(null);
    setForm({ code: "", name: "", address: "", phoneNumber: "", email: "" });
    setModalOpen(true);
  };

  const openEdit = (record: ClinicBranchDto) => {
    setEditingBranch(record);
    setForm({
      code: record.code,
      name: record.name,
      address: record.address ?? "",
      phoneNumber: record.phoneNumber ?? "",
      email: record.email ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (editingBranch) {
      const updateData: UpdateClinicBranchDto = {
        name: form.name,
        address: form.address,
        phoneNumber: form.phoneNumber,
        email: form.email,
      };
      await updateMutation.mutateAsync({ id: editingBranch.id, data: updateData });
      toast.success(t("Cập nhật chi nhánh thành công"));
    } else {
      const createData: CreateClinicBranchDto = {
        code: form.code,
        name: form.name,
        address: form.address,
        phoneNumber: form.phoneNumber,
        email: form.email,
      };
      await createMutation.mutateAsync(createData);
      toast.success(t("Tạo chi nhánh thành công"));
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    toast.success(t("Xóa chi nhánh thành công"));
  };

  const rows: ClinicBranchDto[] = data ?? [];

  return (
    <>
      <PageHeader
        title={t("Chi nhánh")}
        subtitle={t("Danh sách cơ sở của phòng khám")}
      />

      <div className="flex justify-end mb-3">
        <Button onClick={openCreate}>
          <Plus size={14} className="mr-1" />
          {t("Thêm chi nhánh")}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">{t("Chưa có chi nhánh nào")}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">{t("Mã")}</TableHead>
              <TableHead>{t("Tên chi nhánh")}</TableHead>
              <TableHead>{t("Địa chỉ")}</TableHead>
              <TableHead className="w-36">{t("Số điện thoại")}</TableHead>
              <TableHead className="w-36">{t("Trạng thái")}</TableHead>
              <TableHead className="w-28">{t("Thao tác")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((record) => {
              const sc = BRANCH_STATUS_COLOR[record.status] ?? { bg: "#f3f4f6", color: "#374151" };
              return (
                <TableRow key={record.id}>
                  <TableCell>{record.code}</TableCell>
                  <TableCell>{record.name}</TableCell>
                  <TableCell>{record.address ?? "—"}</TableCell>
                  <TableCell>{record.phoneNumber ?? "—"}</TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                      style={sc}
                    >
                      {BRANCH_STATUS_KEY[record.status] ? t(BRANCH_STATUS_KEY[record.status]) : record.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(record)}>
                        <Pencil size={14} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="destructive">
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("Bạn có chắc muốn xóa chi nhánh này?")}</AlertDialogTitle>
                            <AlertDialogDescription>{record.name}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleDelete(record.id)}>
                              {t("Xác nhận")}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBranch ? t("Sửa chi nhánh") : t("Thêm chi nhánh")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Mã")} <span className="text-destructive">*</span></label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} disabled={Boolean(editingBranch)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Tên chi nhánh")} <span className="text-destructive">*</span></label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Địa chỉ")}</label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Số điện thoại")}</label>
              <Input value={form.phoneNumber} onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Email")}</label>
              <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t("Hủy")}</Button>
            <Button onClick={() => void handleSave()} disabled={createMutation.isPending || updateMutation.isPending}>
              {t("Lưu")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface DeptFormState {
  name: string;
  description: string;
}

function DepartmentTable() {
  const { data, isLoading } = useDepartments();
  const createMutation = useCreateDepartment();
  const updateMutation = useUpdateDepartment();
  const deleteMutation = useDeleteDepartment();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentDto | null>(null);
  const [form, setForm] = useState<DeptFormState>({ name: "", description: "" });

  const openCreate = () => {
    setEditingDept(null);
    setForm({ name: "", description: "" });
    setModalOpen(true);
  };

  const openEdit = (record: DepartmentDto) => {
    setEditingDept(record);
    setForm({ name: record.name, description: record.description ?? "" });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (editingDept) {
      const updateData: UpdateDepartmentDto = { name: form.name, description: form.description };
      await updateMutation.mutateAsync({ id: editingDept.id, data: updateData });
      toast.success(t("Cập nhật phòng ban thành công"));
    } else {
      const createData: CreateDepartmentDto = { name: form.name, description: form.description };
      await createMutation.mutateAsync(createData);
      toast.success(t("Tạo phòng ban thành công"));
    }
    setModalOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    toast.success(t("Xóa phòng ban thành công"));
  };

  const rows: DepartmentDto[] = data ?? [];

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button onClick={openCreate}>
          <Plus size={14} className="mr-1" />
          {t("Thêm phòng ban")}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">{t("Chưa có phòng ban nào")}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Tên phòng ban")}</TableHead>
              <TableHead>{t("Mô tả")}</TableHead>
              <TableHead className="w-36">{t("Trạng thái")}</TableHead>
              <TableHead className="w-28">{t("Thao tác")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{record.name}</TableCell>
                <TableCell>{record.description ?? "—"}</TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                    style={record.isActive ? { background: "#dcfce7", color: "#15803d" } : { background: "#f3f4f6", color: "#374151" }}
                  >
                    {record.isActive ? t("Đang hoạt động") : t("Ngừng hoạt động")}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(record)}>
                      <Pencil size={14} />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 size={14} />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("Bạn có chắc muốn xóa phòng ban này?")}</AlertDialogTitle>
                          <AlertDialogDescription>{record.name}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => void handleDelete(record.id)}>
                            {t("Xác nhận")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) setModalOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDept ? t("Sửa phòng ban") : t("Thêm phòng ban")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Tên phòng ban")} <span className="text-destructive">*</span></label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Mô tả")}</label>
              <textarea
                className="w-full min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>{t("Hủy")}</Button>
            <Button onClick={() => void handleSave()} disabled={createMutation.isPending || updateMutation.isPending}>
              {t("Lưu")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OrganizationListPage() {
  return (
    <div>
      <div className="bg-white rounded-xl px-5 py-4 mb-4 border border-border">
        <h2 className="m-0 text-lg font-bold text-[#1B2A41]">
          {t("Chi nhánh & Phòng ban")}
        </h2>
      </div>
      <div className="bg-white rounded-xl border border-border px-5">
        <Tabs defaultValue="branches">
          <TabsList className="border-b w-full justify-start rounded-none bg-transparent gap-0 mb-0">
            <TabsTrigger value="branches" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              {t("Chi nhánh")}
            </TabsTrigger>
            <TabsTrigger value="departments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
              {t("Phòng ban")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="branches" className="pt-4">
            <BranchTable />
          </TabsContent>
          <TabsContent value="departments" className="pt-4">
            <DepartmentTable />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
