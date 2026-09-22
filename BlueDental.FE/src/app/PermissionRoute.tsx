import type { ReactNode } from "react";

import { ForbiddenResult } from "@/components/ForbiddenResult";
import { useHasAnyPermission } from "@/lib/permissions";

interface Props {
  /** Any one of these opens the screen; an empty list opens it for everyone. */
  permission: string | readonly string[];
  children: ReactNode;
}

/**
 * Keeps a route behind its permission. The menu already hides what the user
 * may not open (`useVisibleNav`); this catches a typed or bookmarked address.
 */
export function PermissionRoute({ permission, children }: Props) {
  const required = typeof permission === "string" ? [permission] : permission;
  const allowed = useHasAnyPermission(required);

  if (!allowed) return <ForbiddenResult />;

  return <>{children}</>;
}
