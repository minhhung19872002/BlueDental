import { useEffect, useState } from "react";
import { Pencil, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useDeletePatientTag, usePatientTags, type PatientTagDto } from "../api/patientTagApi";
import { FlatScreenHeader } from "./FlatScreenHeader";
import { PatientTagModal } from "./PatientTagModal";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Spinner } from "@/components/Spinner";
import { TablePaginationBar } from "@/components/TablePaginationBar";
import { useDebounce } from "@/hooks/useDebounce";
import { extractApiError } from "@/lib/apiError";
import { useBranchFilter, useIsAllBranches } from "@/lib/clinicBranch";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";

const HEAD_CELL =
  "sticky top-0 z-10 h-10 border-b border-app-line bg-app-surface px-4 py-2 text-left align-middle text-[14px] font-medium whitespace-nowrap text-app-label";
const BODY_CELL = "h-14 border-b border-app-line px-4 py-3 align-middle text-[14px] text-app-ink";
const STICKY_END = "sticky right-0 shadow-[-4px_0_6px_-2px_rgba(27,42,65,0.06)]";

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
      toast.success(t("Đã xoá thẻ hồ sơ"));
    } catch (cause) {
      toast.error(extractApiError(cause));
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-app-surface">
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

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-5">
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-app-line bg-white shadow-[0_2px_6px_rgba(27,42,65,0.06)]">
          <div className="relative min-h-0 w-full flex-1 overflow-auto">
            {tagsQuery.isFetching && (
              <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70">
                <Spinner />
              </div>
            )}

            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className={HEAD_CELL}>{t("Tên tag")}</th>
                  <th className={HEAD_CELL}>{t("Màu")}</th>
                  <th className={cn(HEAD_CELL, "z-20 text-center", STICKY_END)}>{t("Thao tác")}</th>
                </tr>
              </thead>

              <tbody className="[&_tr:last-child_td]:border-b-0">
                {tags.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="h-32 border-app-line px-4 py-3 text-center align-middle text-[14px] text-app-label"
                    >
                      {t("Không tìm thấy tag nào")}
                    </td>
                  </tr>
                ) : (
                  tags.map((tag) => (
                    <tr
                      key={tag.id}
                      className="group bg-white transition-colors hover:bg-app-surface"
                    >
                      <td className={BODY_CELL}>
                        <span
                          style={{ backgroundColor: tag.color }}
                          className="inline-flex items-center rounded-md px-3 py-1 text-[12px] font-semibold text-white"
                        >
                          {tag.name}
                        </span>
                      </td>

                      <td className={BODY_CELL}>
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            style={{ backgroundColor: tag.color }}
                            className="size-4 rounded-full border border-app-line"
                          />
                          <span className="tabular-nums text-app-label">
                            {tag.color.toUpperCase()}
                          </span>
                        </span>
                      </td>

                      <td
                        className={cn(
                          BODY_CELL,
                          "z-10 bg-white text-center",
                          STICKY_END,
                          "group-hover:bg-app-surface",
                        )}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            type="button"
                            aria-label={t("Chỉnh sửa {0}", tag.name)}
                            onClick={() => setModal({ open: true, tag })}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-app-label outline-none transition-colors duration-150 hover:bg-app-surface hover:text-app-ink focus-visible:ring-2 focus-visible:ring-app-primary/40"
                          >
                            <Pencil className="size-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("Xoá {0}", tag.name)}
                            onClick={() => setPendingDelete(tag)}
                            className="flex size-7 cursor-pointer items-center justify-center rounded-md text-app-danger outline-none transition-colors duration-150 hover:bg-app-danger/10 focus-visible:ring-2 focus-visible:ring-app-danger/40"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
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
