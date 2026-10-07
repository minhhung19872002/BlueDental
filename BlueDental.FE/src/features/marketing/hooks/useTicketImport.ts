import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  useTicketFileCommands,
  type TicketFileHeaders,
  type TicketImportOptions,
  type TicketImportResult,
} from "../api/ticketFileApi";

export type TicketImportStep = "file" | "mapping" | "result";

/**
 * Import ticket từ file (BA 8.4): pick the file, map its columns and say whom
 * the tickets go to, then see what the server made of it. A file with any row
 * error is refused whole, so the result step is either the summary or the list
 * of rows to fix.
 */
export function useTicketImport() {
  const { template, inspect, commit } = useTicketFileCommands();
  const [step, setStep] = useState<TicketImportStep>("file");
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<TicketFileHeaders | null>(null);
  const [result, setResult] = useState<TicketImportResult | null>(null);

  const readHeaders = async () => {
    if (!file) return;
    try {
      setHeaders(await inspect.mutateAsync(file));
      setStep("mapping");
    } catch {
      // queryClient reports the failure.
    }
  };

  const submit = async (options: TicketImportOptions) => {
    if (!file) return;
    try {
      const outcome = await commit.mutateAsync({ file, options });
      setResult(outcome);
      setStep("result");
      if (outcome.committed) toast.success(t("Ticket:Import:Success", outcome.createdCount));
    } catch {
      // queryClient reports the failure.
    }
  };

  const reset = () => {
    setStep("file");
    setFile(null);
    setHeaders(null);
    setResult(null);
  };

  const downloadTemplate = () => template.mutate(`${t("Ticket:File:TemplateName")}.xlsx`);

  return {
    step,
    file,
    setFile,
    headers,
    result,
    readHeaders,
    submit,
    reset,
    downloadTemplate,
    downloadingTemplate: template.isPending,
    busy: inspect.isPending || commit.isPending,
  };
}
