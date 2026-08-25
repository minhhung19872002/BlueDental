import { Spin, message } from "antd";
import { useEffect, useState } from "react";
import { Pencil, Tag, Trash2 } from "lucide-react";
import { useDeletePatientTag, usePatientTags, type PatientTagDto } from "../api/patientTagApi";
import { FlatScreenHeader } from "./FlatScreenHeader";
import { PatientTagModal } from "./PatientTagModal";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { TablePaginationBar } from "@/components/TablePaginationBar";
import { useDebounce } from "@/hooks/useDebounce";
import { extractApiError } from "@/lib/apiError";
import { useBranchFilter, useIsAllBranches } from "@/lib/clinicBranch";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

const HEAD_CELL =
  "bd-cat-th";
const BODY_CELL = "bd-cat-td";
const STICKY_END = "bd-cat-sticky";

const DEFAULT_PAGE_SIZE = 20;

/** Danh mục / Thẻ hồ sơ — one flat table of coloured record labels. */
export function PatientTagPanel() {
  /** The list follows the header's branch; a record needs one concrete branch. */
  const branchFilter = useBranchFilter();
  const isAllBranches = useIsAllBranches();

  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [modal, setModal] = useState<{ open: boolean; tag: PatientTagDto | null }>({
    open: false,
    tag: null,
  });
  const [pendingDelete, setPendingDelete] = useState<PatientTagDto | null>(null);

  const debouncedKeyword = useDebounce(keyword, 300);
  const tagsQuery = usePatientTags(branchFilter, {
    filter: debouncedKeyword,
    skipCount: (page - 1) * pageSize,
    maxResultCount: pageSize,
  });
  const deleteTag = useDeletePatientTag();

  const tags = tagsQuery.data?.items ?? [];
  const totalCount = tagsQuery.data?.totalCount ?? 0;

  /** A narrower result set can leave the current page past the end of the data. */
  useEffect(() => {
    const lastPage = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > lastPage) setPage(lastPage);
  }, [page, pageSize, totalCount]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteTag.mutateAsync(pendingDelete.id);
      message.success(t("Đã xoá thẻ hồ sơ"));
    } catch (cause) {
      message.error(extractApiError(cause));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="bd-cat-screen">
      <FlatScreenHeader
        icon={Tag}
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
            setPage(1);
          },
        }}
      />

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <div className="bd-cat-scroll">
            {tagsQuery.isFetching && (
              <div className="bd-cat-busy">
                <Spin size="large" />
              </div>
            )}

            <table className="bd-cat-table">
              <thead>
                <tr>
                  <th className={HEAD_CELL}>{t("Tên tag")}</th>
                  <th className={HEAD_CELL}>{t("Màu")}</th>
                  <th className={cn(HEAD_CELL, "bd-z20 bd-text-center", STICKY_END)}>{t("Thao tác")}</th>
                </tr>
              </thead>

              <tbody className="bd-cat-tbody">
                {tags.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="bd-cat-emptycell"
                    >
                      {t("Không tìm thấy tag nào")}
                    </td>
                  </tr>
                ) : (
                  tags.map((tag) => (
                    <tr
                      key={tag.id}
                      className="bd-cat-row"
                    >
                      <td className={BODY_CELL}>
                        <span
                          style={{ backgroundColor: tag.color }}
                          className="bd-tag-chip"
                        >
                          {tag.name}
                        </span>
                      </td>

                      <td className={BODY_CELL}>
                        <span className="bd-cat-inline2">
                          <span
                            aria-hidden="true"
                            style={{ backgroundColor: tag.color }}
                            className="bd-tag-dot"
                          />
                          <span className="bd-cat-num">
                            {tag.color.toUpperCase()}
                          </span>
                        </span>
                      </td>

                      <td
                        className={cn(
                          BODY_CELL,
                          "bd-cat-td--actions",
                          STICKY_END,
                        )}
                      >
                        <div className="bd-cat-rowactions">
                          <button
                            type="button"
                            aria-label={t("Chỉnh sửa {0}", tag.name)}
                            onClick={() => setModal({ open: true, tag })}
                            className="bd-cat-iconbtn"
                          >
                            <Pencil className="bd-icon bd-icon--sm" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("Xoá {0}", tag.name)}
                            onClick={() => setPendingDelete(tag)}
                            className="bd-cat-iconbtn bd-cat-iconbtn--danger"
                          >
                            <Trash2 className="bd-icon bd-icon--sm" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <TablePaginationBar
            page={page}
            pageSize={pageSize}
            total={totalCount}
            unitLabel={t("thẻ hồ sơ")}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
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
