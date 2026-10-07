import { useState } from "react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";
import {
  useTicketCommands,
  type BookInput,
  type ContactInput,
  type CreateTicketInput,
  type TicketDto,
} from "../api/ticketApi";
import type { TicketRowAction } from "../components/TicketRowActions";

/** Which dialog is open, and on which ticket. Claim and Mở lại need none; Khôi phục asks first. */
export type TicketPending =
  | { kind: "none" }
  | { kind: "form"; ticket: TicketDto | null }
  | { kind: "contact" | "assign" | "notPotential" | "delete" | "book" | "restore"; ticket: TicketDto };

type DialogAction = Exclude<TicketRowAction, "claim" | "reopen" | "edit">;

/**
 * The Ticket screen's commands. Each one waits for the server before it toasts
 * and closes; a refusal is reported by the query client and leaves the dialog
 * open to retry.
 */
export function useTicketActions() {
  const commands = useTicketCommands();
  const [pending, setPending] = useState<TicketPending>({ kind: "none" });
  const close = () => setPending({ kind: "none" });

  const run = async (work: () => Promise<unknown>, message: string) => {
    try {
      await work();
      toast.success(message);
      close();
    } catch {
      // queryClient reports the failure.
    }
  };

  const target = pending.kind === "none" || pending.kind === "form" ? null : pending.ticket;

  const submitForm = async (input: CreateTicketInput) => {
    if (pending.kind !== "form") return;
    const editing = pending.ticket;
    if (editing) {
      await run(() => commands.update.mutateAsync({ id: editing.id, input }), t("Common:Updated"));
      return;
    }
    try {
      const result = await commands.create.mutateAsync(input);
      // A phone with an open ticket lands on that one instead of a duplicate.
      if (result.reoccurred) toast.info(t("Ticket:Reoccurred", result.ticket.code));
      else toast.success(t("Ticket:Created", result.ticket.code));
      close();
    } catch {
      // queryClient reports the failure.
    }
  };

  const submitContact = (input: ContactInput) =>
    target && void run(() => commands.contact.mutateAsync({ id: target.id, input }), t("Ticket:ContactLogged"));
  const submitAssign = (assigneeId: string | null) =>
    target && void run(() => commands.assign.mutateAsync({ id: target.id, assigneeId }), t("Ticket:Assigned"));
  const submitBook = (input: BookInput) =>
    target && void run(() => commands.book.mutateAsync({ id: target.id, input }), t("Ticket:Booked"));
  const submitReason = (reason: string) => {
    if (pending.kind === "notPotential") {
      void run(() => commands.notPotential.mutateAsync({ id: pending.ticket.id, reason }), t("Ticket:MarkedNotPotential"));
    } else if (pending.kind === "delete") {
      void run(() => commands.remove.mutateAsync({ id: pending.ticket.id, reason }), t("Common:Deleted"));
    }
  };

  const direct = (work: () => Promise<unknown>, message: string) => {
    work().then(() => toast.success(message), () => undefined);
  };

  const onAction = (action: TicketRowAction, ticket: TicketDto) => {
    if (action === "claim") return direct(() => commands.claim.mutateAsync(ticket.id), t("Ticket:Claimed"));
    if (action === "reopen") return direct(() => commands.reopen.mutateAsync(ticket.id), t("Ticket:Reopened"));
    if (action === "edit") return setPending({ kind: "form", ticket });
    const kind: DialogAction = action;
    setPending({ kind, ticket });
  };

  const submitRestore = () =>
    target && void run(() => commands.restore.mutateAsync(target.id), t("Ticket:Restored"));

  return {
    pending,
    target,
    close,
    openCreate: () => setPending({ kind: "form", ticket: null }),
    onAction,
    restore: (ticket: TicketDto) => setPending({ kind: "restore", ticket }),
    submitForm: (input: CreateTicketInput) => void submitForm(input),
    submitContact,
    submitAssign,
    submitBook,
    submitReason,
    submitRestore,
    saving: commands.create.isPending || commands.update.isPending,
    busy: {
      contact: commands.contact.isPending,
      assign: commands.assign.isPending,
      book: commands.book.isPending,
      reason: commands.notPotential.isPending || commands.remove.isPending,
      restore: commands.restore.isPending,
    },
  };
}
