import { Button, Drawer } from "antd";
import { SaveOutlined, SlidersOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";

interface MobileFilterDrawerProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  children: React.ReactNode;
}

export function MobileFilterDrawer({
  open,
  onOpen,
  onClose,
  onClear,
  onApply,
  children,
}: MobileFilterDrawerProps) {
  const handleApply = () => {
    onApply();
    onClose();
  };

  return (
    <>
      <button
        type="button"
        className="mobile-filter-trigger"
        onClick={onOpen}
      >
        <SlidersOutlined />
        <span>{t("Bộ lọc")}</span>
      </button>

      <Drawer
        open={open}
        onClose={onClose}
        placement="bottom"
        height="50vh"
        closable
        title={t("Bộ lọc")}
        className="mobile-filter-drawer"
        styles={{
          wrapper: { borderRadius: "16px 16px 0 0", overflow: "hidden" },
          content: { borderRadius: "16px 16px 0 0" },
          body: { padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 24 },
          header: { padding: "12px 16px", borderBottom: "1px solid #DCE3EE" },
          footer: { padding: "12px 16px", borderTop: "1px solid #DCE3EE" },
        }}
        footer={
          <div className="mobile-filter-footer">
            <button
              type="button"
              className="mobile-filter-clear"
              onClick={onClear}
            >
              {t("Xóa bộ lọc")}
            </button>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleApply}>
              {t("Lưu")}
            </Button>
          </div>
        }
      >
        {children}
      </Drawer>
    </>
  );
}
