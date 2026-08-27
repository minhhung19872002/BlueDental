import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { t } from "@/lib/i18n";
import { PageHeader } from "@/components/PageHeader";
import { PageTabBar } from "@/components/PageTabBar";
import { cn } from "@/lib/cn";
import { CallAssignView } from "../components/CallAssignView";
import { CallConfigView } from "../components/CallConfigView";
import { CallListView } from "../components/CallListView";
import { ConfigNotAvailable } from "../components/ConfigNotAvailable";
import { MessageConfigView } from "../components/MessageConfigView";
import { MessageLogView } from "../components/MessageLogView";
import { MessageTemplateView } from "../components/MessageTemplateView";
import { ZaloConfigView } from "../components/ZaloConfigView";
import "../components/tools.css";

// ── Categories: each is its own URL, as the reference has it ───────────────

type ToolCategory = "call" | "message" | "zalo-oa" | "invoice";

const TOOL_CATEGORIES: ToolCategory[] = ["call", "message", "zalo-oa", "invoice"];

function findCategory(slug: string | undefined): ToolCategory {
  return TOOL_CATEGORIES.find((c) => c === slug) ?? "call";
}

// ── Sub-tab pills, driven by the reference's own ?subTab= parameter ────────

function SubTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="pill-tabs bd-tools-subtabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === active}
          className={cn("pill-tab", tab.key === active && "pill-tab--active")}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Gọi thoại. The reference keeps the open sub-tab in `?subTab=` — absent for
 * Cấu Hình, `assign` and `history` for the other two — so this does the same:
 * bookmarkable, and the back button walks the tabs.
 */
function CallView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sub = searchParams.get("subTab") ?? "config";

  const changeSub = (key: string) => {
    setSearchParams((params) => {
      if (key === "config") params.delete("subTab");
      else params.set("subTab", key);
      return params;
    });
  };

  return (
    <>
      <SubTabBar
        tabs={[
          { key: "config", label: t("Cấu Hình") },
          { key: "assign", label: t("Phân Công Gọi") },
          { key: "history", label: t("Danh Sách Cuộc Gọi") },
        ]}
        active={sub}
        onChange={changeSub}
      />
      {sub === "assign" ? <CallAssignView /> : sub === "history" ? <CallListView /> : <CallConfigView />}
    </>
  );
}

function MessageView() {
  const [sub, setSub] = useState("config");

  return (
    <>
      <SubTabBar
        tabs={[
          { key: "config", label: t("Cấu Hình") },
          { key: "template", label: t("Mẫu Tin Nhắn") },
          { key: "list", label: t("Danh Sách Tin Nhắn") },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === "config" && <MessageConfigView />}
      {sub === "template" && <MessageTemplateView channel={0} />}
      {sub === "list" && <MessageLogView channel={0} />}
    </>
  );
}

function ZaloView() {
  const [sub, setSub] = useState("config");

  return (
    <>
      <SubTabBar
        tabs={[
          { key: "config", label: t("Cấu Hình") },
          { key: "templates", label: t("Mẫu ZBS") },
          { key: "list", label: t("Danh sách tin Zalo") },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === "config" && <ZaloConfigView />}
      {sub === "templates" && <MessageTemplateView channel={1} />}
      {sub === "list" && <MessageLogView channel={1} />}
    </>
  );
}

export function ToolsPage() {
  const { category: categoryParam } = useParams<{ category?: string }>();
  const category = findCategory(categoryParam);

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Công cụ")}
        subtitle={t("Gọi thoại, tin nhắn, Zalo OA và hoá đơn điện tử")}
      />

      <PageTabBar
        label={t("Công cụ")}
        activeKey={category}
        tabs={[
          { key: "call", label: t("Gọi thoại"), to: "/tools/call" },
          { key: "message", label: t("Tin nhắn"), to: "/tools/message" },
          { key: "zalo-oa", label: t("Zalo OA"), to: "/tools/zalo-oa" },
          { key: "invoice", label: t("Hóa đơn"), to: "/tools/invoice" },
        ]}
      />

      {category === "call" && <CallView />}
      {category === "message" && <MessageView />}
      {category === "zalo-oa" && <ZaloView />}
      {category === "invoice" && <ConfigNotAvailable what={t("hoá đơn điện tử")} />}
    </div>
  );
}
