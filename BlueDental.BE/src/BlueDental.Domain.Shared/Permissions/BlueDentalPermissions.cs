namespace BlueDental.Permissions;

public static class BlueDentalPermissions
{
    public const string GroupName = "BlueDental";

    public static class Organizations
    {
        public const string Default = GroupName + ".Organizations";
        public const string View = Default + ".View";
        public const string Create = Default + ".Create";
        public const string Edit = Default + ".Edit";
        public const string Delete = Default + ".Delete";
    }

    public static class Catalogs
    {
        public const string Default = GroupName + ".Catalogs";
        public const string View = Default + ".View";
        public const string Create = Default + ".Create";
        public const string Edit = Default + ".Edit";
        public const string Delete = Default + ".Delete";
    }

    public static class PatientManagement
    {
        public const string Default = GroupName + ".PatientManagement";

        public static class Patients
        {
            public const string Default = PatientManagement.Default + ".Patients";
            public const string View = Default + ".View";
            public const string Create = Default + ".Create";
            public const string Edit = Default + ".Edit";
            public const string Delete = Default + ".Delete";
        }

        public static class MedicalHistory
        {
            public const string Default = PatientManagement.Default + ".MedicalHistory";
            public const string View = Default + ".View";
            public const string Manage = Default + ".Manage";
        }
    }

    public static class Appointments
    {
        public const string Default = GroupName + ".Appointments";
        public const string View = Default + ".View";
        public const string Create = Default + ".Create";
        public const string Edit = Default + ".Edit";
        public const string Delete = Default + ".Delete";
        public const string Confirm = Default + ".Confirm";
        public const string Cancel = Default + ".Cancel";
        public const string CheckIn = Default + ".CheckIn";
        public const string Complete = Default + ".Complete";
    }

    public static class TreatmentManagement
    {
        public const string Default = GroupName + ".TreatmentManagement";

        public static class TreatmentPlans
        {
            public const string Default = TreatmentManagement.Default + ".TreatmentPlans";
            public const string View = Default + ".View";
            public const string Create = Default + ".Create";
            public const string Edit = Default + ".Edit";
            public const string Approve = Default + ".Approve";
        }

        public static class TreatmentRecords
        {
            public const string Default = TreatmentManagement.Default + ".TreatmentRecords";
            public const string View = Default + ".View";
            public const string Create = Default + ".Create";
            public const string Edit = Default + ".Edit";
        }

        public static class Prescriptions
        {
            public const string Default = TreatmentManagement.Default + ".Prescriptions";
            public const string View = Default + ".View";
            public const string Create = Default + ".Create";
            public const string Dispense = Default + ".Dispense";
        }
    }

    public static class Billing
    {
        public const string Default = GroupName + ".Billing";

        public static class Invoices
        {
            public const string Default = Billing.Default + ".Invoices";
            public const string View = Default + ".View";
            public const string Create = Default + ".Create";
            public const string Edit = Default + ".Edit";
            public const string Process = Default + ".Process";
            public const string Void = Default + ".Void";
        }

        public static class InsuranceClaims
        {
            public const string Default = Billing.Default + ".InsuranceClaims";
            public const string View = Default + ".View";
            public const string Submit = Default + ".Submit";
            public const string Process = Default + ".Process";
        }
    }

    public static class Inventory
    {
        public const string Default = GroupName + ".Inventory";
        public const string View = Default + ".View";
        public const string Manage = Default + ".Manage";
        public const string AdjustStock = Default + ".AdjustStock";
    }

    public static class Reporting
    {
        public const string Default = GroupName + ".Reporting";
        public const string View = Default + ".View";
        public const string Generate = Default + ".Generate";
        public const string Export = Default + ".Export";
    }

    public static class LaboOrders
    {
        public const string Default = GroupName + ".LaboOrders";
        public const string View = Default + ".View";
        public const string Create = Default + ".Create";
        public const string Edit = Default + ".Edit";
        public const string Workflow = Default + ".Workflow";
    }

    public static class CustomerCare
    {
        public const string Default = GroupName + ".CustomerCare";
        public const string View = Default + ".View";
        public const string Create = Default + ".Create";
        public const string Manage = Default + ".Manage";
    }

    public static class Staff
    {
        public const string Default = GroupName + ".Staff";
        public const string View = Default + ".View";
        public const string Manage = Default + ".Manage";
    }

    public static class BranchManager
    {
        public const string Default = GroupName + ".BranchManager";
        public const string View = Default + ".View";
        public const string Manage = Default + ".Manage";
    }

    public static class Finance
    {
        public const string Default = GroupName + ".Finance";
        public const string View = Default + ".View";
        public const string Manage = Default + ".Manage";
    }

    public static class Promotions
    {
        public const string Default = GroupName + ".Promotions";
        public const string View = Default + ".View";
        public const string Manage = Default + ".Manage";
    }

    public static class Timekeeping
    {
        public const string Default = GroupName + ".Timekeeping";
        public const string View = Default + ".View";
        public const string Manage = Default + ".Manage";
    }

    public static class Tools
    {
        public const string Default = GroupName + ".Tools";
        public const string View = Default + ".View";
        public const string Manage = Default + ".Manage";
    }

    public static class SystemAdministration
    {
        public const string Default = GroupName + ".SystemAdmin";

        public static class Users
        {
            public const string Default = SystemAdministration.Default + ".Users";
            public const string Create = Default + ".Create";
            public const string Edit = Default + ".Edit";
            public const string Delete = Default + ".Delete";
            public const string ManageRoles = Default + ".ManageRoles";
        }

        public static class Roles
        {
            public const string Default = SystemAdministration.Default + ".Roles";
            public const string Create = Default + ".Create";
            public const string Edit = Default + ".Edit";
            public const string Delete = Default + ".Delete";
            public const string ManagePermissions = Default + ".ManagePermissions";
        }

        public const string AuditLogs = Default + ".AuditLogs";
        public const string Settings = Default + ".Settings";
    }
}
