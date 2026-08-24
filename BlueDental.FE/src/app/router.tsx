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

const BillingPage = lazy(() =>
  import("@/features/billing/pages/BillingPage").then((m) => ({
    default: m.BillingPage,
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
const VoucherPage = lazy(() =>
  import("@/features/voucher/pages/VoucherPage").then((m) => ({
    default: m.VoucherPage,
  })),
);

const ClinicSettingsPage = lazy(() =>
  import("@/features/organizations/pages/ClinicSettingsPage").then((m) => ({
    default: m.ClinicSettingsPage,
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

const AuditLogPage = lazy(() =>
  import("@/features/audit-logs/pages").then((m) => ({
    default: m.AuditLogPage,
  })),
);

const TimekeepingPage = lazy(() =>
  import("@/features/timekeeping/pages/TimekeepingPage").then((m) => ({
    default: m.TimekeepingPage,
  })),
);

const SettingsPage = lazy(() =>
  import("@/features/settings/pages/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);

const OrganizationListPage = lazy(() =>
  import("@/features/organizations/pages/OrganizationListPage").then((m) => ({
    default: m.OrganizationListPage,
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
      // ── Feature routes ──
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
        path: "billing",
        element: (
          <S>
            <BillingPage />
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
        // Reached from the account menu; the design gives it its own screen.
        path: "settings",
        element: (
          <S>
            <ClinicSettingsPage />
          </S>
        ),
      },
      {
        // Not in the sidebar on the reference either — reached from the patient
        // screen and by direct link.
        path: "voucher",
        element: (
          <S>
            <VoucherPage />
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
      // ── Audit Logs ──
      {
        path: "audit-logs",
        element: (
          <S>
            <AuditLogPage />
          </S>
        ),
      },
      // ── Billing ──
      // ── Timekeeping ──
      {
        path: "timekeeping",
        element: (
          <S>
            <TimekeepingPage />
          </S>
        ),
      },
      // ── Settings ──
      {
        path: "settings",
        element: (
          <S>
            <SettingsPage />
          </S>
        ),
      },
      // ── Organizations ──
      {
        path: "organizations",
        element: (
          <S>
            <OrganizationListPage />
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
