import { useEffect, useRef } from "react";
import { toast, useSonner } from "sonner";

/** sonner's own default when neither the toast nor the Toaster sets one. */
const DEFAULT_TOAST_DURATION_MS = 4000;

/** How long past its duration a hovered toast may stay before it closes anyway. */
const HOVER_GRACE_MS = 3000;

type ToastId = string | number;

interface ScheduledClose {
  /** The toast object the timer was set for; an update replaces it. */
  version: object;
  timer: number;
}

/**
 * Hard upper bound on how long any toast stays on screen.
 *
 * sonner pauses every timer while the pointer is over the toaster, and the
 * toaster sits top-center — right over an open dialog's header. Expanded,
 * the stack grows down under the cursor of someone still working in that
 * dialog, so the timers never resume and toasts pile up for minutes (bug #18).
 * Hover still holds a toast, but only for {@link HOVER_GRACE_MS} extra.
 *
 * Loading and `duration: Infinity` toasts are left alone: their caller ends them.
 */
export function ToastLifetimeGuard(): null {
  const { toasts } = useSonner();
  const scheduled = useRef(new Map<ToastId, ScheduledClose>());

  useEffect(() => {
    const closes = scheduled.current;
    const live = new Set(toasts.map((t) => t.id));

    for (const [id, close] of closes) {
      if (live.has(id)) continue;
      window.clearTimeout(close.timer);
      closes.delete(id);
    }

    for (const t of toasts) {
      const current = closes.get(t.id);
      if (current?.version === t) continue;
      if (current) window.clearTimeout(current.timer);
      closes.delete(t.id);

      const duration = t.duration ?? DEFAULT_TOAST_DURATION_MS;
      if (t.type === "loading" || !Number.isFinite(duration)) continue;

      const timer = window.setTimeout(() => toast.dismiss(t.id), duration + HOVER_GRACE_MS);
      closes.set(t.id, { version: t, timer });
    }
  }, [toasts]);

  useEffect(() => {
    const closes = scheduled.current;
    return () => {
      for (const close of closes.values()) window.clearTimeout(close.timer);
      closes.clear();
    };
  }, []);

  return null;
}
