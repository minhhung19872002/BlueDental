import { t } from "@/lib/i18n";
import { stageHeader, type StageFileProblem, type StageRowProblem, type StageSheetWords } from "./stageExcel";

/** The công đoạn sheet's words in the current language; export and import must agree on them. */
export function stageSheetWords(): StageSheetWords {
  return {
    headers: {
      name: t("Taxonomy:Service:StageNameCol"),
      type: t("Taxonomy:Service:StageExcel:TypeCol"),
      value: t("Taxonomy:Service:StageValueCol"),
      marketing: t("Taxonomy:Service:StageMarketing"),
    },
    yes: [t("Common:Yes"), "Có", "Yes"],
    no: [t("Common:No"), "Không", "No"],
  };
}

export function stageProblemText(problem: StageRowProblem): string {
  return t(`Taxonomy:Service:StageExcel:${problem}`);
}

export function stageFileProblemText(problem: StageFileProblem, words: StageSheetWords): string {
  if (problem.reason !== "MissingColumns") return t(`Taxonomy:Service:StageExcel:${problem.reason}`);
  const columns = problem.columns.map((column) => `"${stageHeader(column, words.headers)}"`).join(", ");
  return t("Taxonomy:Service:StageExcel:MissingColumns", columns);
}
