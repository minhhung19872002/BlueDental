import { useEffect, useState } from "react";
import { Button, Input, Tooltip } from "antd";
import { toast } from "sonner";
import { DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  useLaboSupplierCommands,
  useLaboSupplierList,
  type LaboSupplierDto,
} from "../api/laboCatalogApi";
import { LaboSupplierDialog } from "./LaboSupplierDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { DataTable } from "@/components/DataTable";
import { useDebounce } from "@/hooks/useDebounce";
import { useTablePagination } from "@/hooks/useTablePagination";
import { t } from "@/lib/i18n";
import { countedTotal } from "@/utils/countedTotal";
import { formatDate } from "@/utils/format";
import { getAllProvinces, getWardsByProvince, type LocationOption } from "@/utils/vietnamLocations";

/**
 * Nhà cung cấp Labo.
 *
 * The address column reads the way the reference composes it — street, ward,
 * province — from the codes the record stores, so a renamed province is not
 * left as stale text on the row.
 */
export function LaboSupplierScreen() {
  const [keyword, setKeyword] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; supplier: LaboSupplierDto | null }>({
    open: false,
    supplier: null,
  });
  const [pendingDelete, setPendingDelete] = useState<LaboSupplierDto | null>(null);
  const [placeNames, setPlaceNames] = useState<Map<string, string>>(new Map());

  const pagination = useTablePagination(20);
  const debouncedKeyword = useDebounce(keyword, 400);

  const query = useLaboSupplierList({
    filter: debouncedKeyword,
    skipCount: pagination.skipCount,
    maxResultCount: pagination.maxResultCount,
  });
  const { remove } = useLaboSupplierCommands();

  const items = query.data?.items ?? [];
  const totalCount = query.data?.totalCount ?? 0;

  // Only the codes are stored, so the page it is showing decides which names
  // are worth looking up.
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const provinces = await getAllProvinces();
      const names = new Map(provinces.map((p) => [p.code, p.name] as const));

      const wardLists = await Promise.all(
        [...new Set(items.map((s) => s.provinceCode).filter(Boolean))].map((code) =>
          getWardsByProvince(code as string),
        ),
      );

      for (const wards of wardLists as LocationOption[][]) {
        for (const ward of wards) names.set(ward.code, ward.name);
      }

      if (!cancelled) setPlaceNames(names);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const addressOf = (supplier: LaboSupplierDto) =>
    [
      supplier.address,
      supplier.wardCode ? placeNames.get(supplier.wardCode) : null,
      supplier.provinceCode ? placeNames.get(supplier.provinceCode) : null,
    ]
      .filter(Boolean)
      .join(", ");

  const handleSearch = (value: string) => {
    setKeyword(value.slice(0, 100));
    pagination.resetToFirstPage();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await remove.mutateAsync(pendingDelete.id);
      toast.success(t("Đã xoá"));
      setPendingDelete(null);
    } catch {
      // queryClient reports the failure; the dialog stays open to retry.
    }
  };

  const columns: ColumnsType<LaboSupplierDto> = [
    {
      key: "name",
      title: t("Tên labo"),
      render: (_, row) => (
        <div className="bd-min0">
          <p className="bd-cat-name">{row.name}</p>
          {row.contactPerson && <p className="bd-cat-subtle">{row.contactPerson}</p>}
        </div>
      ),
    },
    {
      key: "phone",
      title: t("Số điện thoại"),
      width: 170,
      render: (_, row) => row.phone || <span className="bd-cat-num">—</span>,
    },
    {
      key: "email",
      title: t("Email"),
      width: 240,
      render: (_, row) => row.email || <span className="bd-cat-num">—</span>,
    },
    {
      key: "address",
      title: t("Địa chỉ"),
      width: 320,
      render: (_, row) => addressOf(row) || <span className="bd-cat-num">—</span>,
    },
    {
      key: "updatedAt",
      title: t("Lần cập nhật cuối"),
      width: 180,
      render: (_, row) => (
        <span className="bd-cat-num">
          {formatDate(row.lastModificationTime ?? row.creationTime)}
        </span>
      ),
    },
    {
      key: "actions",
      title: t("Thao tác"),
      width: 100,
      align: "center",
      fixed: "right",
      render: (_, row) => (
        <div className="bd-cat-rowactions">
          <Tooltip title={t("Chỉnh sửa")}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              aria-label={t("Chỉnh sửa {0}", row.name)}
              onClick={() => setDialog({ open: true, supplier: row })}
            />
          </Tooltip>
          <Tooltip title={t("Xoá")}>
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label={t("Xoá {0}", row.name)}
              onClick={() => setPendingDelete(row)}
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="bd-labo-screen">
      <div className="bd-labo-header">
        <Input
          className="bd-labo-search"
          prefix={<SearchOutlined />}
          placeholder={t("Tìm kiếm Labo")}
          aria-label={t("Tìm kiếm Labo")}
          value={keyword}
          maxLength={100}
          allowClear
          onChange={(event) => handleSearch(event.target.value)}
        />

        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setDialog({ open: true, supplier: null })}
        >
          {t("Tạo nhà cung cấp")}
        </Button>
      </div>

      <div className="bd-cat-body">
        <div className="bd-cat-card">
          <DataTable<LaboSupplierDto>
            columns={columns}
            dataSource={items}
            rowKey="id"
            loading={query.isFetching}
            locale={{
              emptyText: debouncedKeyword
                ? t("Không tìm thấy kết quả phù hợp")
                : t("Không tìm thấy nhà cung cấp Labo"),
            }}
            pagination={pagination.buildConfig(totalCount, countedTotal(t("nhà cung cấp")))}
          />
        </div>
      </div>

      <LaboSupplierDialog
        open={dialog.open}
        supplier={dialog.supplier}
        onClose={() => setDialog({ open: false, supplier: null })}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        noun={t("nhà cung cấp")}
        name={pendingDelete?.name ?? ""}
        pending={remove.isPending}
        onConfirm={() => void confirmDelete()}
        onClose={() => setPendingDelete(null)}
      />
    </div>
  );
}
