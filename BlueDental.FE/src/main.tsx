import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConfigProvider, App as AntdApp } from "antd";
import { Toaster } from "sonner";
import viVN from "antd/locale/vi_VN";
import enUS from "antd/locale/en_US";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { queryClient } from "./lib/queryClient";
import { router } from "./app/router";
import { themeConfig } from "./theme/index";
import { I18nProvider, useLanguage } from "./lib/i18n";
import { initTableGrabScroll } from "./hooks/useDragScroll";
import "./styles/index.css";

dayjs.locale("vi");

function LocalizedApp() {
  const [language] = useLanguage();

  useEffect(() => {
    const cleanup = initTableGrabScroll();
    return cleanup;
  }, []);

  dayjs.locale(language === "en" ? "en" : "vi");

  return (
    <ConfigProvider locale={language === "en" ? enUS : viVN} theme={themeConfig}>
      <AntdApp>
        <RouterProvider key={language} router={router} />
        <Toaster position="top-center" richColors offset={80} />
      </AntdApp>
    </ConfigProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <LocalizedApp />
      </I18nProvider>
    </QueryClientProvider>
  </StrictMode>,
);
