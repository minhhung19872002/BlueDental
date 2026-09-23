import { Suspense, lazy } from "react";
import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Spin } from "antd";
import { AppLayout } from "./AppLayout";
import { PermissionRoute } from "./PermissionRoute";
import { PrivateRoute } from "./PrivateRoute";
import { PublicOnlyRoute } from "./PublicOnlyRoute";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
import { ROUTE_PERMISSIONS, type RoutePermissionKey } from "./routePermissions";

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

const TreatmentPlanDetailPage = lazy(() =>
  import("@/features/treatment-management/pages/TreatmentPlanDetailPage").then(
    (m) => ({ default: m.TreatmentPlanDetailPage }),
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

/**
 * A lazy page behind the permission its menu entry carries, so a typed
 * address is turned away the same way the menu hides it.
 */
function G({ k, children }: { k: RoutePermissionKey; children: React.ReactNode }) {
  return (
    <PermissionRoute permission={ROUTE_PERMISSIONS[k]}>
      <S>{children}</S>
    </PermissionRoute>
  );
}

const appRoutes: RouteObject[] = [
  {
    path: "/login",
    element: (
      <PublicOnlyRoute>
        <S>
          <LoginPage />
        </S>
      </PublicOnlyRoute>
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
        // navDef opens on Tổng quan, so signing in lands there rather than on
        // a reception list the user may not have come for.
        element: <Navigate to="/dashboard" replace />,
      },
      // ── Reception ──
      {
        path: "reception",
        element: (
          <G k="reception">
            <ReceptionPage />
          </G>
        ),
      },
      // ── Patient list ──
      {
        path: "patient",
        element: (
          <G k="patients">
            <PatientManagementPage />
          </G>
        ),
      },
      {
        path: "patient/:id",
        element: (
          <G k="patients">
            <PatientProfilePage />
          </G>
        ),
      },
      {
        path: "patient/:id/treatment-plan/:planId",
        element: (
          <G k="patients">
            <TreatmentPlanDetailPage />
          </G>
        ),
      },
      // ── Calendar (appointments) ──
      {
        path: "calendar",
        element: (
          <G k="calendar">
            <AppointmentCalendarPage />
          </G>
        ),
      },
      {
        path: "calendar/list",
        element: (
          <G k="calendar">
            <AppointmentListPage />
          </G>
        ),
      },
      // ── Feature routes ──
      {
        path: "cskh-grouping",
        element: (
          <G k="cskh">
            <CskhGroupingPage />
          </G>
        ),
      },
      {
        path: "labo",
        element: (
          <G k="labo">
            <LaboPage />
          </G>
        ),
      },
      {
        // Each Labo sub-screen is its own URL, exactly as in the reference, so
        // a tab can be bookmarked and reached with the back button.
        path: "labo/:section",
        element: (
          <G k="labo">
            <LaboPage />
          </G>
        ),
      },
      {
        path: "billing",
        element: (
          <G k="billing">
            <BillingPage />
          </G>
        ),
      },
      {
        path: "operations",
        element: (
          <G k="operations">
            <OperationsPage />
          </G>
        ),
      },
      {
        // Each division is its own URL, as the reference has it, so a screen
        // can be bookmarked and reached with the back button.
        path: "operations/:division",
        element: (
          <G k="operations">
            <OperationsPage />
          </G>
        ),
      },
      {
        path: "report",
        element: (
          <G k="reports">
            <ReportPage />
          </G>
        ),
      },
      {
        path: "staff",
        element: (
          <G k="staff">
            <StaffPage />
          </G>
        ),
      },
      {
        path: "materials",
        element: (
          <G k="materials">
            <MaterialsPage />
          </G>
        ),
      },
      {
        // Each section is its own URL, exactly as in the reference, so a
        // sub-screen can be bookmarked and reached with the back button.
        path: "materials/:section",
        element: (
          <G k="materials">
            <MaterialsPage />
          </G>
        ),
      },
      {
        path: "taxonomy",
        element: (
          <G k="taxonomy">
            <TaxonomyPage />
          </G>
        ),
      },
      {
        // Each catalog is its own URL, exactly as in the reference, so a
        // sub-screen can be bookmarked and reached with the back button.
        path: "taxonomy/:section",
        element: (
          <G k="taxonomy">
            <TaxonomyPage />
          </G>
        ),
      },
      {
        // Reached from the account menu; the design gives it its own screen.
        // Open to everyone for the account's own tabs — the page gates the
        // clinic-wide tabs itself.
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
          <G k="voucher">
            <VoucherPage />
          </G>
        ),
      },
      {
        path: "tools",
        element: (
          <G k="tools">
            <ToolsPage />
          </G>
        ),
      },
      {
        // Each tool category is its own URL, as the reference has it, so a
        // screen can be bookmarked and reached with the back button.
        path: "tools/:category",
        element: (
          <G k="tools">
            <ToolsPage />
          </G>
        ),
      },
      // ── Dashboard (Tổng quan — the design's first screen) ──
      // Every signed-in account may open it, by the owner's decision.
      {
        path: "dashboard",
        element: (
          <G k="dashboard">
            <DashboardPage />
          </G>
        ),
      },
      // ── Identity Administration ──
      {
        path: "identity",
        element: (
          <G k="identity">
            <IdentityAdministrationPage />
          </G>
        ),
      },
      // ── Audit Logs ──
      {
        path: "audit-logs",
        element: (
          <G k="auditLogs">
            <AuditLogPage />
          </G>
        ),
      },
      // ── Billing ──
      // ── Timekeeping (embedded in calendar page via ?tab=timekeeping) ──
      // ── Display preferences ──
      // This used to be declared as a second "settings" route, which React
      // Router never reached because the clinic settings above already claimed
      // that path. It is the display-options screen, not the clinic one, so it
      // gets its own address instead of shadowing.
      {
        path: "settings/preferences",
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
          <G k="organizations">
            <OrganizationListPage />
          </G>
        ),
      },
      // ── Account (redirect to unified profile page) ──
      {
        path: "account/profile",
        element: <S><ClinicSettingsPage /></S>,
      },
      {
        path: "account/change-password",
        element: <S><ClinicSettingsPage /></S>,
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
