import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api";
import { t } from "@/lib/i18n";

interface Props {
  children: ReactNode;
}

/** Where a signed-in visitor is sent instead of the sign-in screen. */
const HOME = "/";

/**
 * The mirror of {@link PrivateRoute}: the sign-in screen, for people who are
 * not signed in yet.
 *
 * Without it, opening `/login` while the session is still good parks you on
 * the form — the cookie is valid, the server answers `current-user` with 200,
 * and nothing moves you along. It reads as "I signed in and it threw me back
 * to the login page".
 *
 * The session cannot be read from the auth store, which holds nothing until
 * `PrivateRoute` fills it — and `PrivateRoute` never runs on this route. So
 * the question goes to the server, under the key `PrivateRoute` already uses:
 * arriving from inside the application the answer is cached and this costs
 * nothing, while a cold open of `/login` pays one request.
 *
 * A 401 here is the normal case, and the API client leaves it alone on this
 * path — it clears the store without redirecting anywhere.
 */
export function PublicOnlyRoute({ children }: Props) {
  const location = useLocation();
  const currentUser = useQuery({
    queryKey: ["auth", "current-user"],
    queryFn: authApi.getCurrentUser,
    retry: false,
    staleTime: 60_000,
  });

  if (currentUser.isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Spin size="large" description={t("Đang xác thực phiên đăng nhập")} />
      </div>
    );
  }

  if (currentUser.data) {
    // Back to whatever was being opened when the session ran out, if anything.
    const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
    return <Navigate to={from && from !== "/login" ? from : HOME} replace />;
  }

  return <>{children}</>;
}
