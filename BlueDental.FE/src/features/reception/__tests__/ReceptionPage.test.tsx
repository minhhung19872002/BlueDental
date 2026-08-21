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
      expect(
        screen.getByText("Tạo tiếp nhận khách hàng mới"),
      ).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Nhập họ và tên khách hàng"),
      ).toBeInTheDocument();
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
    expect(screen.getByText(/Khách đến/)).toBeInTheDocument();
    expect(screen.getByText(/Đang khám/)).toBeInTheDocument();
    expect(screen.getByText(/Hoàn thành/)).toBeInTheDocument();
  });
});
