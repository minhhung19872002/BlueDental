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

const CskhGroupingPage = lazy(() =>
  import("@/features/cskh/pages/CskhGroupingPage").then((m) => ({
    default: m.CskhGroupingPage,
  })),
);

const StaffPage = lazy(() =>
  import("@/features/staff/pages/StaffPage").then((m) => ({
    default: m.StaffPage,
  })),
);

const LaboPage = lazy(() =>
  import("@/features/labo/pages/LaboPage").then((m) => ({
    default: m.LaboPage,
  })),
);

const MaterialsPage = lazy(() =>
  import("@/features/materials/pages/MaterialsPage").then((m) => ({
    default: m.MaterialsPage,
  })),
);

const OperationsPage = lazy(() =>
  import("@/features/operations/pages/OperationsPage").then((m) => ({
    default: m.OperationsPage,
  })),
);

const ReportPage = lazy(() =>
  import("@/features/report/pages/ReportPage").then((m) => ({
    default: m.ReportPage,
  })),
);

const TaxonomyPage = lazy(() =>
  import("@/features/taxonomy/pages/TaxonomyPage").then((m) => ({
    default: m.TaxonomyPage,
  })),
);

const ToolsPage = lazy(() =>
  import("@/features/tools/pages/ToolsPage").then((m) => ({
    default: m.ToolsPage,
  })),
);

const AccountProfilePage = lazy(() =>
  import("@/features/account/pages/AccountProfilePage").then((m) => ({
    default: m.AccountProfilePage,
  })),
);

const ChangePasswordPage = lazy(() =>
  import("@/features/account/pages/ChangePasswordPage").then((m) => ({
    default: m.ChangePasswordPage,
  })),
);

const IdentityAdministrationPage = lazy(() =>
  import("@/features/identity/pages").then((m) => ({
    default: m.IdentityAdministrationPage,
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
        element: (
          <S>
            <CskhGroupingPage />
          </S>
        ),
      },
      {
        path: "labo",
        element: (
          <S>
            <LaboPage />
          </S>
        ),
      },
      {
        path: "operations",
        element: (
          <S>
            <OperationsPage />
          </S>
        ),
      },
      {
        path: "report",
        element: (
          <S>
            <ReportPage />
          </S>
        ),
      },
      {
        path: "staff",
        element: (
          <S>
            <StaffPage />
          </S>
        ),
      },
      {
        path: "materials",
        element: (
          <S>
            <MaterialsPage />
          </S>
        ),
      },
      {
        path: "taxonomy",
        element: (
          <S>
            <TaxonomyPage />
          </S>
        ),
      },
      {
        path: "tools",
        element: (
          <S>
            <ToolsPage />
          </S>
        ),
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
      // ── Identity Administration ──
      {
        path: "identity",
        element: (
          <S>
            <IdentityAdministrationPage />
          </S>
        ),
      },
      // ── Account ──
      {
        path: "account/profile",
        element: <S><AccountProfilePage /></S>,
      },
      {
        path: "account/change-password",
        element: <S><ChangePasswordPage /></S>,
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
