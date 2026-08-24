import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerInput } from "@/components/ui/date-picker-input";
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
import { Loader2, Search, Download, Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { extractApiError } from "@/lib/apiError";
import dayjs from "dayjs";
import {
  useLaboOrderList,
  useCreateLaboOrder,
  useDeleteLaboOrder,
  LABO_STATUS,
  LABO_STATUS_CONFIG,
  type LaboStatus,
  type CreateLaboOrderDto,
} from "../api/laboApi";
import {
  useLaboSupplierList, useCreateLaboSupplier, useUpdateLaboSupplier, useDeleteLaboSupplier,
  useLaboBiteTypeList, useCreateLaboBiteType, useUpdateLaboBiteType, useDeleteLaboBiteType,
  useLaboFinishLineList, useCreateLaboFinishLine, useUpdateLaboFinishLine, useDeleteLaboFinishLine,
  useLaboRhythmTypeList, useCreateLaboRhythmType, useUpdateLaboRhythmType, useDeleteLaboRhythmType,
  useLaboMaterialList, useCreateLaboMaterial, useUpdateLaboMaterial, useDeleteLaboMaterial,
  type LaboSupplierDto,
  type LaboMaterialDto,
} from "../api/laboCatalogApi";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useDebounce } from "@/hooks/useDebounce";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { useForm, Controller } from "react-hook-form";

// ── Types ──────────────────────────────────────────────────────────────────

type LaboSubRoute =
  | "mau-labo"
  | "supplier"
  | "bite"
  | "finish-line"
  | "nhip"
  | "service-material";

// ── Create Labo Order Modal ────────────────────────────────────────────────

interface CreateLaboFormValues {
  patientId: string;
  labProviderName: string;
  toothNumbers?: string;
  workDescription?: string;
  estimatedCost: number;
  dueDate?: string;
  notes?: string;
}

function CreateLaboModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [patientKeyword, setPatientKeyword] = useState("");
  const debouncedPatientKeyword = useDebounce(patientKeyword, 300);
  const { data: patientData } = usePatientList({ keyword: debouncedPatientKeyword || undefined, maxResultCount: 20 });
  const createMutation = useCreateLaboOrder();

  const { register, handleSubmit, control, reset, watch, setValue, formState: { errors } } = useForm<CreateLaboFormValues>();

  const onSubmit = handleSubmit(async (values) => {
    await createMutation.mutateAsync({
      ...values,
      dueDate: values.dueDate ? dayjs(values.dueDate).toISOString() : undefined,
    } as unknown as CreateLaboOrderDto);
    toast.success(t("Tạo mẫu Labo thành công"));
    reset();
    onClose();
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Tạo mẫu Labo mới")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3 mt-2">
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Khách hàng")} <span className="text-destructive">*</span></label>
            <Controller
              control={control}
              name="patientId"
              rules={{ required: t("Chọn khách hàng") }}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("Tìm khách hàng...")} />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5">
                      <Input
                        placeholder={t("Tìm...")}
                        value={patientKeyword}
                        onChange={(e) => setPatientKeyword(e.target.value)}
                        className="h-7 text-sm"
                      />
                    </div>
                    {(patientData?.items ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.fullName} — {p.phone ?? p.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.patientId && <p className="text-xs text-destructive mt-1">{errors.patientId.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Nhà cung cấp Labo")} <span className="text-destructive">*</span></label>
            <Input placeholder={t("Nhập tên nhà cung cấp")} {...register("labProviderName", { required: t("Nhập tên nhà cung cấp") })} />
            {errors.labProviderName && <p className="text-xs text-destructive mt-1">{errors.labProviderName.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Số răng")}</label>
            <Input placeholder="VD: 11, 12, 21" {...register("toothNumbers")} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Mô tả công việc")}</label>
            <textarea rows={3} placeholder={t("Mô tả công việc")} {...register("workDescription")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Chi phí ước tính (VND)")} <span className="text-destructive">*</span></label>
            <Input type="number" min={0} placeholder="0" {...register("estimatedCost", { required: t("Nhập chi phí"), valueAsNumber: true })} />
            {errors.estimatedCost && <p className="text-xs text-destructive mt-1">{errors.estimatedCost.message}</p>}
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Ngày giao dự kiến")}</label>
            <DatePickerInput value={watch("dueDate")} onChange={(v) => setValue("dueDate", v)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">{t("Ghi chú")}</label>
            <textarea rows={2} placeholder={t("Ghi chú")} {...register("notes")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>{t("Hủy")}</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="size-4 animate-spin mr-2" />}
              {t("Tạo mẫu Labo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Mẫu Labo View ─────────────────────────────────────────────────────────

function MauLaboView() {
  const [filterTab, setFilterTab] = useState<LaboStatus | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const MAU_LABO_FILTER_TABS: { key: LaboStatus | "all"; label: string }[] = [
    { key: "all",                  label: t("Tất Cả Mẫu") },
    { key: LABO_STATUS.Sent,       label: t("Mẫu Chưa Nhận") },
    { key: LABO_STATUS.InProgress, label: t("Mẫu Giao Trễ") },
    { key: LABO_STATUS.Received,   label: t("Mẫu Đã Nhận Hàng") },
  ];

  const { data, isLoading } = useLaboOrderList({
    status: filterTab === "all" ? undefined : filterTab,
    maxResultCount: 100,
  });
  const deleteMutation = useDeleteLaboOrder();

  const filtered = (data?.items ?? []).filter((o) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return (
      o.orderCode.toLowerCase().includes(kw) ||
      (o.patientName ?? "").toLowerCase().includes(kw) ||
      o.labProviderName.toLowerCase().includes(kw)
    );
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(t("Xóa mẫu Labo thành công"));
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <>
      {/* Status filter tabs */}
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {MAU_LABO_FILTER_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setFilterTab(tab.key)}
              style={{ padding: "8px 16px", border: "none", borderBottom: filterTab === tab.key ? "2px solid #1677ff" : "2px solid transparent", background: "none", color: filterTab === tab.key ? "#1677ff" : "#595959", fontWeight: filterTab === tab.key ? 600 : 400, cursor: "pointer", fontSize: 13 }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button variant="outline"><Download size={14} className="mr-1.5" />{t("Xuất Excel")}</Button>
            <Button onClick={() => setCreateOpen(true)}><Plus size={14} className="mr-1.5" />{t("Tạo mẫu Labo")}</Button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("Tìm theo mã, bệnh nhân...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-8 w-56" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="reception-card reception-card--content">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Mã / Ngày tạo")}</TableHead>
                <TableHead>{t("Nhà cung cấp")}</TableHead>
                <TableHead>{t("Khách hàng")}</TableHead>
                <TableHead>{t("Ngày giao / Trạng thái")}</TableHead>
                <TableHead>{t("Bác sĩ chỉ định")}</TableHead>
                <TableHead>{t("Răng")}</TableHead>
                <TableHead className="text-right">{t("Chi phí")}</TableHead>
                <TableHead className="w-20">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("Không có dữ liệu")}</TableCell></TableRow>
              ) : (
                filtered.map((o) => {
                  const cfg = LABO_STATUS_CONFIG[o.status];
                  return (
                    <TableRow key={o.id}>
                      <TableCell>
                        <div className="font-semibold">{o.orderCode}</div>
                        <div className="text-xs text-muted-foreground">{dayjs(o.creationTime).format("DD/MM/YYYY")}</div>
                      </TableCell>
                      <TableCell>{o.labProviderName}</TableCell>
                      <TableCell>{o.patientName ?? "—"}</TableCell>
                      <TableCell>
                        <div>{o.dueDate ? dayjs(o.dueDate).format("DD/MM/YYYY") : "—"}</div>
                        <span className="text-xs px-2 py-0.5 rounded mt-1 inline-block" style={{ background: cfg.color + "22", color: cfg.color, border: `1px solid ${cfg.color}44` }}>{cfg.label}</span>
                      </TableCell>
                      <TableCell>{o.dentistName ?? "—"}</TableCell>
                      <TableCell>{o.toothNumbers ?? "—"}</TableCell>
                      <TableCell className="text-right">{o.estimatedCost.toLocaleString("vi-VN")} ₫</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 size={14} /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>{t("Xóa mẫu Labo này?")}</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(o.id)}>{t("Xóa")}</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateLaboModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

// ── Supplier View ──────────────────────────────────────────────────────────

interface SupplierFormValues {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

function SupplierView() {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaboSupplierDto | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<SupplierFormValues>();

  const { data, isLoading } = useLaboSupplierList();
  const createMutation = useCreateLaboSupplier();
  const updateMutation = useUpdateLaboSupplier();
  const deleteMutation = useDeleteLaboSupplier();
  const isEdit = Boolean(editingItem);

  const filtered = (data?.items ?? []).filter(
    (s) => !keyword || s.name.toLowerCase().includes(keyword.toLowerCase()) || (s.phone ?? "").includes(keyword),
  );

  const openCreate = () => { setEditingItem(null); reset({ name: "", phone: "", email: "", address: "" }); setModalOpen(true); };
  const openEdit = (item: LaboSupplierDto) => { setEditingItem(item); reset({ name: item.name, phone: item.phone ?? "", email: item.email ?? "", address: item.address ?? "" }); setModalOpen(true); };

  const onSubmit = handleSubmit(async (values) => {
    if (isEdit && editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, data: values });
      toast.success(t("Cập nhật nhà cung cấp thành công"));
    } else {
      await createMutation.mutateAsync(values);
      toast.success(t("Tạo nhà cung cấp thành công"));
    }
    reset(); setEditingItem(null); setModalOpen(false);
  });

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); toast.success(t("Xóa thành công")); } catch (error) { toast.error(extractApiError(error)); }
  };

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("Tìm kiếm Labo...")} value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-8 w-72" />
          </div>
          <Button onClick={openCreate}><Plus size={14} className="mr-1.5" />{t("Tạo nhà cung cấp")}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Tên nhà cung cấp")}</TableHead>
              <TableHead>{t("Số điện thoại")}</TableHead>
              <TableHead>{t("Email")}</TableHead>
              <TableHead>{t("Địa chỉ")}</TableHead>
              <TableHead>{t("Cập nhật gần nhất")}</TableHead>
              <TableHead className="w-28">{t("Thao tác")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("Không có dữ liệu")}</TableCell></TableRow>
            ) : filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell>{s.phone ?? "—"}</TableCell>
                <TableCell>{s.email ?? "—"}</TableCell>
                <TableCell>{s.address ?? "—"}</TableCell>
                <TableCell>{s.lastModificationTime ? dayjs(s.lastModificationTime).format("DD/MM/YYYY") : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(s)}><Pencil size={14} /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 size={14} /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{t("Xóa nhà cung cấp?")}</AlertDialogTitle></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("Hủy")}</AlertDialogCancel>
                          <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(s.id)}>{t("Xóa")}</AlertDialogAction>
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

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { reset(); setEditingItem(null); setModalOpen(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isEdit ? t("Chỉnh sửa nhà cung cấp") : t("Thêm nhà cung cấp")}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Tên nhà cung cấp")} <span className="text-destructive">*</span></label>
              <Input placeholder={t("Nhập tên")} {...register("name", { required: t("Nhập tên") })} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Số điện thoại")}</label>
              <Input placeholder={t("Số điện thoại")} {...register("phone")} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Email")}</label>
              <Input placeholder={t("Email")} {...register("email")} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Địa chỉ")}</label>
              <textarea rows={2} placeholder={t("Địa chỉ")} {...register("address")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setEditingItem(null); setModalOpen(false); }}>{t("Hủy")}</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
                {isEdit ? t("Lưu") : t("Tạo")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface LaboCatalogItem {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  lastModificationTime?: string;
}

interface LaboCrudConfig {
  labelKey: string;
  useList: () => { data: { items: LaboCatalogItem[] } | undefined; isLoading: boolean };
  useCreate: () => { mutateAsync: (data: { name: string; description?: string }) => Promise<unknown>; isPending: boolean };
  useUpdate: () => { mutateAsync: (data: { id: string; data: { name: string; description?: string } }) => Promise<unknown>; isPending: boolean };
  useDelete: () => { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean };
}

const LABO_CRUD_CONFIGS: Record<string, LaboCrudConfig> = {
  bite: {
    labelKey: "Khớp cắn Labo",
    useList: useLaboBiteTypeList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboBiteType as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboBiteType as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboBiteType as LaboCrudConfig["useDelete"],
  },
  "finish-line": {
    labelKey: "Đường hoàn tất",
    useList: useLaboFinishLineList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboFinishLine as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboFinishLine as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboFinishLine as LaboCrudConfig["useDelete"],
  },
  nhip: {
    labelKey: "Kiểu nhịp Labo",
    useList: useLaboRhythmTypeList as LaboCrudConfig["useList"],
    useCreate: useCreateLaboRhythmType as LaboCrudConfig["useCreate"],
    useUpdate: useUpdateLaboRhythmType as LaboCrudConfig["useUpdate"],
    useDelete: useDeleteLaboRhythmType as LaboCrudConfig["useDelete"],
  },
};

interface CrudFormValues { name: string; description?: string; }

function LaboCrudView({ config }: { config: LaboCrudConfig }) {
  const label = t(config.labelKey);
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaboCatalogItem | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CrudFormValues>();

  const { data, isLoading } = config.useList();
  const createMutation = config.useCreate();
  const updateMutation = config.useUpdate();
  const deleteMutation = config.useDelete();
  const isEdit = Boolean(editingItem);

  const items = (data?.items ?? []).filter(
    (item) => !keyword || item.name.toLowerCase().includes(keyword.toLowerCase()),
  );

  const openCreate = () => { setEditingItem(null); reset({ name: "", description: "" }); setModalOpen(true); };
  const openEdit = (item: LaboCatalogItem) => { setEditingItem(item); reset({ name: item.name, description: item.description ?? "" }); setModalOpen(true); };

  const onSubmit = handleSubmit(async (values) => {
    if (isEdit && editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, data: values });
      toast.success(t("Cập nhật thành công"));
    } else {
      await createMutation.mutateAsync(values);
      toast.success(t("Tạo thành công"));
    }
    reset(); setEditingItem(null); setModalOpen(false);
  });

  const handleDelete = async (id: string) => {
    try { await deleteMutation.mutateAsync(id); toast.success(t("Xóa thành công")); } catch (error) { toast.error(extractApiError(error)); }
  };

  return (
    <>
      <div className="reception-card reception-card--toolbar">
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={`${t("Tìm kiếm...")} ${label.toLowerCase()}...`} value={keyword} onChange={(e) => setKeyword(e.target.value)} className="pl-8 w-72" />
          </div>
          <Button onClick={openCreate}><Plus size={14} className="mr-1.5" />{t("Tạo")} {label.toLowerCase()}</Button>
        </div>
      </div>
      <div className="reception-card reception-card--content overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{label}</TableHead>
              <TableHead>{t("Cập nhật gần nhất")}</TableHead>
              <TableHead className="w-28">{t("Thao tác")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">{t("Không có dữ liệu")}</TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.lastModificationTime ? dayjs(item.lastModificationTime).format("DD/MM/YYYY") : "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(item)}><Pencil size={14} /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 size={14} /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>{t("Xác nhận")}</AlertDialogTitle></AlertDialogHeader>
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

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { reset(); setEditingItem(null); setModalOpen(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{isEdit ? `${t("Chỉnh sửa")} ${label.toLowerCase()}` : `${t("Tạo")} ${label.toLowerCase()}`}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{label} <span className="text-destructive">*</span></label>
              <Input placeholder={`${t("Tạo")} ${label.toLowerCase()}...`} {...register("name", { required: `${t("Tạo")} ${label.toLowerCase()}` })} />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Mô tả")}</label>
              <textarea rows={2} placeholder={t("Mô tả")} {...register("description")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setEditingItem(null); setModalOpen(false); }}>{t("Hủy")}</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
                {isEdit ? t("Lưu") : t("Tạo")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface MaterialFormValues { name: string; category?: string; supplierId?: string; description?: string; }

function ServiceMaterialView() {
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LaboMaterialDto | null>(null);
  const { register, handleSubmit, control, reset } = useForm<MaterialFormValues>();

  const { data, isLoading } = useLaboMaterialList();
  const createMutation = useCreateLaboMaterial();
  const updateMutation = useUpdateLaboMaterial();
  const deleteMutation = useDeleteLaboMaterial();
  const { data: suppliers } = useLaboSupplierList();

  const items = (data?.items ?? []).filter((item) => {
    if (!keyword) return true;
    const kw = keyword.toLowerCase();
    return item.name.toLowerCase().includes(kw) || (item.category ?? "").toLowerCase().includes(kw);
  });

  const supplierMap = new Map((suppliers?.items ?? []).map((s) => [s.id, s.name]));

  const openCreate = () => { setEditingItem(null); reset({ name: "", category: "", supplierId: undefined, description: "" }); setModalOpen(true); };
  const openEdit = (item: LaboMaterialDto) => { setEditingItem(item); reset({ name: item.name, category: item.category ?? "", supplierId: item.supplierId ?? undefined, description: item.description ?? "" }); setModalOpen(true); };

  const onSubmit = handleSubmit(async (values) => {
    if (editingItem) {
      await updateMutation.mutateAsync({ id: editingItem.id, data: values });
      toast.success(t("Cập nhật vật liệu thành công"));
    } else {
      await createMutation.mutateAsync(values);
      toast.success(t("Thêm vật liệu thành công"));
    }
    reset(); setModalOpen(false); setEditingItem(null);
  });

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
    toast.success(t("Xóa vật liệu thành công"));
  };

  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div className="reception-card" style={{ width: 240, minWidth: 200, padding: 16, flexShrink: 0 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>
          {t("Nhà cung cấp")}
          <span style={{ fontWeight: 400, color: "#8c8c8c", marginLeft: 6 }}>{t("{0} NCC", (suppliers?.items ?? []).length)}</span>
        </div>
        {(suppliers?.items ?? []).length === 0 ? (
          <div style={{ color: "#8c8c8c", fontSize: 13, textAlign: "center", paddingTop: 24 }}>{t("Chưa có nhà cung cấp")}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(suppliers?.items ?? []).map((s) => (
              <div key={s.id} style={{ padding: "6px 8px", fontSize: 13, borderRadius: 4, background: "#F3F4F6", cursor: "default" }}>{s.name}</div>
            ))}
          </div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="reception-card reception-card--toolbar">
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
            <Button onClick={openCreate}><Plus size={14} className="mr-1.5" />{t("Tạo vật liệu")}</Button>
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
                <TableHead>{t("Tên vật liệu")}</TableHead>
                <TableHead>{t("Nhóm phân loại")}</TableHead>
                <TableHead>{t("Nhà cung cấp")}</TableHead>
                <TableHead>{t("Cập nhật gần nhất")}</TableHead>
                <TableHead className="w-28">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("Không có dữ liệu")}</TableCell></TableRow>
              ) : items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.category ?? "—"}</TableCell>
                  <TableCell>{item.supplierId ? supplierMap.get(item.supplierId) ?? "—" : "—"}</TableCell>
                  <TableCell>{item.lastModificationTime ? dayjs(item.lastModificationTime).format("DD/MM/YYYY") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(item)}><Pencil size={14} /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="destructive" size="sm" className="h-7 w-7 p-0"><Trash2 size={14} /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>{t("Xác nhận")}</AlertDialogTitle></AlertDialogHeader>
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

      <Dialog open={modalOpen} onOpenChange={(o) => { if (!o) { reset(); setModalOpen(false); setEditingItem(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? t("Chỉnh sửa vật liệu") : t("Thêm vật liệu Labo")}</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Tên vật liệu")} <span className="text-destructive">*</span></label>
              <Input placeholder={t("Nhập tên vật liệu")} {...register("name", { required: t("Nhập tên vật liệu") })} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Nhóm phân loại")}</label>
              <Input placeholder="VD: Kim loại, Sứ, Composite..." {...register("category")} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Nhà cung cấp")}</label>
              <Controller control={control} name="supplierId" render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value ?? ""}>
                  <SelectTrigger><SelectValue placeholder={t("Chọn nhà cung cấp")} /></SelectTrigger>
                  <SelectContent>
                    {(suppliers?.items ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">{t("Mô tả")}</label>
              <textarea rows={2} placeholder={t("Mô tả")} {...register("description")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); setModalOpen(false); setEditingItem(null); }}>{t("Hủy")}</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="size-4 animate-spin mr-2" />}
                {editingItem ? t("Lưu") : t("Tạo")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function LaboPage() {
  const [activeTab, setActiveTab] = useState<LaboSubRoute>("mau-labo");

  const SUB_ROUTES: { key: LaboSubRoute; label: string }[] = [
    { key: "mau-labo",         label: t("Mẫu Labo") },
    { key: "supplier",         label: t("Nhà cung cấp Labo") },
    { key: "bite",             label: t("Khớp cắn Labo") },
    { key: "finish-line",      label: t("Đường hoàn tất") },
    { key: "nhip",             label: t("Kiểu nhịp Labo") },
    { key: "service-material", label: t("Dịch vụ - vật liệu") },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "mau-labo":        return <MauLaboView />;
      case "supplier":        return <SupplierView />;
      case "bite":
      case "finish-line":
      case "nhip":            return <LaboCrudView config={LABO_CRUD_CONFIGS[activeTab]} />;
      case "service-material": return <ServiceMaterialView />;
      default:                return null;
    }
  };

  return (
    <div className="reception-page">
      <PageHeader title={t("Labo")} subtitle={t("Phiếu labo, nhà cung cấp và danh mục kỹ thuật")} />
      <div className="reception-card reception-card--tabs">
        <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
          {SUB_ROUTES.map((tab) => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: "8px 18px", border: "none", borderBottom: activeTab === tab.key ? "2px solid #1677ff" : "2px solid transparent", background: "none", color: activeTab === tab.key ? "#1677ff" : "#595959", fontWeight: activeTab === tab.key ? 600 : 400, cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
