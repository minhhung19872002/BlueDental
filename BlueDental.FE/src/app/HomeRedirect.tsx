import { Navigate } from "react-router-dom";

import { useHasAnyPermission } from "@/lib/permissions";

import { NAV_ENTRIES } from "./nav";

/**
 * Where the application opens: Tiếp nhận, by the BA's decision (2026-09-29).
 *
 * An account that may not open Tiếp nhận falls back to Tổng quan — the one
 * screen every account may see — rather than landing on a 403 the moment it
 * signs in.
 */
export function HomeRedirect() {
  const canOpenReception = useHasAnyPermission(NAV_ENTRIES.reception.permissions);
  const home = canOpenReception ? NAV_ENTRIES.reception.path : NAV_ENTRIES.dashboard.path;

  return <Navigate to={home} replace />;
}
