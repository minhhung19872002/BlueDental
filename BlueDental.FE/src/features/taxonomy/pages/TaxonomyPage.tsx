import { Drawer } from "antd";
import "../components/taxonomy.css";
import { toast } from "sonner";
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
import { CatalogImportDialog } from "../components/CatalogImportDialog";
import { MedicalRecordTemplateDialog } from "../components/MedicalRecordTemplateDialog";
import { MedicineDialog } from "../components/MedicineDialog";
import { PrescriptionTemplateDialog } from "../components/PrescriptionTemplateDialog";
import { RichCatalogDialog } from "../components/RichCatalogDialog";
import { ServiceCatalogSyncButton } from "../components/ServiceCatalogSyncButton";
import { ServiceDialog } from "../components/ServiceDialog";
import { CatalogPanelHeader } from "../components/CatalogPanelHeader";
import { PatientTagPanel } from "../components/PatientTagPanel";
import { SimpleCatalogDialog } from "../components/SimpleCatalogDialog";
import { PaymentAccountPanel } from "../components/PaymentAccountPanel";
import { TaxonomyGroupModal } from "../components/TaxonomyGroupModal";
import { GroupPanel } from "@/components/GroupPanel";
import {
  DEFAULT_TAXONOMY_TAB,
  findTaxonomyTab,
  taxonomyTabs,
  type TaxonomyTab,
} from "../taxonomyTabs";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { PageHeader } from "@/components/PageHeader";
import { PageTabBar } from "@/components/PageTabBar";
import { useAbility, abilityName } from "@/hooks/useAbility";
import { useAuthStore } from "@/features/auth/store/authStore";
import { useTablePagination } from "@/hooks/useTablePagination";
import { countedTotal } from "@/utils/countedTotal";
import { useDebounce } from "@/hooks/useDebounce";
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
  const ability = useAbility(tab.subject);
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
  const [importOpen, setImportOpen] = useState(false);

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
      } catch {
        // queryClient reports the failure; nothing to add here.
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
      } catch {
        // queryClient reports the failure; nothing to add here.
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
        toast.success(t("Taxonomy:Group:DeletedSuccess"));
      } else {
        await deleteEntry.mutateAsync(pendingDelete.id);
        toast.success(t("Common:Deleted"));
      }
    } catch {
      // queryClient reports the failure; nothing to add here.
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
    } catch {
      // queryClient reports the failure; nothing to add here.
    }
  };

  const handleExport = () => {
    const columns: {
      header: string;
      key: keyof CatalogEntryDto;
      format?: (v: unknown) => string;
    }[] = [
      { header: t("Taxonomy:Table:NameCol", tab.noun), key: "name" },
      ...(grouped
        ? ([{ header: t("Taxonomy:Table:ClassificationGroup"), key: "taxonomyName" }] as {
            header: string;
            key: keyof CatalogEntryDto;
          }[])
        : []),
      ...(tab.priced
        ? ([{ header: t("Taxonomy:Table:Price"), key: "price" }] as { header: string; key: keyof CatalogEntryDto }[])
        : []),
      {
        header: t("Taxonomy:Table:LastUpdated"),
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
    <GroupPanel
      title={t("Taxonomy:Group:Title", tab.noun)}
      subtitle={t("Taxonomy:Group:Subtitle", tab.noun)}
      groups={groups}
      isLoading={groupsQuery.isLoading}
      isSearching={
        groupsQuery.isFetching && !groupsQuery.isLoading && !reorderGroupsMutation.isPending
      }
      keyword={groupKeyword}
      onKeywordChange={setGroupKeyword}
      selectedId={selectedGroupId}
      onSelect={selectGroup}
      onCreate={ability.canCreate ? openGroupModalForCreate : undefined}
      onRename={ability.canUpdate ? openGroupModal : undefined}
      onDelete={ability.canDelete ? requestGroupDelete : undefined}
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
            title={t("Taxonomy:Group:Title", tab.noun)}
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
          onCreate={ability.canCreate ? () => void openEntryModal(null) : null}
          onExport={tab.exportable === false || !ability.canExport ? null : handleExport}
          onImport={tab.importable && ability.canCreate ? () => setImportOpen(true) : null}
          createDisabled={isAllBranches || (grouped && groups.length === 0)}
          exportDisabled={entries.length === 0}
          importDisabled={isAllBranches}
          onOpenGroups={grouped ? () => setGroupsOpen(true) : null}
          syncSlot={
            tab.key === "service" ? (
              <ServiceCatalogSyncButton branchId={branchId} disabled={isAllBranches} />
            ) : null
          }
        />

        <div className="bd-cat-body">
          <div className="bd-cat-card">
            <CatalogEntryTable
              entries={entries}
              entityLabel={t("Taxonomy:Table:NameCol", tab.noun)}
              priced={Boolean(tab.priced)}
              showGroupColumn={grouped}
              isLoading={entriesQuery.isFetching && !reorderEntriesMutation.isPending}
              emptyText={
                grouped && groups.length === 0
                  ? t("Taxonomy:Group:NeedAtLeastOne")
                  : debouncedKeyword
                    ? t("Common:NoResults")
                    : t("Common:NoData")
              }
              canReorder={!debouncedKeyword && (!grouped || selectedGroupId !== null)}
              onEdit={ability.canUpdate ? (entry) => setEntryModal({ open: true, entry }) : undefined}
              onDelete={ability.canDelete ? (entry) =>
                setPendingDelete({ kind: "entry", id: entry.id, name: entry.name }) : undefined}
              onReorder={reorderEntries}
              pagination={pagination.buildConfig(totalCount, countedTotal(t("Taxonomy:Common:Records")))}
            />
          </div>
        </div>
      </main>

      {/* The reference gives each catalog its own form, so the screen picks
          the dialog its tab names rather than bending one shared one. */}
      {entryDialog}

      {tab.importable && (
        <CatalogImportDialog
          open={importOpen}
          group={group}
          tabLabel={tab.label}
          noun={tab.noun}
          branchId={branchId}
          onClose={() => setImportOpen(false)}
        />
      )}

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
        noun={pendingDelete?.kind === "group" ? t("Taxonomy:Group:DeleteNoun") : tab.noun}
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
        {tab.pendingNote ?? t("Taxonomy:Page:NoData")}
      </p>
    </div>
  );
}

export function TaxonomyPage() {
  const allTabs = taxonomyTabs();
  const permissions = useAuthStore((s) => s.user?.permissions);
  const grantedSet = useMemo(() => new Set(permissions ?? []), [permissions]);

  const visibleTabs = useMemo(
    () => allTabs.filter((item) => grantedSet.has(abilityName(item.subject, "read"))),
    [allTabs, grantedSet],
  );

  const { section } = useParams();
  const [searchParams] = useSearchParams();
  const tab = findTaxonomyTab(visibleTabs, section ?? searchParams.get("tab") ?? DEFAULT_TAXONOMY_TAB);

  return (
    <div className="bd-shell-page">
      <PageHeader
        title={t("Taxonomy:Page:Title")}
        subtitle={t("Taxonomy:Page:Subtitle")}
      />

      <div className="bd-taxonomy-page">
        <PageTabBar
          label={t("Taxonomy:Page:Title")}
          activeKey={tab.key}
          tabs={visibleTabs.map((item) => ({
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
    </div>
  );
}
