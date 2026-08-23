import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReceptionPage } from "../pages/ReceptionPage";

// Mock window.matchMedia and ResizeObserver for AntD components
beforeEach(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("ReceptionPage", () => {
  it("renders reception toolbar controls and date selector", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ReceptionPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Ngày")).toBeInTheDocument();
    expect(screen.getByText("Tuần")).toBeInTheDocument();
    expect(screen.getByText("Tháng")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Tìm bệnh nhân..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tạo tiếp nhận")).toBeInTheDocument();
  });

  it("opens create reception drawer when clicking primary button", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ReceptionPage />
      </QueryClientProvider>,
    );

    const createBtn = screen.getByText("Tạo tiếp nhận");
    fireEvent.click(createBtn);

    await waitFor(() => {
      // The drawer reuses the toolbar wording, so the title makes "Tạo tiếp nhận"
      // appear twice; the patient search field is what identifies the drawer.
      expect(screen.getAllByText("Tạo tiếp nhận").length).toBeGreaterThan(1);
      // The patient picker is an antd Select, whose placeholder is not a real
      // input placeholder — assert on the field label instead.
      expect(screen.getByText("Khách hàng")).toBeInTheDocument();
    });
  });

  it("renders status tabs correctly", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ReceptionPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Tất cả/)).toBeInTheDocument();
    expect(screen.getByText(/Chờ khám/)).toBeInTheDocument();
    expect(screen.getByText(/Đang khám/)).toBeInTheDocument();
    expect(screen.getByText(/Hoàn thành/)).toBeInTheDocument();
  });
});
