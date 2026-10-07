import { useState, type KeyboardEvent } from "react";
import { Button, Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { usePatientPicker } from "@/hooks/usePatientOptions";
import { t } from "@/lib/i18n";
import { useFindPatients } from "../../api/patientQueries";

interface Props {
  /** The hồ sơ being edited — a patient is never their own guardian. */
  excludePatientId?: string;
  onPick: (patientId: string) => void;
}

const MAX_SUGGESTIONS = 5;

/**
 * "Tìm người giám hộ đã có hồ sơ": a phone or CCCD, then a pick from the
 * matches, Enter, or "Tìm & điền" — each copies that hồ sơ into the form.
 */
export function GuardianSearch({ excludePatientId, onPick }: Props) {
  const [text, setText] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [finding, setFinding] = useState(false);
  const { patients, search } = usePatientPicker(undefined);
  const findPatients = useFindPatients();

  const keyword = text.trim();
  const suggestions = keyword
    ? patients.filter((p) => p.id !== excludePatientId).slice(0, MAX_SUGGESTIONS)
    : [];

  const handleChange = (value: string) => {
    setText(value);
    setNotFound(false);
    search(value.trim());
  };

  const pick = (patientId: string) => {
    onPick(patientId);
    handleChange("");
  };

  const handleFind = async () => {
    if (!keyword) return;
    setFinding(true);
    try {
      const page = await findPatients(keyword);
      const match = page.items.find((p) => p.id !== excludePatientId);
      if (match) pick(match.id);
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
          {suggestions.map((patient) => (
            <li key={patient.id}>
              <button type="button" onClick={() => pick(patient.id)}>
                <strong>{patient.name}</strong>
                <span>{[patient.phone, patient.code].filter(Boolean).join(" · ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {notFound && <div className="ant-form-item-explain-error">{t("Patient:Guardian:SearchNotFound")}</div>}
    </div>
  );
}
