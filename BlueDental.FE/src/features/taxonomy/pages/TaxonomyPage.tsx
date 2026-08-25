import { Drawer, message } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  useCatalogEntries,
  useCreateTaxonomyGroup,
  useDeleteCatalogEntry,
  useDeleteTaxonomyGroup,
  useReorderCatalogEntries,
  useReorderTaxonomyGroups,
  useTaxonomyGroups,
  type CatalogEntryDto,
  type TaxonomyDto,
} from "../api/taxonomyApi";
import { CatalogEntryTable } from "../components/CatalogEntryTable";
import { MedicalRecordTemplateDialog } from "../components/MedicalRecordTemplateDialog";
import { MedicineDialog } from "../components/MedicineDialog";
import { PrescriptionTemplateDialog } from "../components/PrescriptionTemplateDialog";
import { RichCatalogDialog } from "../components/RichCatalogDialog";
import { ServiceDialog } from "../components/ServiceDialog";
import { CatalogPanelHeader } from "../components/CatalogPanelHeader";
import { PatientTagPanel } from "../components/PatientTagPanel";
import { SimpleCatalogDialog } from "../components/SimpleCatalogDialog";
import { PaymentAccountPanel } from "../components/PaymentAccountPanel";
import { TaxonomyGroupModal } from "../components/TaxonomyGroupModal";
import { TaxonomyGroupPanel } from "../components/TaxonomyGroupPanel";
import {
  DEFAULT_TAXONOMY_TAB,
  findTaxonomyTab,
  taxonomyTabs,
  type TaxonomyTab,
} from "../taxonomyTabs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PageTabBar } from "@/components/PageTabBar";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "../countedTotal";
import { useDebounce } from "@/hooks/useDebounce";
import { extractApiError } from "@/lib/apiError";
import { useBranchFilter, useCurrentBranchId, useIsAllBranches } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";
import { moveItem } from "@/utils/array";
import { exportToExcel } from "@/utils/exportExcel";
import { formatDateTime } from "@/utils/format";

const DEFAULT_PAGE_SIZE = 20;

/** Either a group or an entry queued for the shared confirmation dialog. */
type PendingDelete =
  { kind: "group"; id: string; name: string } | { kind: "entry"; id: string; name: string };

