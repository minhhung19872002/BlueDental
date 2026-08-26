import { Button, Tooltip } from "antd";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { DeleteOutlined, EditOutlined, TagOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useDeletePatientTag, usePatientTags, type PatientTagDto } from "../api/patientTagApi";
import { FlatScreenHeader } from "./FlatScreenHeader";
import { countedTotal } from "../countedTotal";
import { PatientTagModal } from "./PatientTagModal";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { useBranchFilter, useIsAllBranches } from "@/lib/clinicBranch";
import { t } from "@/lib/i18n";

const DEFAULT_PAGE_SIZE = 20;

/** Danh mục / Thẻ hồ sơ — one flat table of coloured record labels. */
export function PatientTagPanel() {
  /** The list follows the header's branch; a record needs one concrete branch. */
  const branchFilter = useBranchFilter();
  const isAllBranches = useIsAllBranches();

  const pagination = useTablePagination(DEFAULT_PAGE_SIZE);
  const [keyword, setKeyword] = useState("");
  const [modal, setModal] = useState<{ open: boolean; tag: PatientTagDto | null }>({
    open: false,
    tag: null,
  });
  const [pendingDelete, setPendingDelete] = useState<PatientTagDto | null>(null);

  const debouncedKeyword = useDebounce(keyword, 300);
  const tagsQuery = usePatientTags(branchFilter, {
    filter: debouncedKeyword,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const deleteTag = useDeletePatientTag();

  const tags = tagsQuery.data?.items ?? [];
  const totalCount = tagsQuery.data?.totalCount ?? 0;

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteTag.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá thẻ hồ sơ"));
    } catch {
      // queryClient reports the failure; nothing to add here.
    } finally {
      setPendingDelete(null);
    }
  };

  const columns = useMemo<ColumnsType<PatientTagDto>>(
    () => [
      {
        key: "name",
        title: t("Tên tag"),
        render: (_, tag) => (
          <span className="bd-tag-chip" style={{ backgroundColor: tag.color }}>
            {tag.name}
          </span>
        ),
      },
      {
        key: "color",
        title: t("Màu"),
        width: 200,
        render: (_, tag) => (
          <span className="bd-cat-inline2">
            <span
              aria-hidden="true"
              className="bd-tag-dot"
              style={{ backgroundColor: tag.color }}
            />
            <span className="bd-cat-num">{tag.color.toUpperCase()}</span>
          </span>
        ),
      },
      {
        key: "actions",
        title: t("Thao tác"),
        width: 110,
        align: "center",
        fixed: "right",
        render: (_, tag) => (
          <div className="bd-cat-rowactions">
            <Tooltip title={t("Chỉnh sửa")}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                aria-label={t("Chỉnh sửa {0}", tag.name)}
                onClick={() => setModal({ open: true, tag })}
              />
            </Tooltip>
            <Tooltip title={t("Xoá")}>
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label={t("Xoá {0}", tag.name)}
                onClick={() => setPendingDelete(tag)}
              />
            </Tooltip>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="bd-cat-screen">
      <FlatScreenHeader
        icon={<TagOutlined />}
        title={t("Quản lý Thẻ hồ sơ")}
        subtitle={t("Tạo và quản lý danh mục thẻ hồ sơ.")}
        actionLabel={t("Thêm tag")}
        onAction={() => setModal({ open: true, tag: null })}
        actionDisabled={isAllBranches}
        actionDisabledHint={t("Chọn một chi nhánh cụ thể trước khi thêm")}
        search={{
          id: "patient-tag-search",
          label: t("Tìm tag theo tên hoặc mã màu..."),
          value: keyword,
          onChange: (value) => {
            setKeyword(value);
            pagination.resetToFirstPage();
          },
        }}
      />

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<PatientTagDto>
            columns={columns}
            dataSource={tags}
            rowKey="id"
            loading={tagsQuery.isFetching}
            pagination={pagination.buildConfig(totalCount, countedTotal(t("thẻ hồ sơ")))}
            locale={{ emptyText: t("Không tìm thấy tag nào") }}
          />
        </div>
      </div>

      <PatientTagModal
        open={modal.open}
        tag={modal.tag}
        onClose={() => setModal({ open: false, tag: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("thẻ hồ sơ")}
        name={pendingDelete?.name ?? ""}
        pending={deleteTag.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
