import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { t } from "@/lib/i18n";
import { useAbility } from "@/hooks/useAbility";
import { PageHeader } from "@/components/PageHeader";
import { PageTabBar } from "@/components/PageTabBar";
import { cn } from "@/lib/cn";
import { CallAssignView } from "../components/CallAssignView";
import { CallConfigView } from "../components/CallConfigView";
import { CallListView } from "../components/CallListView";
import { InvoiceConfigView } from "../components/InvoiceConfigView";
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

interface ToolAbilityProps {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

/**
 * Gọi thoại. The reference keeps the open sub-tab in `?subTab=` — absent for
 * Cấu Hình, `assign` and `history` for the other two — so this does the same:
 * bookmarkable, and the back button walks the tabs.
 */
function CallView({ canCreate, canUpdate, canDelete }: ToolAbilityProps) {
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
    <div className="bd-tools-card">
      <SubTabBar
        tabs={[
          { key: "config", label: t("Cấu Hình") },
          { key: "assign", label: t("Phân Công Gọi") },
          { key: "history", label: t("Danh Sách Cuộc Gọi") },
        ]}
        active={sub}
        onChange={changeSub}
      />
      {sub === "assign" ? (
        <CallAssignView canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />
      ) : sub === "history" ? (
        <CallListView />
      ) : (
        <CallConfigView canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />
      )}
    </div>
  );
}

function MessageView({ canCreate, canUpdate, canDelete }: ToolAbilityProps) {
  const [sub, setSub] = useState("config");

  return (
    <div className="bd-tools-card">
      <SubTabBar
        tabs={[
          { key: "config", label: t("Cấu Hình") },
          { key: "template", label: t("Mẫu Tin Nhắn") },
          { key: "list", label: t("Danh Sách Tin Nhắn") },
        ]}
        active={sub}
        onChange={setSub}
      />
      {sub === "config" && (
        <MessageConfigView canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />
      )}
      {sub === "template" && (
        <MessageTemplateView
          channel={0}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      )}
      {sub === "list" && <MessageLogView channel={0} />}
    </div>
  );
}

function ZaloView({ canCreate, canUpdate, canDelete }: ToolAbilityProps) {
  const [sub, setSub] = useState("config");

  return (
    <div className="bd-tools-card">
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
      {sub === "templates" && (
        <MessageTemplateView
          channel={1}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
        />
      )}
      {sub === "list" && <MessageLogView channel={1} />}
    </div>
  );
}

function InvoiceView() {
  return (
    <div className="bd-tools-card">
      <SubTabBar
        tabs={[{ key: "config", label: t("Cấu Hình") }]}
        active="config"
        onChange={() => {}}
      />
      <InvoiceConfigView />
    </div>
  );
}

export function ToolsPage() {
  const { category: categoryParam } = useParams<{ category?: string }>();

  const callAbility = useAbility("toolCall");
  const messageAbility = useAbility("toolMessage");

  const ALL_TABS: { key: ToolCategory; label: () => string; visible: boolean }[] = [
    { key: "call", label: () => t("Gọi thoại"), visible: callAbility.canRead },
    { key: "message", label: () => t("Tin nhắn"), visible: messageAbility.canRead },
    { key: "zalo-oa", label: () => t("Zalo OA"), visible: true },
    { key: "invoice", label: () => t("Hóa đơn"), visible: true },
  ];

  const visibleTabs = useMemo(
    () => ALL_TABS.filter((t) => t.visible),
    [callAbility.canRead, messageAbility.canRead],
  );

  const rawCategory = findCategory(categoryParam);
  const category = visibleTabs.some((t) => t.key === rawCategory)
    ? rawCategory
    : visibleTabs[0]?.key ?? "call";

  return (
    <div className="reception-page">
      <PageHeader
        title={t("Công cụ")}
        subtitle={t("Tổng đài, tin nhắn, Zalo OA và hoá đơn điện tử")}
      />

      <div className="bd-tools-shell">
        <PageTabBar
          label={t("Công cụ")}
          activeKey={category}
          tabs={visibleTabs.map((t) => ({ key: t.key, label: t.label(), to: `/tools/${t.key}` }))}
        />

        {category === "call" && (
          <CallView
            canCreate={callAbility.canCreate}
            canUpdate={callAbility.canUpdate}
            canDelete={callAbility.canDelete}
          />
        )}
        {category === "message" && (
          <MessageView
            canCreate={messageAbility.canCreate}
            canUpdate={messageAbility.canUpdate}
            canDelete={messageAbility.canDelete}
          />
        )}
        {category === "zalo-oa" && (
          <ZaloView
            canCreate={messageAbility.canCreate}
            canUpdate={messageAbility.canUpdate}
            canDelete={messageAbility.canDelete}
          />
        )}
        {category === "invoice" && <InvoiceView />}
      </div>
    </div>
  );
}
