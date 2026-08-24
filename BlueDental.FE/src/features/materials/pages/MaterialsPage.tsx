import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Search, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import dayjs from "dayjs";
import { useForm, Controller } from "react-hook-form";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import {
  useInventoryItemList,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  type InventoryItemDto,
  type UpdateInventoryItemDto,
} from "../api";
import {
  useDepartmentList,
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  type DepartmentDto,
} from "../api/departmentApi";
import {
  useAllocationList,
  useCreateAllocation,
  useDeleteAllocation,
} from "../api/allocationApi";

// ── Types ──────────────────────────────────────────────────────────────────

type MaterialsSubRoute = "clinic" | "allocation" | "department";

// ── Create/Edit Modal ─────────────────────────────────────────────────────

interface InventoryFormValues {
  itemCode?: string;
  name: string;
  category?: string;
  unit?: string;
  reorderLevel?: number;
  unitCost?: number;
}

interface InventoryModalProps {
  open: boolean;
  onClose: () => void;
  editingItem: InventoryItemDto | null;
}

function InventoryModal({ open, onClose, editingItem }: InventoryModalProps) {
  const createMutation = useCreateInventoryItem();
  const updateMutation = useUpdateInventoryItem();
  const isEdit = Boolean(editingItem);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<InventoryFormValues>({
    defaultValues: editingItem ? {
      name: editingItem.name,
      category: editingItem.category ?? "",
      unit: editingItem.unit ?? "",
      reorderLevel: editingItem.reorderLevel,
    } : {},
  });

  const onSubmit = handleSubmit(async (values) => {
    if (isEdit && editingItem) {
      await updateMutation.mutateAsync({
        id: editingItem.id,
        data: {
          name: values.name,
          category: values.category,
          unit: values.unit,
          reorderLevel: values.reorderLevel ?? 0,
          unitCost: values.unitCost,
        } as UpdateInventoryItemDto,
      });
      toast.success(t("Cập nhật vật tư thành công"));
    } else {
      await createMutation.mutateAsync({
        itemCode: values.itemCode ?? "",
        name: values.name,
        category: values.category,
        unit: values.unit,
        reorderLevel: values.reorderLevel ?? 0,
        unitCost: values.unitCost,
      });
      toast.success(t("Thêm vật tư thành công"));
    }
    reset();
    onClose();
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("Chỉnh sửa vật tư") : t("Thêm vật tư mới")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 mt-2">
          {!isEdit && (
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Mã vật tư")} <span className="text-destructive">*</span></label>
              <Input placeholder={t("Nhập mã vật tư")} {...register("itemCode", { required: t("Nhập mã vật tư") })} />
              {errors.itemCode && <p className="text-xs text-destructive mt-1">{errors.itemCode.message}</p>}
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Tên vật tư")} <span className="text-destructive">*</span></label>
            <Input placeholder={t("Nhập tên vật tư")} {...register("name", { required: t("Nhập tên vật tư") })} defaultValue={editingItem?.name} />
            {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Nhóm phân loại")}</label>
            <Input placeholder={t("Nhóm phân loại")} {...register("category")} defaultValue={editingItem?.category ?? ""} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Đơn vị")}</label>
            <Input placeholder={t("Đơn vị")} {...register("unit")} defaultValue={editingItem?.unit ?? ""} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Mức tồn kho tối thiểu")}</label>
            <Input type="number" min={0} placeholder="0" {...register("reorderLevel", { valueAsNumber: true })} defaultValue={editingItem?.reorderLevel} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Giá nhập (VND)")}</label>
            <Input type="number" min={0} placeholder="0" {...register("unitCost", { valueAsNumber: true })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>{t("Hủy")}</Button>
            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
              {isEdit ? t("Lưu thay đổi") : t("Thêm vật tư")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Clinic Materials View ─────────────────────────────────────────────────

function ClinicMaterialsView() {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItemDto | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupSearch, setGroupSearch] = useState("");

  const { data, isLoading } = useInventoryItemList();
  const deleteMutation = useDeleteInventoryItem();

  const allItems = data?.items ?? [];
  const categories = [...new Set(allItems.map((i) => i.category).filter(Boolean))] as string[];
  const filteredCategories = categories.filter((c) =>
    !groupSearch || c.toLowerCase().includes(groupSearch.toLowerCase()),
  );

  const filtered = allItems.filter((item) => {
    if (selectedGroup && item.category !== selectedGroup) return false;
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return item.name.toLowerCase().includes(kw) || item.itemCode.toLowerCase().includes(kw) || (item.category ?? "").toLowerCase().includes(kw);
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Xóa vật tư thành công"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <div style={{ display: "flex", gap: 16 }}>
      {/* Left panel: material groups */}
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            {t("Nhóm vật tư")}
            <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>{t("{0} nhóm", categories.length)}</span>
          </div>
          <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>{t("Chọn nhóm để xem vật tư")}</div>
          <Input
            placeholder={t("Tìm nhóm vật tư...")}
            className="h-7 text-sm mb-2"
            value={groupSearch}
            onChange={(e) => setGroupSearch(e.target.value)}
          />
        </div>
        {filteredCategories.length === 0 ? (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 16 }}>{t("Chưa có nhóm vật tư")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, background: selectedGroup === null ? "#e6f4ff" : "transparent", color: selectedGroup === null ? "#1677ff" : undefined, fontWeight: selectedGroup === null ? 500 : 400 }}
              onClick={() => setSelectedGroup(null)}>
              {t("Tất cả")} ({allItems.length})
            </div>
            {filteredCategories.map((cat) => {
              const count = allItems.filter((i) => i.category === cat).length;
              return (
                <div key={cat}
                  style={{ padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, background: selectedGroup === cat ? "#e6f4ff" : "transparent", color: selectedGroup === cat ? "#1677ff" : undefined, fontWeight: selectedGroup === cat ? 500 : 400 }}
                  onClick={() => setSelectedGroup(cat)}>
                  {cat} ({count})
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={() => { setEditingItem(null); setModalOpen(true); }}><Plus size={14} className="mr-1.5" />{t("Thêm vật tư")}</Button>
              <Button variant="outline" disabled>{t("Sync data hệ thống")}</Button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t("Tìm kiếm...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-8 w-56" />
            </div>
          </div>
        </div>
        <div className="reception-card reception-card--content overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">{t("Mã")}</TableHead>
                <TableHead>{t("Tên vật liệu")}</TableHead>
                <TableHead>{t("Nhóm phân loại")}</TableHead>
                <TableHead>{t("Đơn vị")}</TableHead>
                <TableHead className="text-right">{t("Tồn kho")}</TableHead>
                <TableHead>{t("Trạng thái")}</TableHead>
                <TableHead>{t("Cập nhật gần nhất")}</TableHead>
                <TableHead className="w-28">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("Không có dữ liệu")}</TableCell></TableRow>
              ) : filtered.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.itemCode}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category ?? "—"}</TableCell>
                  <TableCell>{item.unit ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <span style={{ color: item.needsReorder ? "#ff4d4f" : undefined, fontWeight: item.needsReorder ? 600 : 400 }}>{item.quantityOnHand}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${!item.isActive ? "bg-gray-100 text-gray-500" : item.needsReorder ? "bg-orange-100 text-orange-600" : "bg-green-100 text-green-700"}`}>
                      {!item.isActive ? t("Ngừng") : item.needsReorder ? t("Sắp hết") : t("Đủ hàng")}
                    </span>
                  </TableCell>
                  <TableCell>{item.lastModificationTime ? dayjs(item.lastModificationTime).format("DD/MM/YYYY") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingItem(item); setModalOpen(true); }}><Pencil size={14} /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 size={14} /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>{t("Xác nhận xóa vật tư này?")}</AlertDialogTitle></AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(item.id)}>{t("Xóa")}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <InventoryModal open={modalOpen} onClose={() => { setModalOpen(false); setEditingItem(null); }} editingItem={editingItem} />
    </div>
  );
}

// ── Allocation View ────────────────────────────────────────────────────────

interface AllocationFormValues {
  inventoryItemId: string;
  departmentId: string;
  allocatedQuantity: number;
  performerName?: string;
  note?: string;
}

function AllocationView() {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<AllocationFormValues>();

  const { data, isLoading } = useAllocationList();
  const { data: inventoryData } = useInventoryItemList();
  const { data: deptData } = useDepartmentList();
  const createMutation = useCreateAllocation();
  const deleteMutation = useDeleteAllocation();

  const allItems = data?.items ?? [];
  const filtered = allItems.filter((item) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return item.allocationCode.toLowerCase().includes(kw) ||
      (item.inventoryItemName ?? "").toLowerCase().includes(kw) ||
      (item.performerName ?? "").toLowerCase().includes(kw);
  });

  const onSubmit = handleSubmit(async (values) => {
    await createMutation.mutateAsync(values);
    toast.success(t("Tạo phiếu phân bổ thành công"));
    reset();
    setModalOpen(false);
  });

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    toast.success(t("Xóa phiếu phân bổ thành công"));
  };

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => { reset(); setModalOpen(true); }}><Plus size={14} className="mr-1.5" />{t("Tạo phiếu phân bổ")}</Button>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t("Tìm phiếu phân bổ...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-8 w-72" />
            </div>
          </div>
          <Button variant="outline">{t("Lịch sử kiểm kho")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">{t("Thời gian phân bổ")}</TableHead>
              <TableHead className="w-36">{t("Mã phân bổ")}</TableHead>
              <TableHead>{t("Tên vật liệu")}</TableHead>
              <TableHead className="text-right w-32">{t("SL được phân bổ")}</TableHead>
              <TableHead className="text-right w-36">{t("SL confirm còn lại")}</TableHead>
              <TableHead>{t("Phòng ban")}</TableHead>
              <TableHead>{t("Người thực hiện")}</TableHead>
              <TableHead>{t("Ghi chú")}</TableHead>
              <TableHead className="w-20">{t("Thao tác")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">{t("Chưa có phiếu phân bổ")}</TableCell></TableRow>
            ) : filtered.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.allocationTime ? dayjs(item.allocationTime).format("DD/MM/YYYY HH:mm") : "—"}</TableCell>
                <TableCell>{item.allocationCode}</TableCell>
                <TableCell>{item.inventoryItemName ?? "—"}</TableCell>
                <TableCell className="text-right">{item.allocatedQuantity}</TableCell>
                <TableCell className="text-right">{item.confirmedRemaining}</TableCell>
                <TableCell>{item.departmentName ?? "—"}</TableCell>
                <TableCell>{item.performerName ?? "—"}</TableCell>
                <TableCell>{item.note ?? "—"}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 size={14} /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>{t("Xác nhận xóa vật tư này?")}</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(item.id)}>{t("Xóa")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { reset(); setModalOpen(false); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Tạo phiếu phân bổ")}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Tên vật liệu")} <span className="text-destructive">*</span></label>
              <Controller control={control} name="inventoryItemId" rules={{ required: t("Chọn vật tư") }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <SelectTrigger><SelectValue placeholder={t("Chọn vật tư...")} /></SelectTrigger>
                    <SelectContent>
                      {(inventoryData?.items ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.itemCode} - {i.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              {errors.inventoryItemId && <p className="text-xs text-destructive mt-1">{errors.inventoryItemId.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Phòng ban")} <span className="text-destructive">*</span></label>
              <Controller control={control} name="departmentId" rules={{ required: t("Chọn phòng ban") }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <SelectTrigger><SelectValue placeholder={t("Chọn phòng ban...")} /></SelectTrigger>
                    <SelectContent>
                      {(deptData?.items ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )} />
              {errors.departmentId && <p className="text-xs text-destructive mt-1">{errors.departmentId.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Số lượng phân bổ")} <span className="text-destructive">*</span></label>
              <Input type="number" min={0.001} step={0.001} placeholder="0" {...register("allocatedQuantity", { required: t("Nhập số lượng"), valueAsNumber: true })} />
              {errors.allocatedQuantity && <p className="text-xs text-destructive mt-1">{errors.allocatedQuantity.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Người thực hiện")}</label>
              <Input placeholder={t("Tên người thực hiện...")} {...register("performerName")} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Ghi chú")}</label>
              <textarea rows={2} placeholder={t("Ghi chú...")} {...register("note")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setModalOpen(false); }}>{t("Hủy")}</Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
                {t("Tạo phiếu")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Department View ────────────────────────────────────────────────────────

interface DeptFormValues { name: string; description?: string; }

function DepartmentView() {
  const [keyword, setKeyword] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentDto | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<DeptFormValues>();

  const { data: deptData, isLoading: deptLoading } = useDepartmentList();
  const createDept = useCreateDepartment();
  const updateDept = useUpdateDepartment();
  const deleteDept = useDeleteDepartment();
  const { data: allocData, isLoading: allocLoading } = useAllocationList(selectedDeptId ?? undefined);

  const departments = deptData?.items ?? [];
  const allocations = (allocData?.items ?? []).filter((a) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return (a.inventoryItemName ?? "").toLowerCase().includes(kw) || a.allocationCode.toLowerCase().includes(kw);
  });

  const openCreate = () => { setEditingDept(null); reset({ name: "", description: "" }); setDeptModalOpen(true); };
  const openEdit = (d: DepartmentDto) => { setEditingDept(d); reset({ name: d.name, description: d.description ?? "" }); setDeptModalOpen(true); };

  const onSubmit = handleSubmit(async (values) => {
    if (editingDept) {
      await updateDept.mutateAsync({ id: editingDept.id, data: values });
      toast.success(t("Cập nhật phòng ban thành công"));
    } else {
      await createDept.mutateAsync(values);
      toast.success(t("Tạo phòng ban thành công"));
    }
    reset(); setDeptModalOpen(false); setEditingDept(null);
  });

  const handleDeptDelete = async (id: string) => {
    await deleteDept.mutateAsync(id);
    if (selectedDeptId === id) setSelectedDeptId(null);
    toast.success(t("Xóa phòng ban thành công"));
  };

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          {t("Phòng ban")}
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>{t("{0} phòng ban", departments.length)}</span>
        </div>
        <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 10 }}>{t("Chọn phòng ban để xem vật tư đã phát và kiểm kho")}</div>
        <Button variant="outline" className="w-full h-7 text-sm mb-2" onClick={openCreate}><Plus size={12} className="mr-1" />{t("Tạo phòng ban")}</Button>
        {deptLoading ? null : departments.length === 0 ? (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 24 }}>{t("Chưa có phòng ban")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {departments.map((d) => (
              <div key={d.id} onClick={() => setSelectedDeptId(d.id === selectedDeptId ? null : d.id)}
                style={{ padding: "6px 8px", fontSize: 13, borderRadius: 4, cursor: "pointer", background: d.id === selectedDeptId ? "#E6F4FF" : "#F9FAFB", color: d.id === selectedDeptId ? "#1677ff" : "#374151", fontWeight: d.id === selectedDeptId ? 600 : 400, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{d.name}</span>
                <div style={{ display: "flex", gap: 2 }} onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" className="p-0 h-5 w-5" onClick={() => openEdit(d)}><Pencil size={12} /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-0 h-5 w-5 text-destructive"><Trash2 size={12} /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>{t("Xóa phòng ban?")}</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDeptDelete(d.id)}>{t("Xóa")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder={t("Tìm vật tư...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-8 w-56" />
            </div>
            <Button variant="outline">{t("Gộp số lượng vật tư")}</Button>
          </div>
        </div>
        <div className="reception-card reception-card--content overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">{t("Thời gian phân bổ")}</TableHead>
                <TableHead className="w-36">{t("Mã phân bổ")}</TableHead>
                <TableHead>{t("Tên vật liệu")}</TableHead>
                <TableHead className="text-right w-28">{t("SL được phát")}</TableHead>
                <TableHead className="text-right w-40">{t("SL còn lại (đã duyệt)")}</TableHead>
                <TableHead>{t("Người thực hiện")}</TableHead>
                <TableHead>{t("Ghi chú")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : !selectedDeptId ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("Chọn phòng ban để xem vật tư đã phát và kiểm kho")}</TableCell></TableRow>
              ) : allocations.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("Chưa có vật tư phân bổ cho phòng ban này")}</TableCell></TableRow>
              ) : allocations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.allocationTime ? dayjs(a.allocationTime).format("DD/MM/YYYY HH:mm") : "—"}</TableCell>
                  <TableCell>{a.allocationCode}</TableCell>
                  <TableCell>{a.inventoryItemName ?? "—"}</TableCell>
                  <TableCell className="text-right">{a.allocatedQuantity}</TableCell>
                  <TableCell className="text-right">{a.confirmedRemaining}</TableCell>
                  <TableCell>{a.performerName ?? "—"}</TableCell>
                  <TableCell>{a.note ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={deptModalOpen} onOpenChange={(o) => { if (!o) { reset(); setDeptModalOpen(false); setEditingDept(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingDept ? t("Chỉnh sửa phòng ban") : t("Tạo phòng ban")}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Tên phòng ban")} <span className="text-destructive">*</span></label>
              <Input placeholder="VD: Phòng khám 1, Phòng lễ tân..." {...register("name", { required: t("Nhập tên phòng ban") })} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Mô tả")}</label>
              <textarea rows={2} placeholder={t("Mô tả...")} {...register("description")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setDeptModalOpen(false); setEditingDept(null); }}>{t("Hủy")}</Button>
              <Button type="submit" disabled={createDept.isPending || updateDept.isPending}>
                {(createDept.isPending || updateDept.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
                {editingDept ? t("Lưu thay đổi") : t("Tạo phòng ban")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<MaterialsSubRoute>("clinic");

  const SUB_ROUTES: { key: MaterialsSubRoute; label: string }[] = [
    { key: "clinic",     label: t("Vật tư phòng khám") },
    { key: "allocation", label: t("Phân bổ vật tư") },
    { key: "department", label: t("Phòng ban") },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "clinic":     return <ClinicMaterialsView />;
      case "allocation": return <AllocationView />;
      case "department": return <DepartmentView />;
      default:           return null;
    }
  };

  return (
    <div className="reception-page">
      <PageHeader title={t("Vật tư phòng khám")} subtitle={t("Vật tư, phân bổ và tồn kho theo phòng ban")} />
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0 }}>
          {SUB_ROUTES.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: "8px 20px", border: "none", borderBottom: activeTab === tab.key ? "2px solid #1677ff" : "2px solid transparent", background: "none", color: activeTab === tab.key ? "#1677ff" : "#595959", fontWeight: activeTab === tab.key ? 600 : 400, cursor: "pointer", fontSize: 14, whiteSpace: "nowrap" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
