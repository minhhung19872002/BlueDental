import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { queryClient } from "./lib/queryClient";
import { router } from "./app/router";
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
    <TooltipProvider>
      <RouterProvider key={language} router={router} />
      <Toaster position="top-right" richColors />
    </TooltipProvider>
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
