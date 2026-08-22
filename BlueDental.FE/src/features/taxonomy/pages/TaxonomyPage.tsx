import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Empty, Input, Modal, Popconfirm, Table, Tabs, Tag, message } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
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

const TAXONOMY_TABS: TaxonomyTab[] = [
  { key: "service", label: "Dịch vụ", group: TAXONOMY_GROUP.CareService, entityLabel: "Tên dịch vụ", priced: true },
  { key: "diagnosis", label: "Chẩn đoán", group: TAXONOMY_GROUP.Diagnosis, entityLabel: "Tên chẩn đoán" },
  { key: "medicine", label: "Loại thuốc", group: TAXONOMY_GROUP.MedicationType, entityLabel: "Tên loại thuốc", priced: true },
  { key: "consulting", label: "Dữ liệu tư vấn", group: TAXONOMY_GROUP.ConsultingData, entityLabel: "Tên dữ liệu tư vấn" },
  { key: "source", label: "Nguồn đến", group: TAXONOMY_GROUP.Source, entityLabel: "Tên nguồn đến" },
  { key: "history", label: "Lịch sử bệnh", group: TAXONOMY_GROUP.DiseaseHistory, entityLabel: "Tên lịch sử bệnh" },
  { key: "prescription-template", label: "Đơn thuốc mẫu", group: TAXONOMY_GROUP.PrescriptionTemplate, entityLabel: "Tên đơn thuốc mẫu", templated: true },
  { key: "medical-record-template", label: "Bệnh án mẫu", group: TAXONOMY_GROUP.MedicalRecordTemplate, entityLabel: "Tên bệnh án mẫu", templated: true },
  { key: "tags", label: "Thẻ hồ sơ", group: null, entityLabel: "Tên thẻ", pendingNote: "Thẻ hồ sơ dùng danh mục riêng ở app gốc (medical-record/tag) — chưa dựng ở BlueDental." },
  { key: "payment-method", label: "Phương thức thanh toán", group: null, entityLabel: "Phương thức", pendingNote: "Phương thức thanh toán ở app gốc là tài khoản MoMo/ngân hàng, không phải danh mục — chưa dựng ở BlueDental." },
  { key: "occupation", label: "Nghề nghiệp", group: TAXONOMY_GROUP.Occupation, entityLabel: "Tên nghề nghiệp" },
];

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
        Nhóm phân loại
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 8 }}>
        {isLoading ? "Đang tải…" : `${groups.length} nhóm`}
      </div>

      <Input
        prefix={<SearchOutlined />}
        placeholder="Tìm nhóm..."
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        allowClear
        style={{ marginBottom: 8 }}
      />

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
        Tất cả nhóm
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

      <Button block icon={<PlusOutlined />} onClick={onAdd} style={{ marginTop: 8 }}>
        Thêm nhóm
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

  // Selecting a group that then disappears (deleted elsewhere) would show an
  // empty table with no way back, so fall back to "all groups" — but only once
  // the list has settled, otherwise this races a freshly created group whose
  // refetch is still in flight and clears the selection we just made.
  useEffect(() => {
    if (groupsFetching) return;

    if (selectedGroupId && !groups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(null);
    }
  }, [groups, groupsFetching, selectedGroupId]);

  const currentGroup = groups.find((g) => g.id === selectedGroupId);

  const columns: ColumnsType<CatalogEntryDto> = [
    { title: tab.entityLabel, dataIndex: "name", key: "name" },
    {
      title: "Nhóm phân loại",
      dataIndex: "taxonomyName",
      key: "taxonomyName",
      width: 200,
      render: (value: string | null) => value ?? "—",
    },
    ...(tab.priced
      ? [{
          title: "Giá",
          dataIndex: "price",
          key: "price",
          width: 140,
          align: "right" as const,
          render: (value: number | null) => (value == null ? "—" : `${formatVND(value)} đ`),
        }]
      : []),
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 120,
      render: (isActive: boolean) =>
        isActive ? <Tag color="green">Đang dùng</Tag> : <Tag>Ngừng dùng</Tag>,
    },
    {
      title: "Cập nhật gần nhất",
      dataIndex: "lastModificationTime",
      key: "lastModificationTime",
      width: 150,
      render: (value: string | null, row) => formatDate(value ?? row.creationTime),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 140,
      render: (_, row) => (
        <>
          <Button type="link" size="small" onClick={() => { setEditing(row); setEntryModalOpen(true); }}>
            Sửa
          </Button>
          <Popconfirm
            title="Xoá mục này?"
            okText="Xoá"
            cancelText="Huỷ"
            onConfirm={async () => {
              try {
                await deleteEntry.mutateAsync(row.id);
                message.success("Đã xoá");
              } catch (error) {
                message.error(extractApiError(error));
              }
            }}
          >
            <Button type="link" size="small" danger>Xoá</Button>
          </Popconfirm>
        </>
      ),
    },
  ];

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    try {
      const created = await createGroup.mutateAsync({
        clinicBranchId: branchId,
        group,
        name: newGroupName.trim(),
      });
      // Select the new group so the next "Thêm mục" lands where the user just
      // created it, instead of falling back to the first group in the list.
      setSelectedGroupId(created.id);
      message.success("Đã thêm nhóm");
      setGroupModalOpen(false);
      setNewGroupName("");
    } catch (error) {
      message.error(extractApiError(error));
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
              {entryPage?.totalCount ?? 0} bản ghi
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#5A6B82", marginBottom: 10 }}>
            {currentGroup
              ? `Quản lý các mục thuộc nhóm ${currentGroup.name}`
              : `Tất cả mục của danh mục ${tab.label.toLowerCase()}`}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={groups.length === 0}
              onClick={() => { setEditing(null); setEntryModalOpen(true); }}
            >
              Thêm {tab.label.toLowerCase()}
            </Button>
            <Input
              prefix={<SearchOutlined />}
              placeholder={`Tìm theo ${tab.entityLabel.toLowerCase()}...`}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              style={{ width: 260 }}
              allowClear
            />
          </div>

          {groups.length === 0 && !groupsLoading && (
            <div style={{ fontSize: 12, color: "#B45309", marginTop: 8 }}>
              Cần tạo ít nhất một nhóm phân loại trước khi thêm mục.
            </div>
          )}
        </div>

        <Table<CatalogEntryDto>
          rowKey="id"
          loading={entriesLoading}
          dataSource={entryPage?.items ?? []}
          columns={columns}
          size="middle"
          locale={{
            emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có dữ liệu" />,
          }}
          pagination={{
            pageSize: 20,
            showTotal: (total, range) => `Hiển thị ${range[0]}–${range[1]} trên ${total} bản ghi`,
          }}
        />
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

      <Modal
        open={groupModalOpen}
        title="Thêm nhóm phân loại"
        okText="Thêm"
        cancelText="Huỷ"
        confirmLoading={createGroup.isPending}
        onOk={handleCreateGroup}
        onCancel={() => { setGroupModalOpen(false); setNewGroupName(""); }}
      >
        <Input
          placeholder="Tên nhóm"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onPressEnter={handleCreateGroup}
        />
      </Modal>
    </div>
  );
}

export function TaxonomyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "service";
  const tab = TAXONOMY_TABS.find((t) => t.key === activeTab) ?? TAXONOMY_TABS[0];

  return (
    <div className="reception-page">
      <div className="reception-card reception-card--toolbar">
        <Tabs
          activeKey={tab.key}
          onChange={(key) => setSearchParams((p) => { p.set("tab", key); return p; })}
          style={{ marginBottom: 0 }}
          items={TAXONOMY_TABS.map((t) => ({ key: t.key, label: t.label }))}
        />
      </div>

      <div className="reception-card reception-card--content">
        {tab.group ? (
          <CatalogPanel key={tab.key} tab={tab} />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={tab.pendingNote ?? "Chưa có dữ liệu"}
          />
        )}
      </div>
    </div>
  );
}
