import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { t, tRich } from "@/lib/i18n";
import { DiagnosisDoctorCard } from "./DiagnosisDoctorCard";
import { htmlToPlainText, type DiagnosisGroup } from "./quoteModel";

interface Props {
  /** "II", "III" … — the section number, continuing after the image block. */
  numeral: string;
  group: DiagnosisGroup;
  customerName: string;
  onChangeExplanation: (key: string, html: string) => void;
}

/**
 * "<N>. CHẨN ĐOÁN & TƯ VẤN ĐIỀU TRỊ - <DIAGNOSIS>" — one diagnosis, its
 * doctors' explanations, and the standing advice line.
 */
export function DiagnosisGroupBlock({ numeral, group, customerName, onChangeExplanation }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = group.doctors.map((item) => htmlToPlainText(item.explanationHtml)).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section>
      <div className="pq-dx__section">
        <h2>
          {numeral}. {t("CHẨN ĐOÁN & TƯ VẤN ĐIỀU TRỊ")} - {group.name.toUpperCase()}
        </h2>
        <span className="pq-dx__section-tools">
          <span className="pq-dx__pill">{t("{0} dịch vụ đang chọn", group.services.length)}</span>
          <button
            type="button"
            className="pq-dx__mini pq-print-hidden"
            onClick={() => void handleCopy()}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? t("Đã sao chép") : t("Sao chép")}
          </button>
        </span>
      </div>
      <div className="pq-dx__advice">
        <p className="pq-dx__lead">
          {tRich(
            "Cùng với việc thăm khám lâm sàng và phim chụp của bệnh nhân {0}, bác sĩ đưa ra chẩn đoán và giải thích chi tiết:",
            <b key="name">{customerName}</b>,
          )}
        </p>
        {group.doctors.map((item) => (
          <DiagnosisDoctorCard
            key={item.key}
            item={item}
            onChange={(html) => onChangeExplanation(item.key, html)}
          />
        ))}
        <p className="pq-dx__remark">
          {t(
            "* Lời dặn của Bác sĩ: Quý khách vui lòng tuân thủ hướng dẫn vệ sinh răng miệng và liên hệ hotline phòng khám khi có bất kỳ thắc mắc nào.",
          )}
        </p>
      </div>
      <p className="pq-dx__note">{t("Ghi chú: {0}", "-")}</p>
    </section>
  );
}
