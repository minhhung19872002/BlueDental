import { Input, Spin } from "antd";
import { ChevronLeft, FileText, Search, Stethoscope } from "lucide-react";
import { t } from "@/lib/i18n";
import type { ConsultingLibrary } from "./useConsultingLibrary";

interface Props {
  library: ConsultingLibrary;
  /** Full-screen only: the chevron that folds the list away. */
  onCollapse?: () => void;
}

/** The reference tints each topic's file icon by a hash of its id, from a six-colour palette. */
const TOPIC_TONES = 6;
function toneOf(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % TOPIC_TONES;
}

/**
 * "Dữ liệu tư vấn" — the left column of the library: how many topics there
 * are, a search that asks the server, and the topics themselves. The open one
 * sits on a tinted pill.
 */
export function ConsultingTopicAside({ library, onCollapse }: Props) {
  const { topics, topicsLoading, topicSearch, setTopicSearch, topic, selectTopic } = library;

  return (
    <aside className="pd-lib-aside" aria-label={t("Dữ liệu tư vấn")}>
      <div className="pd-lib-aside__head">
        <div className="pd-lib-aside__title">
          <span className="pd-lib-aside__badge">
            <Stethoscope size={20} />
          </span>
          <div className="pd-lib-aside__text">
            <h2>{t("Dữ liệu tư vấn")}</h2>
            <p>{t("{0} nhóm chủ đề", topics.length)}</p>
          </div>
          {onCollapse && (
            <button
              type="button"
              className="pd-lib-icon-btn"
              aria-label={t("Đóng danh mục")}
              title={t("Đóng danh mục")}
              onClick={onCollapse}
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>
        <Input
          className="pd-lib-search"
          aria-label={t("Tìm chủ đề nha khoa")}
          placeholder={t("Tìm chủ đề nha khoa...")}
          prefix={<Search size={16} />}
          value={topicSearch}
          onChange={(event) => setTopicSearch(event.target.value)}
          allowClear
        />
      </div>

      <div className="pd-lib-aside__list">
        {topicsLoading && topics.length === 0 && (
          <div className="pd-lib-aside__loading">
            <Spin size="small" />
          </div>
        )}
        {topics.map((item) => {
          const active = item.id === topic?.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={active ? "page" : undefined}
              className={["pd-lib-topic", active && "pd-lib-topic--active"]
                .filter(Boolean)
                .join(" ")}
              data-tone={toneOf(item.id)}
              onClick={() => selectTopic(item)}
            >
              <FileText size={20} className="pd-lib-topic__icon" />
              <span className="pd-lib-topic__name">{item.name}</span>
            </button>
          );
        })}
        {!topicsLoading && topics.length === 0 && (
          <p className="pd-lib-aside__empty">{t("Không có danh mục.")}</p>
        )}
      </div>
    </aside>
  );
}
