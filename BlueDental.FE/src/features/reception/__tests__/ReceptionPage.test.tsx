import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReceptionPage } from "../pages/ReceptionPage";

vi.mock("@/hooks/useAbility", () => ({
  useAbility: () => ({
    can: () => true,
    canRead: true,
    canCreate: true,
    canUpdate: true,
    canDelete: true,
    canExport: true,
    canApprove: true,
  }),
  abilityName: (subject: string, action: string) =>
    `BlueDental.${subject}.${action}`,
}));

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

    expect(screen.getByText("Common:Day")).toBeInTheDocument();
    expect(screen.getByText("Common:Week")).toBeInTheDocument();
    expect(screen.getByText("Common:Month")).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText("Reception:SearchPlaceholder")).toHaveLength(2);
    expect(screen.getByText("Reception:CreateTitle")).toBeInTheDocument();
  });

  it("opens create reception drawer when clicking primary button", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ReceptionPage />
      </QueryClientProvider>,
    );

    const createBtn = screen.getByText("Reception:CreateTitle");
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getAllByText("Reception:CreateTitle").length).toBeGreaterThan(1);
      expect(screen.getByText("Reception:ColCustomer")).toBeInTheDocument();
    });
  });

  it("renders status tabs correctly", async () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ReceptionPage />
      </QueryClientProvider>,
    );

    expect(screen.getByText(/Reception:TabAll/)).toBeInTheDocument();
    expect(screen.getByText(/Reception:TabWaiting/)).toBeInTheDocument();
    expect(screen.getByText(/Reception:TabInProgress/)).toBeInTheDocument();
    expect(screen.getByText(/Reception:TabCompleted/)).toBeInTheDocument();
  });
});
