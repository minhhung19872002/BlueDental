import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";
import { t } from "@/lib/i18n";

interface NotFoundPageProps {
  /** Outside the shell (the root error boundary) there is no sidebar to frame it. */
  fullscreen?: boolean;
}

/**
 * Shown for any address the router does not know. The catch-all route renders
 * it as an ordinary page inside the shell, so the sidebar stays and the user
 * can move on from the menu — it is not an error screen, nothing has failed.
 */
export function NotFoundPage({ fullscreen = false }: NotFoundPageProps) {
  const navigate = useNavigate();
  const className = ["route-result", fullscreen && "route-result--fullscreen"].filter(Boolean).join(" ");

  const handleGoHome = () => navigate("/");

  return (
    <div className={className}>
      <Result
        status="404"
        title={t("Common:NotFound")}
        subTitle={t("Common:NotFoundMessage")}
        extra={
          <Button type="primary" onClick={handleGoHome}>
            {t("Common:GoHome")}
          </Button>
        }
      />
    </div>
  );
}
