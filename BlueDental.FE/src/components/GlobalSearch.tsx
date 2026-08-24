import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Heart, IdCard, Search, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePatientList } from "@/features/patient-management/api/patientQueries";
import { useDebounce } from "@/hooks/useDebounce";
import { brand } from "@/theme/index";
import { t } from "@/lib/i18n";

const searchCategories = () => [
  {
    icon: <User size={18} color={brand.muted} />,
    title: t("Khách hàng"),
    desc: t("Tìm theo tên, mã KH, số điện thoại"),
  },
  {
    icon: <Calendar size={18} color={brand.muted} />,
    title: t("Lịch hẹn"),
    desc: t("Tìm theo tên hoặc SĐT khách hàng"),
  },
  {
    icon: <Heart size={18} color={brand.muted} />,
    title: t("CSKH"),
    desc: t("Tìm theo khách hàng, nội dung"),
  },
  {
    icon: <IdCard size={18} color={brand.muted} />,
    title: t("Nhân viên"),
    desc: t("Tìm theo tên, email, số điện thoại"),
  },
];

const MIN_QUERY = 2;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const enabled = debounced.trim().length >= MIN_QUERY;
  const { data, isFetching } = usePatientList({
    keyword: enabled ? debounced.trim() : undefined,
    maxResultCount: 8,
  });

  const hits = enabled ? (data?.items ?? []) : [];

  const openPatient = (id: string) => {
    onClose();
    navigate(`/patient/${id}`);
  };

  if (!open) return null;

  return (
    <div className="app-search-overlay" onClick={onClose}>
      <div className="app-search-modal" onClick={(event) => event.stopPropagation()}>
        <div className="app-search-input-row">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
            <Input
              autoFocus
              className="h-11 rounded-xl pl-10 text-base"
              placeholder={t("Tìm kiếm khách hàng, lịch hẹn, nhân viên…")}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && hits.length > 0) openPatient(hits[0].id);
              }}
            />
          </div>
          <kbd className="app-search-esc" onClick={onClose}>
            Esc
          </kbd>
        </div>

        {enabled ? (
          <div className="app-search-results">
            {isFetching && hits.length === 0 ? (
              <div className="app-search-loading">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : hits.length === 0 ? (
              <div className="app-search-hint">
                {t("Không tìm thấy kết quả cho “{0}”", debounced.trim())}
              </div>
            ) : (
              hits.map((hit) => (
                <div
                  key={hit.id}
                  role="button"
                  tabIndex={0}
                  className="app-search-hit"
                  onClick={() => openPatient(hit.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openPatient(hit.id);
                    }
                  }}
                >
                  <span className="app-search-hit-badge">BN</span>
                  <span className="app-search-hit-text">
                    <span className="app-search-hit-name">{hit.fullName}</span>
                    <span className="app-search-hit-meta">
                      {[hit.code, hit.phone, hit.serviceName].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="app-search-hit-arrow">→</span>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="app-search-categories">
            <div className="app-search-categories-title">{t("Gợi ý tìm kiếm")}</div>
            {searchCategories().map((cat) => (
              <div key={cat.title} className="app-search-category-item">
                <span className="app-search-category-icon">{cat.icon}</span>
                <div className="app-search-category-text">
                  <span className="app-search-category-name">{cat.title}</span>
                  <span className="app-search-category-desc">{cat.desc}</span>
                </div>
              </div>
            ))}
            <div className="app-search-hint">{t("Nhập ít nhất 2 ký tự để tìm kiếm.")}</div>
          </div>
        )}
      </div>
    </div>
  );
}