function CatalogWorkspace({ tab }: { tab: TaxonomyTab }) {
  /**
   * Lists follow the header's branch selection, including "Tất cả chi nhánh";
   * a record can only be created in one branch, so writes use the concrete id
   * and the create action is disabled while the whole clinic is in view.
   */
  const branchFilter = useBranchFilter();
  const branchId = useCurrentBranchId();
  const isAllBranches = useIsAllBranches();
  const group = tab.group as string;
  /** Đơn thuốc mẫu is one flat table in the reference; the rest keep their groups. */
  const grouped = tab.grouped !== false;

  /**
   * The selected group lives in the URL so the screen can be linked to, and so
   * a reload comes back to the same group instead of jumping to the first one.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedGroupId = searchParams.get("group");

  const [keyword, setKeyword] = useState("");
  /** The group panel searches on the server, so its text lives here too. */
  const [groupKeyword, setGroupKeyword] = useState("");
  const pagination = useTablePagination(DEFAULT_PAGE_SIZE);
  const { page, pageSize } = pagination;
  const [groupsOpen, setGroupsOpen] = useState(false);

  const [entryModal, setEntryModal] = useState<{ open: boolean; entry: CatalogEntryDto | null }>({
    open: false,
    entry: null,
  });
  const [groupModal, setGroupModal] = useState<{ open: boolean; group: TaxonomyDto | null }>({
    open: false,
    group: null,
  });
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const debouncedKeyword = useDebounce(keyword, 300);
  const debouncedGroupKeyword = useDebounce(groupKeyword, 300);

  const groupsQuery = useTaxonomyGroups(branchFilter, group, debouncedGroupKeyword);
  const groups = useMemo(() => groupsQuery.data?.items ?? [], [groupsQuery.data]);
  /** While a group search is on, the panel holds matches rather than the catalog. */
  const searchingGroups = debouncedGroupKeyword.trim().length > 0;

  const entriesQuery = useCatalogEntries(branchFilter, group, {
    // A flat catalog lists the whole group; a grouped one waits for a selection.
    scope: grouped ? "group" : "catalog",
    taxonomyId: grouped ? (selectedGroupId ?? undefined) : undefined,
    filter: debouncedKeyword,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });

  const createGroup = useCreateTaxonomyGroup();
  const reorderGroupsMutation = useReorderTaxonomyGroups();
  const reorderEntriesMutation = useReorderCatalogEntries();
  const deleteGroup = useDeleteTaxonomyGroup();
  const deleteEntry = useDeleteCatalogEntry();

  const entries = entriesQuery.data?.items ?? [];
  const totalCount = entriesQuery.data?.totalCount ?? 0;

  /**
   * A group search narrows the panel but must not change what the right-hand
   * side is showing, so the selected group is remembered even while the search
   * hides it from the list.
   */
  const lastSelected = useRef<TaxonomyDto | null>(null);
  const inList = groups.find((item) => item.id === selectedGroupId) ?? null;
  if (inList) lastSelected.current = inList;
  const selectedGroup =
    inList ?? (lastSelected.current?.id === selectedGroupId ? lastSelected.current : null);

  /**
   * The reference opens on the first group rather than on a combined view, and
   * a group that disappears (deleted, or pointed at by a stale link) hands the
   * selection back to the first one. Replacing rather than pushing keeps the
   * back button on the previous screen.
   */
  useEffect(() => {
    // A search shows a subset, so "the selection is not in the list" says
    // nothing about whether the group still exists — leave it alone.
    if (!grouped || groupsQuery.isFetching || searchingGroups) return;

    // A group id belongs to one branch, so switching branches leaves a link
    // pointing at a group this branch does not have — drop it rather than
    // querying it and collecting a 403.
    // A group created a moment ago is selected before the list that would hold
    // it has come back — and before the URL carrying the selection has even
    // updated. Falling back here would hand the selection to the old first row
    // and the new group would never be shown.
    const awaited = awaitingGroupRef.current;
    if (awaited) {
      // Two things lag behind a create: the URL that carries the selection, and
      // the list that would contain the new group. Falling back before either
      // has caught up hands the selection to the old first row for good.
      if (selectedGroupId !== awaited) return;
      if (!groups.some((item) => item.id === awaited)) return;
      awaitingGroupRef.current = null;
    }

    const stillThere = selectedGroupId && groups.some((item) => item.id === selectedGroupId);
    if (stillThere) return;

    setSearchParams(
      (params) => {
        if (groups.length === 0) params.delete("group");
        else params.set("group", groups[0].id);
        return params;
      },
      { replace: true },
    );
  }, [grouped, groups, groupsQuery.isFetching, searchingGroups, selectedGroupId, setSearchParams]);

  /** A narrower result set can leave the current page past the end of the data. */
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > lastPage) pagination.resetToFirstPage();
  }, [page, pageSize, totalCount]);

  // The panel's rows are memoised, so the handlers they receive have to keep
  // their identity between renders or the memo buys nothing.
  /** A group selected before the list holding it has been refetched. */
  const awaitingGroupRef = useRef<string | null>(null);

  const selectGroup = useCallback(
    (id: string) => {
      setSearchParams((params) => {
        params.set("group", id);
        return params;
      });
      pagination.resetToFirstPage();
      setGroupsOpen(false);
    },
    [setSearchParams],
  );

  const openGroupModal = useCallback((item: TaxonomyDto) => {
    setGroupModal({ open: true, group: item });
  }, []);

  const openGroupModalForCreate = useCallback(() => {
    setGroupModal({ open: true, group: null });
  }, []);

  const requestGroupDelete = useCallback((item: TaxonomyDto) => {
    setPendingDelete({ kind: "group", id: item.id, name: item.name });
  }, []);

  const changeKeyword = (value: string) => {
    setKeyword(value);
    pagination.resetToFirstPage();
  };

  /** The whole list in its new order, as the reorder endpoints take it. */
  const orderedItems = <T extends { id: string }>(list: T[], from: number, to: number, base = 0) =>
    moveItem(list, from, to).map((item, index) => ({ id: item.id, order: base + index }));

  const reorderGroups = useCallback(
    async (from: number, to: number) => {
      try {
        await reorderGroupsMutation.mutateAsync({
          clinicBranchId: branchFilter,
          group,
          items: orderedItems(groups, from, to),
        });
      } catch (cause) {
        message.error(extractApiError(cause));
      }
    },
    [branchFilter, group, groups, reorderGroupsMutation],
  );

  const reorderEntries = useCallback(
    async (from: number, to: number) => {
      try {
        await reorderEntriesMutation.mutateAsync({
          clinicBranchId: branchFilter,
          group,
          taxonomyId: grouped ? (selectedGroupId ?? undefined) : undefined,
          // The page offset keeps row 1 of page 3 sorting after page 2.
          items: orderedItems(entries, from, to, (page - 1) * pageSize),
        });
      } catch (cause) {
        message.error(extractApiError(cause));
      }
    },
    [
      branchFilter,
      entries,
      group,
      grouped,
      page,
      pageSize,
      reorderEntriesMutation,
      selectedGroupId,
    ],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      if (pendingDelete.kind === "group") {
        await deleteGroup.mutateAsync(pendingDelete.id);
        message.success(t("Đã xoá nhóm"));
      } else {
        await deleteEntry.mutateAsync(pendingDelete.id);
        message.success(t("Đã xoá"));
      }
    } catch (cause) {
      message.error(extractApiError(cause));
    } finally {
      setPendingDelete(null);
    }
  };

  /**
   * A flat catalog still stores its entries under a taxonomy row, because that
   * is what the entry table is keyed by. The reference hides that from the
   * user, so the container group is created on first use rather than asked for.
   */
  const openEntryModal = async (entry: CatalogEntryDto | null) => {
    if (grouped || groups.length > 0 || entry) {
      setEntryModal({ open: true, entry });
      return;
    }

    try {
      await createGroup.mutateAsync({
        clinicBranchId: branchId,
        group,
        name: tab.label,
        sortOrder: 0,
      });
      setEntryModal({ open: true, entry: null });
    } catch (cause) {
      message.error(extractApiError(cause));
    }
  };

  const handleExport = () => {
    const columns: {
      header: string;
      key: keyof CatalogEntryDto;
      format?: (v: unknown) => string;
    }[] = [
      { header: t("Tên {0}", tab.noun), key: "name" },
      ...(grouped
        ? ([{ header: t("Nhóm phân loại"), key: "taxonomyName" }] as {
            header: string;
            key: keyof CatalogEntryDto;
          }[])
        : []),
      ...(tab.priced
        ? ([{ header: t("Giá"), key: "price" }] as { header: string; key: keyof CatalogEntryDto }[])
        : []),
      {
        header: t("Cập nhật gần nhất"),
        key: "lastModificationTime",
        format: (value) => formatDateTime(value as string | null),
      },
    ];

    exportToExcel(entries, columns, `danh-muc-${tab.key}`);
  };

  /** The add/edit dialog this catalog uses — see TaxonomyTab.dialog. */
  const entryDialogProps = {
    open: entryModal.open,
    entry: entryModal.entry,
    groups,
    defaultTaxonomyId: (grouped ? selectedGroupId : groups[0]?.id) ?? undefined,
    onClose: () => setEntryModal({ open: false, entry: null }),
  };

  const entryDialog = {
    service: <ServiceDialog {...entryDialogProps} />,
    medicine: <MedicineDialog {...entryDialogProps} />,
    rich: <RichCatalogDialog {...entryDialogProps} noun={tab.noun} />,
    prescription: <PrescriptionTemplateDialog {...entryDialogProps} />,
    "medical-record": <MedicalRecordTemplateDialog {...entryDialogProps} />,
    simple: <SimpleCatalogDialog {...entryDialogProps} noun={tab.noun} />,
  }[tab.dialog ?? "simple"];

  const groupPanel = (
    <TaxonomyGroupPanel
      title={t("Nhóm {0}", tab.noun)}
      subtitle={t("Chọn nhóm để xem {0} bên trong", tab.noun)}
      groups={groups}
      isLoading={groupsQuery.isLoading}
      isSearching={
        groupsQuery.isFetching && !groupsQuery.isLoading && !reorderGroupsMutation.isPending
      }
      keyword={groupKeyword}
      onKeywordChange={setGroupKeyword}
      selectedId={selectedGroupId}
      onSelect={selectGroup}
      onCreate={openGroupModalForCreate}
      onRename={openGroupModal}
      onDelete={requestGroupDelete}
      onReorder={reorderGroups}
    />
  );

  return (
    <div className="bd-taxonomy-shell">
      {grouped && (
        <>
          <aside className="bd-taxonomy-aside">
            {groupPanel}
          </aside>

          <Drawer
            open={groupsOpen}
            onClose={() => setGroupsOpen(false)}
            placement="left"
            size={288}
            title={t("Nhóm {0}", tab.noun)}
            className="bd-group-drawer"
            styles={{ body: { padding: 0 } }}
          >
            {groupPanel}
          </Drawer>
        </>
      )}

      <main className="bd-taxonomy-main">
        <CatalogPanelHeader
          title={grouped ? (selectedGroup?.name ?? tab.label) : tab.label}
          groupName={grouped ? (selectedGroup?.name ?? null) : null}
          noun={tab.noun}
          totalCount={totalCount}
          keyword={keyword}
          onKeywordChange={changeKeyword}
          onCreate={() => void openEntryModal(null)}
          onExport={tab.exportable === false ? null : handleExport}
          createDisabled={isAllBranches || (grouped && groups.length === 0)}
          exportDisabled={entries.length === 0}
          onOpenGroups={grouped ? () => setGroupsOpen(true) : null}
        />

        <div className="bd-cat-body">
          <div className="bd-cat-card">
            <CatalogEntryTable
              entries={entries}
              entityLabel={t("Tên {0}", tab.noun)}
              priced={Boolean(tab.priced)}
              showGroupColumn={grouped}
              isLoading={entriesQuery.isFetching && !reorderEntriesMutation.isPending}
              emptyText={
                grouped && groups.length === 0
                  ? t("Cần tạo ít nhất một nhóm phân loại trước khi thêm mục.")
                  : debouncedKeyword
                    ? t("Không tìm thấy kết quả phù hợp")
                    : t("Không có dữ liệu")
              }
              canReorder={!debouncedKeyword && (!grouped || selectedGroupId !== null)}
              onEdit={(entry) => setEntryModal({ open: true, entry })}
              onDelete={(entry) =>
                setPendingDelete({ kind: "entry", id: entry.id, name: entry.name })
              }
              onReorder={reorderEntries}
              pagination={pagination.buildConfig(totalCount, countedTotal(t("bản ghi")))}
            />
          </div>
        </div>
      </main>

      {/* The reference gives each catalog its own form, so the screen picks
          the dialog its tab names rather than bending one shared one. */}
      {entryDialog}

      <TaxonomyGroupModal
        open={groupModal.open}
        group={groupModal.group}
        taxonomyGroup={group}
        onClose={() => setGroupModal({ open: false, group: null })}
        onCreated={(created) => {
          awaitingGroupRef.current = created.id;
          selectGroup(created.id);
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={pendingDelete?.kind === "group" ? t("nhóm") : tab.noun}
        name={pendingDelete?.name ?? ""}
        pending={deleteGroup.isPending || deleteEntry.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}

/**
 * Two catalogs are not taxonomy-backed at all: they bring their own record
 * shape and their own flat screen.
 */
function StandaloneScreen({ tab }: { tab: TaxonomyTab }) {
  if (tab.screen === "tags") return <PatientTagPanel />;
  if (tab.screen === "payment-method") return <PaymentAccountPanel />;

  return (
    <div className="bd-center-full">
      <p className="bd-center-msg">
        {tab.pendingNote ?? t("Chưa có dữ liệu")}
      </p>
    </div>
  );
}

export function TaxonomyPage() {
  const tabs = taxonomyTabs();
  const { section } = useParams();
  const [searchParams] = useSearchParams();
  const tab = findTaxonomyTab(tabs, section ?? searchParams.get("tab") ?? DEFAULT_TAXONOMY_TAB);

  return (
    <div className="bd-taxonomy-page">
      <PageTabBar
        label={t("Danh mục")}
        activeKey={tab.key}
        tabs={tabs.map((item) => ({
          key: item.key,
          label: item.label,
          to: `/taxonomy/${item.key}`,
        }))}
      />

      <div className="bd-min0h bd-flex1">
        {tab.group ? (
          <CatalogWorkspace key={tab.key} tab={tab} />
        ) : (
          <StandaloneScreen key={tab.key} tab={tab} />
        )}
      </div>
    </div>
  );
}
