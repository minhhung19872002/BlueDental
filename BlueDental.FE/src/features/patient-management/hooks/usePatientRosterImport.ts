import { useCallback, useState } from "react";
import {
  useDownloadRosterErrors,
  useImportPatientRoster,
  type PatientRosterResultDto,
} from "../api/patientRosterApi";

export type RosterImportStep = "file" | "preview" | "done";

/**
 * Pick the file, check it (a dry run the server validates in full), then
 * write it. The server refuses a file with any error, so after the check
 * comes either the import or another file.
 */
export function usePatientRosterImport() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PatientRosterResultDto | null>(null);

  const run = useImportPatientRoster();
  const errorFile = useDownloadRosterErrors();

  const step: RosterImportStep = result === null ? "file" : result.committed ? "done" : "preview";

  const check = useCallback(async () => {
    if (!file) return;
    try {
      setResult(await run.mutateAsync({ file, dryRun: true }));
    } catch {
      // queryClient reports the failure; the dialog stays on the file step.
    }
  }, [file, run]);

  const commit = useCallback(async (): Promise<PatientRosterResultDto | null> => {
    if (!file) return null;
    try {
      const committed = await run.mutateAsync({ file, dryRun: false });
      setResult(committed);
      return committed;
    } catch {
      return null;
    }
  }, [file, run]);

  const downloadErrors = useCallback(() => {
    if (file) errorFile.mutate({ file, dryRun: true });
  }, [errorFile, file]);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
  }, []);

  return {
    step,
    file,
    setFile,
    result,
    check,
    commit,
    reset,
    downloadErrors,
    busy: run.isPending,
    downloadingErrors: errorFile.isPending,
  };
}
