// RowActions — dropdown menu for table row actions (edit, delete, view).

import { Dropdown, Button, type MenuProps } from "antd";
import { MoreOutlined } from "@ant-design/icons";

interface Action {
  key: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

interface Props {
  actions: Action[];
}

export function RowActions({ actions }: Props) {
  const items: MenuProps["items"] = actions.map((action) => ({
    key: action.key,
    label: action.label,
    danger: action.danger,
    onClick: action.onClick,
  }));

  return (
    <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
      <Button
        type="text"
        icon={<MoreOutlined />}
        onClick={(e) => e.stopPropagation()}
        size="small"
      />
    </Dropdown>
  );
}
