import { useEffect, useRef } from "react";

import { useAbility } from "@/hooks/useAbility";
import { useBranchFilter } from "@/lib/clinicBranch";
import { playMessageChime } from "@/lib/chime";

import { useInboxPulse } from "../api/inboxApi";

const RUNG_KEY_PREFIX = "bd:zalo-message-chime:";

function readRung(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    // Storage blocked (private window): nothing shared, this tab rings on its own.
    return 0;
  }
}

function writeRung(key: string, at: number): void {
  try {
    localStorage.setItem(key, String(at));
  } catch {
    // Storage blocked: the other tabs cannot be told, they ring too.
  }
}

/**
 * One ring per browser for a given message time, however many tabs are open:
 * the first tab that is heard records the time and the others skip it. Only a
 * ring that was heard is recorded, so a tab the browser still keeps muted
 * leaves it to one that can play.
 */
async function ringOnce(branchId: string, at: number): Promise<void> {
  const key = RUNG_KEY_PREFIX + branchId;
  const claim = async () => {
    if (readRung(key) >= at) return;
    if (await playMessageChime()) writeRung(key, at);
  };
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (locks) await locks.request(key, claim);
  else await claim();
}

/**
 * "Nghe chuông tin nhắn Zalo" (R-1194): an account holding cskhInbox.notify
 * hears `tinnhan.mp3` when a customer writes to the current branch's OA, on
 * any screen. The first pulse after a load or a branch change is only
 * remembered; a newer customer message rings once, several in one poll still
 * once. No branch (Tất cả chi nhánh) rings nothing.
 */
export function useZaloMessageChime(): void {
  const branchId = useBranchFilter();
  const canNotify = useAbility("cskhInbox").can("notify");
  const pulse = useInboxPulse(branchId, canNotify);
  const knownRef = useRef<{ branchId: string; at: number } | null>(null);

  const loaded = pulse.isSuccess;
  const latest = pulse.data?.lastCustomerMessageAt ?? null;

  useEffect(() => {
    if (!branchId || !loaded) return;
    const at = latest ? Date.parse(latest) : 0;
    const known = knownRef.current;
    knownRef.current = { branchId, at: Math.max(at, known?.branchId === branchId ? known.at : 0) };
    if (!known || known.branchId !== branchId || at <= known.at) return;
    void ringOnce(branchId, at);
  }, [branchId, loaded, latest]);
}
