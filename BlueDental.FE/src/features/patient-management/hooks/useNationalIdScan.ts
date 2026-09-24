import { useCallback, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { describeApiError } from "@/lib/apiError";
import { useNationalIdLookup } from "../api/patientQueries";
import type { PatientPrefill } from "../types/patient";
import { loadAddressSources } from "../utils/addressSources";
import { splitCardAddress, type CardAddress } from "../utils/cardAddress";
import { parseCccdQr, type CccdCard } from "../utils/cccdQr";

interface Handlers {
  /** TH1 — a record in this branch already holds the number. */
  onExisting: (nationalId: string) => void;
  /** TH2 — no record yet: open "Tạo hồ sơ" with what the card says. */
  onNew: (prefill: PatientPrefill) => void;
}

/**
 * Where one scan stands. A card already on file never reaches "ready": the
 * list is narrowed to it and the dialog closes straight away.
 */
export type ScanState =
  | { step: "scanning"; error: string | null }
  | { step: "checking"; card: CccdCard }
  | { step: "ready"; card: CccdCard; address: CardAddress | null }
  | { step: "failed"; card: CccdCard; error: string };

const SCANNING: ScanState = { step: "scanning", error: null };

/**
 * The address converted to today's units. When the table cannot be loaded the
 * card's text still lands on the street line, so nothing the card says is lost.
 */
async function resolveAddress(card: CccdCard): Promise<CardAddress | null> {
  if (!card.address) return null;
  try {
    return await splitCardAddress(card.address, await loadAddressSources());
  } catch {
    return {
      street: card.address,
      provinceCode: null,
      provinceName: null,
      wardCode: null,
      wardName: null,
      oldAddress: null,
    };
  }
}

function toPrefill(card: CccdCard, address: CardAddress | null): PatientPrefill {
  return {
    nationalId: card.nationalId,
    fullName: card.fullName ?? undefined,
    dateOfBirth: card.dateOfBirth ?? undefined,
    gender: card.gender ?? undefined,
    address: address?.street || undefined,
    provinceCode: address?.provinceCode ?? undefined,
    wardCode: address?.wardCode ?? undefined,
    oldAddress: address?.oldAddress ?? undefined,
  };
}

/**
 * "Quét CCCD": owns the scan dialog. A read card is checked against the branch
 * at once. On file already (TH1): the list narrows to it and the dialog closes,
 * nothing to confirm. New (TH2): the card is previewed, and "Tạo hồ sơ" opens
 * the record form filled from it.
 */
export function useNationalIdScan({ onExisting, onNew }: Handlers) {
  const lookup = useNationalIdLookup();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ScanState>(SCANNING);
  // The camera reads the same card several times a second; only the first
  // read of a scan may start a lookup.
  const taken = useRef(false);

  const openScan = useCallback(() => {
    taken.current = false;
    setState(SCANNING);
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  const rescan = useCallback(() => {
    taken.current = false;
    setState(SCANNING);
  }, []);

  const check = useCallback(
    async (card: CccdCard) => {
      setState({ step: "checking", card });
      try {
        // Started together; the address is only waited for when it is needed.
        const address = resolveAddress(card);
        const { exists } = await lookup(card.nationalId);
        if (exists) {
          onExisting(card.nationalId);
          setOpen(false);
          return;
        }
        setState({ step: "ready", card, address: await address });
      } catch (failure) {
        setState({ step: "failed", card, error: describeApiError(failure).message });
      }
    },
    [lookup, onExisting],
  );

  /** True when the text was a card and the scan is done — the camera stops then. */
  const read = useCallback(
    (raw: string): boolean => {
      if (taken.current) return false;

      const card = parseCccdQr(raw);
      if (!card) {
        setState({ step: "scanning", error: t("Patient:ScanId:Unreadable") });
        return false;
      }

      taken.current = true;
      void check(card);
      return true;
    },
    [check],
  );

  const confirm = useCallback(() => {
    if (state.step !== "ready") return;
    onNew(toPrefill(state.card, state.address));
    setOpen(false);
  }, [state, onNew]);

  return { open, state, openScan, close, rescan, read, confirm };
}
