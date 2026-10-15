import { useCallback, useState } from "react";
import { t } from "@/lib/i18n";
import type { ServiceStageDto } from "../api/taxonomyApi";
import {
  downloadStageWorkbook,
  planStageImport,
  readStageSheet,
  stageErrorRows,
  stageFileName,
  stagesToSheetRows,
  type StageImportPlan,
  type StageSheet,
} from "../stageExcel";
import { stageProblemText, stageSheetWords } from "../stageExcelWords";
import type { ImportStep } from "./useCatalogImport";

interface Params {
  stages: ServiceStageDto[];
  serviceName: string | undefined;
  onApply: (next: ServiceStageDto[]) => void;
}

/**
 * The catalog import's three steps for one service's công đoạn: pick a file,
 * check it, then lay it over the dialog's table. The check runs here, against
 * the same rules as the table, since nothing reaches the server until "Lưu".
 */
export function useStageImport({ stages, serviceName, onApply }: Params) {
  const [file, setFile] = useState<File | null>(null);
  const [sheet, setSheet] = useState<StageSheet | null>(null);
  const [plan, setPlan] = useState<StageImportPlan | null>(null);
  const [applied, setApplied] = useState(false);
  const [checking, setChecking] = useState(false);

  const step: ImportStep = plan === null ? "file" : applied ? "done" : "preview";

  const check = useCallback(async () => {
    if (!file) return;
    setChecking(true);
    try {
      const words = stageSheetWords();
      const read = readStageSheet(await file.arrayBuffer(), words);
      setSheet(read);
      setPlan(planStageImport(stages, read, words));
    } finally {
      setChecking(false);
    }
  }, [file, stages]);

  const apply = useCallback(() => {
    if (!plan?.next) return;
    onApply(plan.next);
    setApplied(true);
  }, [onApply, plan]);

  const downloadTemplate = useCallback(
    () =>
      downloadStageWorkbook(
        stagesToSheetRows([], stageSheetWords()),
        stageFileName(serviceName),
        t("Taxonomy:Service:Stages"),
      ),
    [serviceName],
  );

  const downloadErrors = useCallback(() => {
    if (!sheet) return;
    downloadStageWorkbook(
      stageErrorRows(sheet, stageSheetWords(), t("Taxonomy:Import:ErrorColumn"), stageProblemText),
      `${stageFileName(serviceName)}-loi`,
      t("Taxonomy:Service:Stages"),
    );
  }, [serviceName, sheet]);

  const reset = useCallback(() => {
    setFile(null);
    setSheet(null);
    setPlan(null);
    setApplied(false);
  }, []);

  return { step, file, setFile, sheet, plan, check, apply, reset, downloadTemplate, downloadErrors, checking };
}
