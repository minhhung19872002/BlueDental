import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import {
  TAXONOMY_GROUP,
  useCatalogEntries,
  useCreateTaxonomyGroup,
  useDeleteCatalogEntry,
  useTaxonomyGroups,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { CatalogEntryModal } from "../components/CatalogEntryModal";
import { useCurrentBranchId } from "@/lib/clinicBranch";
import { extractApiError } from "@/lib/apiError";
import { formatDate, formatVND } from "@/utils/format";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

/**
 * Every "Danh mục" sub-route in the reference is the same screen: a group list on
 * the left and the entries of the selected group on the right. Only the taxonomy
 * group slug and the column wording change, so the tabs are pure configuration.
 */
interface TaxonomyTab {
  key: string;
  label: string;
  /** Taxonomy group slug, or null for catalogs BlueDental has not modelled yet. */
  group: string | null;
  /** Singular noun used in column headers and dialogs. */
  entityLabel: string;
  priced?: boolean;
  templated?: boolean;
  /** Explains why a tab has no data source yet. */
  pendingNote?: string;
}

function useTaxonomyTabs(): TaxonomyTab[] {
  return [
    { key: "service", label: t("Dịch vụ"), group: TAXONOMY_GROUP.CareService, entityLabel: t("Tên dịch vụ"), priced: true },
    { key: "diagnosis", label: t("Chẩn đoán"), group: TAXONOMY_GROUP.Diagnosis, entityLabel: t("Tên chẩn đoán") },
    { key: "medicine", label: t("Loại thuốc"), group: TAXONOMY_GROUP.MedicationType, entityLabel: t("Tên loại thuốc"), priced: true },
    { key: "consulting", label: t("Dữ liệu tư vấn"), group: TAXONOMY_GROUP.ConsultingData, entityLabel: t("Tên dữ liệu tư vấn") },
    { key: "source", label: t("Nguồn đến"), group: TAXONOMY_GROUP.Source, entityLabel: t("Tên nguồn đến") },
    { key: "history", label: t("Lịch sử bệnh"), group: TAXONOMY_GROUP.DiseaseHistory, entityLabel: t("Tên lịch sử bệnh") },
    { key: "prescription-template", label: t("Đơn thuốc mẫu"), group: TAXONOMY_GROUP.PrescriptionTemplate, entityLabel: t("Tên đơn thuốc mẫu"), templated: true },
    { key: "medical-record-template", label: t("Bệnh án mẫu"), group: TAXONOMY_GROUP.MedicalRecordTemplate, entityLabel: t("Tên bệnh án mẫu"), templated: true },
    { key: "tags", label: t("Thẻ hồ sơ"), group: null, entityLabel: t("Tên thẻ"), pendingNote: t("Thẻ hồ sơ dùng danh mục riêng ở app gốc (medical-record/tag) — chưa dựng ở BlueDental.") },
    { key: "payment-method", label: t("Phương thức thanh toán"), group: null, entityLabel: t("Phương thức"), pendingNote: t("Phương thức thanh toán ở app gốc là tài khoản MoMo/ngân hàng, không phải danh mục — chưa dựng ở BlueDental.") },
    { key: "occupation", label: t("Nghề nghiệp"), group: TAXONOMY_GROUP.Occupation, entityLabel: t("Tên nghề nghiệp") },
  ];
}

function GroupSidebar({
  groups,
  isLoading,
  selectedId,
  onSelect,
  onAdd,
}: {
  groups: TaxonomyDto[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
}) {
  const [keyword, setKeyword] = useState("");
  const filtered = groups.filter((g) => g.name.toLowerCase().includes(keyword.toLowerCase()));

  return (
    <div style={{ width: 260, flexShrink: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 13, color: "#1B2A41", marginBottom: 2 }}>
        {t("Nhóm phân loại")}
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>
        {isLoading ? t("Đang tải…") : t("{0} nhóm", groups.length)}
      </div>

      <div className="relative mb-2">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={t("Tìm nhóm...")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={() => onSelect(null)}
        style={{
          width: "100%", textAlign: "left", border: "none", cursor: "pointer",
          padding: "8px 10px", borderRadius: 6, marginBottom: 4,
          background: selectedId === null ? "#EBF3FE" : "transparent",
          color: selectedId === null ? "#1E70E6" : "#1B2A41",
          fontWeight: selectedId === null ? 600 : 400,
        }}
      >
        {t("Tất cả nhóm")}
      </button>

      {filtered.map((group) => (
        <button
          key={group.id}
          type="button"
          onClick={() => onSelect(group.id)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            border: "none", cursor: "pointer", padding: "8px 10px", borderRadius: 6, marginBottom: 2,
            background: selectedId === group.id ? "#EBF3FE" : "transparent",
            color: selectedId === group.id ? "#1E70E6" : "#1B2A41",
            fontWeight: selectedId === group.id ? 600 : 400,
            textAlign: "left",
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {group.color && (
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: group.color, display: "inline-block",
              }} />
            )}
            {group.name}
          </span>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>{group.itemCount}</span>
        </button>
      ))}

      <Button variant="outline" className="w-full mt-2" onClick={onAdd}>
        <Plus size={14} className="mr-1" />
        {t("Thêm nhóm")}
      </Button>
    </div>
  );
}

function CatalogPanel({ tab }: { tab: TaxonomyTab }) {
  const branchId = useCurrentBranchId();
  const group = tab.group!;

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState("");
  const [editing, setEditing] = useState<CatalogEntryDto | null>(null);
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const { data: groupPage, isLoading: groupsLoading, isFetching: groupsFetching } =
    useTaxonomyGroups(branchId, group);
  const groups = useMemo(() => groupPage?.items ?? [], [groupPage]);

  const { data: entryPage, isLoading: entriesLoading } = useCatalogEntries(
    branchId,
    group,
    selectedGroupId ?? undefined,
    keyword,
  );

  const createGroup = useCreateTaxonomyGroup();
  const deleteEntry = useDeleteCatalogEntry();

  useEffect(() => {
    if (groupsFetching) return;
    if (selectedGroupId && !groups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [groups, groupsFetching, selectedGroupId]);

  const currentGroup = groups.find((g) => g.id === selectedGroupId);
  const entries: CatalogEntryDto[] = entryPage?.items ?? [];

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const created = await createGroup.mutateAsync({
        clinicBranchId: branchId,
        group,
        name: newGroupName.trim(),
      });
      setSelectedGroupId(created.id);
      toast.success(t("Đã thêm nhóm"));
      setGroupModalOpen(false);
      setNewGroupName("");
    } catch (error) {
      toast.error(extractApiError(error));
    }
  };

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <GroupSidebar
        groups={groups}
        isLoading={groupsLoading}
        selectedId={selectedGroupId}
        onSelect={setSelectedGroupId}
        onAdd={() => setGroupModalOpen(true)}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1B2A41" }}>
            {currentGroup?.name ?? tab.label}
            <span style={{ fontWeight: 400, color: "#9CA3AF", fontSize: 13, marginLeft: 8 }}>
              {t("{0} bản ghi", entryPage?.totalCount ?? 0)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 10 }}>
            {currentGroup
              ? t("Quản lý các mục thuộc nhóm {0}", currentGroup.name)
              : t("Tất cả mục của danh mục {0}", tab.label.toLowerCase())}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <Button
              disabled={groups.length === 0}
              onClick={() => { setEditing(null); setEntryModalOpen(true); }}
            >
              <Plus size={14} className="mr-1" />
              {t("Thêm {0}", tab.label.toLowerCase())}
            </Button>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 w-64"
                placeholder={t("Tìm theo {0}...", tab.entityLabel.toLowerCase())}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>

          {groups.length === 0 && !groupsLoading && (
            <div style={{ fontSize: 12, color: "#B45309", marginTop: 8 }}>
              {t("Cần tạo ít nhất một nhóm phân loại trước khi thêm mục.")}
            </div>
          )}
        </div>

        {entriesLoading ? (
          <div className="py-8 text-center text-muted-foreground">{t("Đang tải...")}</div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">{t("Không có dữ liệu")}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tab.entityLabel}</TableHead>
                <TableHead className="w-48">{t("Nhóm phân loại")}</TableHead>
                {tab.priced && <TableHead className="w-36 text-right">{t("Giá")}</TableHead>}
                <TableHead className="w-28">{t("Trạng thái")}</TableHead>
                <TableHead className="w-36">{t("Cập nhật gần nhất")}</TableHead>
                <TableHead className="w-36">{t("Thao tác")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.taxonomyName ?? "—"}</TableCell>
                  {tab.priced && (
                    <TableCell className="text-right">
                      {row.price == null ? "—" : `${formatVND(row.price)} đ`}
                    </TableCell>
                  )}
                  <TableCell>
                    {row.isActive ? (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                        {t("Đang dùng")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                        {t("Ngừng dùng")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(row.lastModificationTime ?? row.creationTime)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => { setEditing(row); setEntryModalOpen(true); }}
                      >
                        {t("Sửa")}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="link" size="sm" className="h-auto p-0 text-destructive">
                            {t("Xoá")}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("Xoá mục này?")}</AlertDialogTitle>
                            <AlertDialogDescription>{row.name}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("Huỷ")}</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await deleteEntry.mutateAsync(row.id);
                                  toast.success(t("Đã xoá"));
                                } catch (error) {
                                  toast.error(extractApiError(error));
                                }
                              }}
                            >
                              {t("Xoá")}
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
      </div>

      <CatalogEntryModal
        open={entryModalOpen}
        entry={editing}
        groups={groups}
        defaultTaxonomyId={selectedGroupId ?? undefined}
        priced={Boolean(tab.priced)}
        templated={Boolean(tab.templated)}
        entityLabel={tab.entityLabel}
        entityNoun={tab.label}
        onClose={() => { setEntryModalOpen(false); setEditing(null); }}
      />

      <Dialog open={groupModalOpen} onOpenChange={(o) => { if (!o) { setGroupModalOpen(false); setNewGroupName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Thêm nhóm phân loại")}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t("Tên nhóm")}
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleCreateGroup(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setGroupModalOpen(false); setNewGroupName(""); }}>
              {t("Huỷ")}
            </Button>
            <Button onClick={() => void handleCreateGroup()} disabled={createGroup.isPending}>
              {t("Thêm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TaxonomyPage() {
  const tabs = useTaxonomyTabs();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "service";
  const tab = tabs.find((tb) => tb.key === activeTab) ?? tabs[0];

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Danh mục")}
        subtitle={t("Dữ liệu nền cho dịch vụ, chẩn đoán, thuốc và nguồn khách")}
      />

      <div className="reception-card reception-card--toolbar">
        <Tabs
          value={tab.key}
          onValueChange={(key) => setSearchParams((p) => { p.set("tab", key); return p; })}
        >
          <TabsList className="flex flex-wrap h-auto gap-1">
            {tabs.map((tb) => (
              <TabsTrigger key={tb.key} value={tb.key}>{tb.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="reception-card reception-card--content">
        {tab.group ? (
          <CatalogPanel key={tab.key} tab={tab} />
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            {tab.pendingNote ?? t("Chưa có dữ liệu")}
          </div>
        )}
      </div>
    </div>
  );
}
