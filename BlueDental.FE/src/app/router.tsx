import { Suspense, lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Spin } from "antd";
import { AppLayout } from "./AppLayout";
import { PrivateRoute } from "./PrivateRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

// ── Lazy-loaded pages ─────────────────────────────────────────────────────────

const LoginPage = lazy(() =>
  import("@/features/auth/pages/LoginPage").then((m) => ({
    default: m.LoginPage,
  })),
);

const DashboardPage = lazy(() =>
  import("@/features/dashboard/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);

const PatientManagementPage = lazy(() =>
  import(
    "@/features/patient-management/pages/PatientManagementPage"
  ).then((m) => ({ default: m.PatientManagementPage })),
);

const PatientProfilePage = lazy(() =>
  import("@/features/patient-management/pages/PatientProfilePage").then(
    (m) => ({ default: m.PatientProfilePage }),
  ),
);

const AppointmentCalendarPage = lazy(() =>
  import(
    "@/features/appointments/pages/AppointmentCalendarPage"
  ).then((m) => ({ default: m.AppointmentCalendarPage })),
);

const AppointmentListPage = lazy(() =>
  import("@/features/appointments/pages/AppointmentListPage").then((m) => ({
    default: m.AppointmentListPage,
  })),
);

// ── Route loading spinner ─────────────────────────────────────────────────────

function RouteLoading() {
  return (
    <div style={{ minHeight: 200, display: "grid", placeItems: "center" }}>
      <Spin size="large" />
    </div>
  );
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}

// ── Route tree ────────────────────────────────────────────────────────────────

const appRoutes: RouteObject[] = [
  {
    path: "/login",
    element: (
      <S>
        <LoginPage />
      </S>
    ),
  },
  {
    path: "/",
    element: (
      <PrivateRoute>
        <AppLayout />
      </PrivateRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: (
          <S>
            <DashboardPage />
          </S>
        ),
      },
      // ── Patients ──────────────────────────────────────────────────────────
      {
        path: "patients",
        element: (
          <S>
            <PatientManagementPage />
          </S>
        ),
      },
      {
        path: "patients/:id",
        element: (
          <S>
            <PatientProfilePage />
          </S>
        ),
      },
      // ── Appointments ──────────────────────────────────────────────────────
      {
        path: "appointments",
        element: (
          <S>
            <AppointmentCalendarPage />
          </S>
        ),
      },
      {
        path: "appointments/list",
        element: (
          <S>
            <AppointmentListPage />
          </S>
        ),
      },
      // ── Stubs — will be implemented incrementally ─────────────────────────
      {
        path: "treatment",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "billing",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "inventory",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "reporting",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "organizations",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "catalogs",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "administration/identity",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "administration/audit-logs",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "administration/settings",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "account/profile",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "account/change-password",
        element: (
          <S>
            <RouteLoading />
          </S>
        ),
      },
      {
        path: "*",
        element: (
          <RouteErrorBoundary />
        ),
      },
    ],
  },
];

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorBoundary />,
    children: appRoutes,
  },
]);
