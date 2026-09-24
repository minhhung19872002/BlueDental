import { useCallback, useState } from "react";
import {
  useDownloadImportErrors,
  useDownloadImportTemplate,
  useImportCatalogEntries,
  type CatalogImportResultDto,
} from "../api/taxonomyApi";

export type ImportStep = "file" | "preview" | "done";

interface Params {
  group: string;
  branchId: string;
}

/**
 * The three-step import flow: pick a file, check it (a dry run the server
 * validates in full), then write it. The server refuses a file with any error,
 * so the step after the check is either the import or a new file.
 */
export function useCatalogImport({ group, branchId }: Params) {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<CatalogImportResultDto | null>(null);

  const run = useImportCatalogEntries();
  const template = useDownloadImportTemplate();
  const errorFile = useDownloadImportErrors();

  const step: ImportStep = result === null ? "file" : result.committed ? "done" : "preview";

  const check = useCallback(async () => {
    if (!file) return;
    try {
      setResult(await run.mutateAsync({ group, clinicBranchId: branchId, file, dryRun: true }));
    } catch {
      // queryClient reports the failure; the dialog stays on the file step.
    }
  }, [branchId, file, group, run]);

  const commit = useCallback(async (): Promise<CatalogImportResultDto | null> => {
    if (!file) return null;
    try {
      const committed = await run.mutateAsync({ group, clinicBranchId: branchId, file, dryRun: false });
      setResult(committed);
      return committed;
    } catch {
      return null;
    }
  }, [branchId, file, group, run]);

  const downloadErrors = useCallback(() => {
    if (!file) return;
    errorFile.mutate({ group, clinicBranchId: branchId, file, dryRun: true });
  }, [branchId, errorFile, file, group]);

  const downloadTemplate = useCallback(() => template.mutate(group), [group, template]);

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
    downloadTemplate,
    downloadErrors,
    busy: run.isPending,
    downloadingTemplate: template.isPending,
    downloadingErrors: errorFile.isPending,
  };
}
