import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConfigProvider, App as AntdApp } from "antd";
import viVN from "antd/locale/vi_VN";
import enUS from "antd/locale/en_US";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { queryClient } from "./lib/queryClient";
import { router } from "./app/router";
import { themeConfig } from "./theme/index";
import { I18nProvider, useLanguage } from "./lib/i18n";
import "./styles/index.css";

dayjs.locale("vi");

/**
 * antd carries its own strings (date pickers, pagination, empty states), so its
 * locale has to follow the app's language rather than being pinned.
 */
function LocalizedApp() {
  const [language] = useLanguage();

  dayjs.locale(language === "en" ? "en" : "vi");

  return (
    <ConfigProvider locale={language === "en" ? enUS : viVN} theme={themeConfig}>
      <AntdApp>
        {/* Remounting on switch guarantees every screen re-reads the overlay,
            including labels that live in constant maps. */}
        <RouterProvider key={language} router={router} />
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
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  </StrictMode>,
);
