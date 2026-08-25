import type { ReactNode } from "react";
import { Button, Input } from "antd";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";

interface Props {
  icon: ReactNode;
  title: string;
  subtitle: string;
  actionLabel: string;
  onAction: () => void;
  /** Set while "Tất cả chi nhánh" is selected — a record needs one branch. */
  actionDisabled?: boolean;
  actionDisabledHint?: string;
  /** Omitted on screens the reference gives no search box. */
  search?: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
  };
}

/**
 * Header of the catalog sub-routes that are a single flat table rather than a
 * group panel plus a table — Thẻ hồ sơ and Phương thức thanh toán.
 */
export function FlatScreenHeader({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionDisabledHint,
  search,
}: Props) {
  return (
    <div className="bd-cat-header">
      <div className="bd-cat-headrow">
        <div className="bd-min0">
          <div className="bd-cat-inline2">
            <span className="bd-cat-headicon" aria-hidden="true">
              {icon}
            </span>
            <h1 className="bd-cat-title">{title}</h1>
          </div>
          <p className="bd-cat-sub">{subtitle}</p>
        </div>

        <Button
          type="primary"
          icon={<PlusOutlined />}
          disabled={actionDisabled}
          title={actionDisabled ? actionDisabledHint : undefined}
          onClick={onAction}
        >
          {actionLabel}
        </Button>
      </div>

      {search && (
        <Input
          id={search.id}
          className="bd-cat-search bd-mt3"
          prefix={<SearchOutlined />}
          placeholder={search.label}
          aria-label={search.label}
          value={search.value}
          allowClear
          onChange={(event) => search.onChange(event.target.value)}
        />
      )}
    </div>
  );
}
