import { useState, type KeyboardEvent } from "react";
import { Button, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { t } from "@/lib/i18n";
import { useFindGuardianCandidates, useGuardianCandidates } from "../../api/patientQueries";
import { GUARDIAN_CANDIDATE_SOURCE, type GuardianCandidate } from "../../types/patient";

interface Props {
  /** The hồ sơ being edited — never offered as its own guardian, nor its own group. */
  excludePatientId?: string;
  onPick: (found: GuardianCandidate) => void;
}

/**
 * Whether rows found for `searched` can stand in for `typed` — a search the
 * text has only grown from, never an older one kept as a placeholder (R-779).
 */
function answers(searched: string | undefined, typed: string) {
  return !!searched && typed.toLowerCase().includes(searched.toLowerCase());
}

const candidateKey = (found: GuardianCandidate) =>
  found.source === GUARDIAN_CANDIDATE_SOURCE.Patient ? `p-${found.patientId}` : `g-${found.nationalId}`;

/** A hồ sơ shows its code; a guardian without one shows whom they already answer for. */
function candidateDetail(found: GuardianCandidate) {
  const whose =
    found.source === GUARDIAN_CANDIDATE_SOURCE.Patient
      ? found.patientCode
      : t("Patient:Guardian:GuardianOf", found.wards.map((w) => w.fullName).join(", "));
  return [found.phone, whose].filter(Boolean).join(" · ");
}

/**
 * "Tìm người giám hộ đã có hồ sơ": a phone or CCCD, then a pick from the
 * matches, Enter, or "Tìm & điền" — each copies that person into the form.
 * The matches are hồ sơ and guardians already declared for other patients, so
 * one phone stays one person (BA 2026-10-07, R-780).
 */
export function GuardianSearch({ excludePatientId, onPick }: Props) {
  const [text, setText] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [finding, setFinding] = useState(false);
  const keyword = text.trim();
  const { data } = useGuardianCandidates(keyword, excludePatientId);
  const findCandidates = useFindGuardianCandidates();

  const suggestions = answers(data?.keyword, keyword) ? (data?.items ?? []) : [];

  const handleChange = (value: string) => {
    setText(value);
    setNotFound(false);
  };

  const pick = (found: GuardianCandidate) => {
    onPick(found);
    handleChange("");
  };

  const handleFind = async () => {
    if (!keyword) return;
    setFinding(true);
    try {
      const { items } = await findCandidates(keyword, excludePatientId);
      if (items[0]) pick(items[0]);
      else setNotFound(true);
    } finally {
      setFinding(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    // Enter here is a search, never the popup's submit.
    event.preventDefault();
    void handleFind();
  };

  return (
    <div className="bd-guardian-search">
      <span className="bd-guardian-search-label">{t("Patient:Guardian:Search")}</span>
      <div className="bd-guardian-search-row">
        <Input
          value={text}
          prefix={<SearchOutlined />}
          placeholder={t("Patient:Guardian:SearchPlaceholder")}
          aria-label={t("Patient:Guardian:Search")}
          allowClear
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <Button
          className="bd-guardian-find"
          loading={finding}
          disabled={!keyword}
          onClick={() => void handleFind()}
        >
          {t("Patient:Guardian:FindAndFill")}
        </Button>
      </div>

      {suggestions.length > 0 && (
        <ul className="bd-guardian-search-results" aria-label={t("Patient:Guardian:Search")}>
          {suggestions.map((found) => (
            <li key={candidateKey(found)}>
              <button type="button" onClick={() => pick(found)}>
                <strong>{found.fullName}</strong>
                <span>{candidateDetail(found)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {notFound && <div className="ant-form-item-explain-error">{t("Patient:Guardian:SearchNotFound")}</div>}
    </div>
  );
}
