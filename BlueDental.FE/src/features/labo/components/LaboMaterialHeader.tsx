import { Button, Input } from "antd";
import { MenuOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import type { LaboMaterialGroupItem } from "../api/laboMaterialGroups";

interface Props {
  group: LaboMaterialGroupItem | undefined;
  keyword: string;
  onKeywordChange: (value: string) => void;
  onOpenGroups: () => void;
  /** Omitted while the account cannot create materials. */
  onCreate?: () => void;
}

/**
 * The right pane's head (BA P1011): the selected group's name with its code,
 * the line that says how the catalog reads on the Phiếu yêu cầu, then the
 * search and Tạo vật liệu.
 */
export function LaboMaterialHeader({ group, keyword, onKeywordChange, onOpenGroups, onCreate }: Props) {
  return (
    <div className="bd-labo-header bd-labo-header--stacked">
      {group && (
        <div className="bd-labo-material-head">
          <h2 className="bd-labo-material-title">
            {group.name}
            <span className="bd-labo-material-groupcode">{group.code}</span>
          </h2>
          <p className="bd-labo-material-hint">{t("Labo:Material:SlipHint")}</p>
        </div>
      )}
      <div className="bd-labo-headrow">
        <div className="bd-labo-headgroup">
          <Button type="link" icon={<MenuOutlined />} className="bd-labo-groupbtn" onClick={onOpenGroups}>
            {t("Common:SelectGroup")}
          </Button>
          <Input
            className="bd-labo-search"
            prefix={<SearchOutlined />}
            placeholder={t("Common:SearchPlaceholder")}
            aria-label={t("Labo:Material:SearchMaterial")}
            value={keyword}
            maxLength={100}
            allowClear
            onChange={(event) => onKeywordChange(event.target.value)}
          />
        </div>
        {onCreate && (
          <Button type="primary" icon={<PlusOutlined />} disabled={!group} onClick={onCreate}>
            {t("Labo:Material:Create")}
          </Button>
        )}
      </div>
    </div>
  );
}
