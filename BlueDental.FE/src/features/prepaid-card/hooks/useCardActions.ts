import { useState } from "react";
import { t } from "@/lib/i18n";
import { useCardCommands } from "../api/prepaidCardApi";
import { CARD_STATUS, type CardDetailDto, type CardDto, type SellCardInput, type TopupCardInput } from "../types";
import { useRunCommand } from "./useRunCommand";

/**
 * What the card list's buttons do: sell, open a card, top it up, change its
 * members, lock it. Each waits for the server before it toasts and closes.
 */
export function useCardActions() {
  const commands = useCardCommands();
  const run = useRunCommand();
  const [selling, setSelling] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toppingUp, setToppingUp] = useState<CardDto | null>(null);

  const sell = async (input: SellCardInput) => {
    let soldId: string | undefined;
    const done = await run(async () => {
      soldId = (await commands.sell.mutateAsync(input)).id;
    }, t("PrepaidCard:Sell:Done"));
    if (!done) return;
    setSelling(false);
    if (soldId) setOpenId(soldId);
  };

  const topup = async (input: TopupCardInput) => {
    if (!toppingUp) return;
    const id = toppingUp.id;
    if (await run(() => commands.topup.mutateAsync({ id, input }), t("PrepaidCard:Topup:Done"))) setToppingUp(null);
  };

  const saveMembers = (card: CardDetailDto, memberPatientIds: string[]) =>
    void run(() => commands.setMembers.mutateAsync({ id: card.id, memberPatientIds }), t("PrepaidCard:Members:Saved"));

  const toggleLock = (card: CardDetailDto) => {
    const locked = card.status !== CARD_STATUS.Locked;
    void run(
      () => commands.setLocked.mutateAsync({ id: card.id, locked }),
      t(locked ? "PrepaidCard:Locked" : "PrepaidCard:Unlocked"),
    );
  };

  return {
    selling,
    openSell: () => setSelling(true),
    closeSell: () => setSelling(false),
    sell,
    savingSale: commands.sell.isPending,
    openId,
    open: (card: CardDto) => setOpenId(card.id),
    closeDetail: () => setOpenId(null),
    toppingUp,
    openTopup: setToppingUp,
    closeTopup: () => setToppingUp(null),
    topup,
    savingTopup: commands.topup.isPending,
    saveMembers,
    savingMembers: commands.setMembers.isPending,
    toggleLock,
    togglingLock: commands.setLocked.isPending,
  };
}
