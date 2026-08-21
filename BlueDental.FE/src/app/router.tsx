import { Suspense, lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Spin } from "antd";
import { AppLayout } from "./AppLayout";
import { PrivateRoute } from "./PrivateRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

const LoginPage = lazy(() =>
  import("@/features/auth/pages/LoginPage").then((m) => ({
    default: m.LoginPage,
  })),
);

const ReceptionPage = lazy(() =>
  import("@/features/reception/pages/ReceptionPage").then((m) => ({
    default: m.ReceptionPage,
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

const DashboardPage = lazy(() =>
  import("@/features/dashboard/pages/DashboardPage").then((m) => ({
    default: m.DashboardPage,
  })),
);

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
        element: <Navigate to="/reception" replace />,
      },
      // ── Reception (default page) ──
      {
        path: "reception",
        element: (
          <S>
            <ReceptionPage />
          </S>
        ),
      },
      // ── Patient list ──
      {
        path: "patient",
        element: (
          <S>
            <PatientManagementPage />
          </S>
        ),
      },
      {
        path: "patient/:id",
        element: (
          <S>
            <PatientProfilePage />
          </S>
        ),
      },
      // ── Calendar (appointments) ──
      {
        path: "calendar",
        element: (
          <S>
            <AppointmentCalendarPage />
          </S>
        ),
      },
      {
        path: "calendar/list",
        element: (
          <S>
            <AppointmentListPage />
          </S>
        ),
      },
      // ── Stubs matching reference routes ──
      {
        path: "cskh-grouping",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "labo",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "operations",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "report",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "staff",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "materials",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "taxonomy",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "tools",
        element: <S><RouteLoading /></S>,
      },
      // ── Dashboard (kept for internal use) ──
      {
        path: "dashboard",
        element: (
          <S>
            <DashboardPage />
          </S>
        ),
      },
      // ── Account ──
      {
        path: "account/profile",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "account/change-password",
        element: <S><RouteLoading /></S>,
      },
      {
        path: "*",
        element: <RouteErrorBoundary />,
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
