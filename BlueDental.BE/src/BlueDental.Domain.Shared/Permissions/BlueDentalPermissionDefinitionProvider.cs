using BlueDental.Localization;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.Localization;

namespace BlueDental.Permissions;

public class BlueDentalPermissionDefinitionProvider : PermissionDefinitionProvider
{
    public override void Define(IPermissionDefinitionContext context)
    {
        var myGroup = context.AddGroup(
            BlueDentalPermissions.GroupName,
            L("Permission:BlueDental"));

        // Organizations
        var orgPerm = myGroup.AddPermission(
            BlueDentalPermissions.Organizations.Default,
            L("Permission:Organizations"));
        orgPerm.AddChild(BlueDentalPermissions.Organizations.View, L("Permission:Organizations.View"));
        orgPerm.AddChild(BlueDentalPermissions.Organizations.Create, L("Permission:Organizations.Create"));
        orgPerm.AddChild(BlueDentalPermissions.Organizations.Edit, L("Permission:Organizations.Edit"));
        orgPerm.AddChild(BlueDentalPermissions.Organizations.Delete, L("Permission:Organizations.Delete"));

        // Catalogs
        var catPerm = myGroup.AddPermission(
            BlueDentalPermissions.Catalogs.Default,
            L("Permission:Catalogs"));
        catPerm.AddChild(BlueDentalPermissions.Catalogs.View, L("Permission:Catalogs.View"));
        catPerm.AddChild(BlueDentalPermissions.Catalogs.Create, L("Permission:Catalogs.Create"));
        catPerm.AddChild(BlueDentalPermissions.Catalogs.Edit, L("Permission:Catalogs.Edit"));
        catPerm.AddChild(BlueDentalPermissions.Catalogs.Delete, L("Permission:Catalogs.Delete"));

        // Patient Management
        var patientMgmt = myGroup.AddPermission(
            BlueDentalPermissions.PatientManagement.Default,
            L("Permission:PatientManagement"));
        var patientPerm = patientMgmt.AddChild(
            BlueDentalPermissions.PatientManagement.Patients.Default,
            L("Permission:Patients"));
        patientPerm.AddChild(BlueDentalPermissions.PatientManagement.Patients.View, L("Permission:Patients.View"));
        patientPerm.AddChild(BlueDentalPermissions.PatientManagement.Patients.Create, L("Permission:Patients.Create"));
        patientPerm.AddChild(BlueDentalPermissions.PatientManagement.Patients.Edit, L("Permission:Patients.Edit"));
        patientPerm.AddChild(BlueDentalPermissions.PatientManagement.Patients.Delete, L("Permission:Patients.Delete"));

        // Appointments
        var apptPerm = myGroup.AddPermission(
            BlueDentalPermissions.Appointments.Default,
            L("Permission:Appointments"));
        apptPerm.AddChild(BlueDentalPermissions.Appointments.View, L("Permission:Appointments.View"));
        apptPerm.AddChild(BlueDentalPermissions.Appointments.Create, L("Permission:Appointments.Create"));
        apptPerm.AddChild(BlueDentalPermissions.Appointments.Edit, L("Permission:Appointments.Edit"));
        apptPerm.AddChild(BlueDentalPermissions.Appointments.Delete, L("Permission:Appointments.Delete"));
        apptPerm.AddChild(BlueDentalPermissions.Appointments.Confirm, L("Permission:Appointments.Confirm"));
        apptPerm.AddChild(BlueDentalPermissions.Appointments.Cancel, L("Permission:Appointments.Cancel"));
        apptPerm.AddChild(BlueDentalPermissions.Appointments.CheckIn, L("Permission:Appointments.CheckIn"));
        apptPerm.AddChild(BlueDentalPermissions.Appointments.Complete, L("Permission:Appointments.Complete"));

        // Treatment Management
        var treatmentMgmt = myGroup.AddPermission(
            BlueDentalPermissions.TreatmentManagement.Default,
            L("Permission:TreatmentManagement"));
        var planPerm = treatmentMgmt.AddChild(
            BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Default,
            L("Permission:TreatmentPlans"));
        planPerm.AddChild(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.View, L("Permission:TreatmentPlans.View"));
        planPerm.AddChild(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Create, L("Permission:TreatmentPlans.Create"));
        planPerm.AddChild(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit, L("Permission:TreatmentPlans.Edit"));
        planPerm.AddChild(BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Approve, L("Permission:TreatmentPlans.Approve"));

        // Treatment Records (child of TreatmentManagement)
        var recordPerm = treatmentMgmt.AddChild(
            BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Default,
            L("Permission:TreatmentRecords"));
        recordPerm.AddChild(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.View, L("Permission:TreatmentRecords.View"));
        recordPerm.AddChild(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Create, L("Permission:TreatmentRecords.Create"));
        recordPerm.AddChild(BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Edit, L("Permission:TreatmentRecords.Edit"));

        // Prescriptions (child of TreatmentManagement)
        var rxPerm = treatmentMgmt.AddChild(
            BlueDentalPermissions.TreatmentManagement.Prescriptions.Default,
            L("Permission:Prescriptions"));
        rxPerm.AddChild(BlueDentalPermissions.TreatmentManagement.Prescriptions.View, L("Permission:Prescriptions.View"));
        rxPerm.AddChild(BlueDentalPermissions.TreatmentManagement.Prescriptions.Create, L("Permission:Prescriptions.Create"));
        rxPerm.AddChild(BlueDentalPermissions.TreatmentManagement.Prescriptions.Dispense, L("Permission:Prescriptions.Dispense"));

        // Billing
        var billingPerm = myGroup.AddPermission(
            BlueDentalPermissions.Billing.Default,
            L("Permission:Billing"));
        var invoicePerm = billingPerm.AddChild(
            BlueDentalPermissions.Billing.Invoices.Default,
            L("Permission:Billing.Invoices"));
        invoicePerm.AddChild(BlueDentalPermissions.Billing.Invoices.View, L("Permission:Billing.View"));
        invoicePerm.AddChild(BlueDentalPermissions.Billing.Invoices.Create, L("Permission:Billing.Create"));
        invoicePerm.AddChild(BlueDentalPermissions.Billing.Invoices.Edit, L("Permission:Billing.Edit"));
        invoicePerm.AddChild(BlueDentalPermissions.Billing.Invoices.Process, L("Permission:Billing.Process"));
        invoicePerm.AddChild(BlueDentalPermissions.Billing.Invoices.Void, L("Permission:Billing.Void"));

        // Insurance Claims (child of Billing)
        var claimPerm = billingPerm.AddChild(
            BlueDentalPermissions.Billing.InsuranceClaims.Default,
            L("Permission:InsuranceClaims"));
        claimPerm.AddChild(BlueDentalPermissions.Billing.InsuranceClaims.View, L("Permission:InsuranceClaims.View"));
        claimPerm.AddChild(BlueDentalPermissions.Billing.InsuranceClaims.Submit, L("Permission:InsuranceClaims.Submit"));
        claimPerm.AddChild(BlueDentalPermissions.Billing.InsuranceClaims.Process, L("Permission:InsuranceClaims.Process"));

        // Inventory
        var inventoryPerm = myGroup.AddPermission(
            BlueDentalPermissions.Inventory.Default,
            L("Permission:Inventory"));
        inventoryPerm.AddChild(BlueDentalPermissions.Inventory.View, L("Permission:Inventory.View"));
        inventoryPerm.AddChild(BlueDentalPermissions.Inventory.Manage, L("Permission:Inventory.Manage"));
        inventoryPerm.AddChild(BlueDentalPermissions.Inventory.AdjustStock, L("Permission:Inventory.AdjustStock"));

        // Reporting
        var reportPerm = myGroup.AddPermission(
            BlueDentalPermissions.Reporting.Default,
            L("Permission:Reporting"));
        reportPerm.AddChild(BlueDentalPermissions.Reporting.View, L("Permission:Reporting.View"));
        reportPerm.AddChild(BlueDentalPermissions.Reporting.Generate, L("Permission:Reporting.Generate"));
        reportPerm.AddChild(BlueDentalPermissions.Reporting.Export, L("Permission:Reporting.Export"));

        // Visits
        var visitPerm = myGroup.AddPermission(
            BlueDentalPermissions.Visits.Default,
            L("Permission:Visits"));
        visitPerm.AddChild(BlueDentalPermissions.Visits.View, L("Permission:Visits.View"));
        visitPerm.AddChild(BlueDentalPermissions.Visits.Create, L("Permission:Visits.Create"));
        visitPerm.AddChild(BlueDentalPermissions.Visits.Edit, L("Permission:Visits.Edit"));
        visitPerm.AddChild(BlueDentalPermissions.Visits.Workflow, L("Permission:Visits.Workflow"));

        // Labo Orders
        var laboPerm = myGroup.AddPermission(
            BlueDentalPermissions.LaboOrders.Default,
            L("Permission:LaboOrders"));
        laboPerm.AddChild(BlueDentalPermissions.LaboOrders.View, L("Permission:LaboOrders.View"));
        laboPerm.AddChild(BlueDentalPermissions.LaboOrders.Create, L("Permission:LaboOrders.Create"));
        laboPerm.AddChild(BlueDentalPermissions.LaboOrders.Edit, L("Permission:LaboOrders.Edit"));
        laboPerm.AddChild(BlueDentalPermissions.LaboOrders.Workflow, L("Permission:LaboOrders.Workflow"));

        // Customer Care
        var carePerm = myGroup.AddPermission(
            BlueDentalPermissions.CustomerCare.Default,
            L("Permission:CustomerCare"));
        carePerm.AddChild(BlueDentalPermissions.CustomerCare.View, L("Permission:CustomerCare.View"));
        carePerm.AddChild(BlueDentalPermissions.CustomerCare.Create, L("Permission:CustomerCare.Create"));
        carePerm.AddChild(BlueDentalPermissions.CustomerCare.Manage, L("Permission:CustomerCare.Manage"));

        // Staff
        var staffPerm = myGroup.AddPermission(
            BlueDentalPermissions.Staff.Default,
            L("Permission:Staff"));
        staffPerm.AddChild(BlueDentalPermissions.Staff.View, L("Permission:Staff.View"));
        staffPerm.AddChild(BlueDentalPermissions.Staff.Manage, L("Permission:Staff.Manage"));

        // Finance
        var financePerm = myGroup.AddPermission(
            BlueDentalPermissions.Finance.Default,
            L("Permission:Finance"));
        financePerm.AddChild(BlueDentalPermissions.Finance.View, L("Permission:Finance.View"));
        financePerm.AddChild(BlueDentalPermissions.Finance.Manage, L("Permission:Finance.Manage"));

        // Promotions
        var promoPerm = myGroup.AddPermission(
            BlueDentalPermissions.Promotions.Default,
            L("Permission:Promotions"));
        promoPerm.AddChild(BlueDentalPermissions.Promotions.View, L("Permission:Promotions.View"));
        promoPerm.AddChild(BlueDentalPermissions.Promotions.Manage, L("Permission:Promotions.Manage"));

        // Timekeeping
        var tkPerm = myGroup.AddPermission(
            BlueDentalPermissions.Timekeeping.Default,
            L("Permission:Timekeeping"));
        tkPerm.AddChild(BlueDentalPermissions.Timekeeping.View, L("Permission:Timekeeping.View"));
        tkPerm.AddChild(BlueDentalPermissions.Timekeeping.Manage, L("Permission:Timekeeping.Manage"));

        // Tools
        var toolsPerm = myGroup.AddPermission(
            BlueDentalPermissions.Tools.Default,
            L("Permission:Tools"));
        toolsPerm.AddChild(BlueDentalPermissions.Tools.View, L("Permission:Tools.View"));
        toolsPerm.AddChild(BlueDentalPermissions.Tools.Manage, L("Permission:Tools.Manage"));

        // System Administration
        var sysAdminPerm = myGroup.AddPermission(
            BlueDentalPermissions.SystemAdministration.Default,
            L("Permission:SystemAdmin"));
        var userPerm = sysAdminPerm.AddChild(
            BlueDentalPermissions.SystemAdministration.Users.Default,
            L("Permission:SystemAdmin.Users"));
        userPerm.AddChild(BlueDentalPermissions.SystemAdministration.Users.Create, L("Permission:SystemAdmin.Users.Create"));
        userPerm.AddChild(BlueDentalPermissions.SystemAdministration.Users.Edit, L("Permission:SystemAdmin.Users.Edit"));
        userPerm.AddChild(BlueDentalPermissions.SystemAdministration.Users.Delete, L("Permission:SystemAdmin.Users.Delete"));
        userPerm.AddChild(BlueDentalPermissions.SystemAdministration.Users.ManageRoles, L("Permission:SystemAdmin.Users.ManageRoles"));
        var rolePerm = sysAdminPerm.AddChild(
            BlueDentalPermissions.SystemAdministration.Roles.Default,
            L("Permission:SystemAdmin.Roles"));
        rolePerm.AddChild(BlueDentalPermissions.SystemAdministration.Roles.Create, L("Permission:SystemAdmin.Roles.Create"));
        rolePerm.AddChild(BlueDentalPermissions.SystemAdministration.Roles.Edit, L("Permission:SystemAdmin.Roles.Edit"));
        rolePerm.AddChild(BlueDentalPermissions.SystemAdministration.Roles.Delete, L("Permission:SystemAdmin.Roles.Delete"));
        rolePerm.AddChild(BlueDentalPermissions.SystemAdministration.Roles.ManagePermissions, L("Permission:SystemAdmin.Roles.ManagePermissions"));
        sysAdminPerm.AddChild(BlueDentalPermissions.SystemAdministration.AuditLogs, L("Permission:SystemAdmin.AuditLogs"));
        sysAdminPerm.AddChild(BlueDentalPermissions.SystemAdministration.Settings, L("Permission:SystemAdmin.Settings"));

        // Medical History (child of PatientManagement)
        var mhPerm = patientMgmt.AddChild(
            BlueDentalPermissions.PatientManagement.MedicalHistory.Default,
            L("Permission:MedicalHistory"));
        mhPerm.AddChild(BlueDentalPermissions.PatientManagement.MedicalHistory.View, L("Permission:MedicalHistory.View"));
        mhPerm.AddChild(BlueDentalPermissions.PatientManagement.MedicalHistory.Manage, L("Permission:MedicalHistory.Manage"));

        DefineAbilities(context);
    }

    /// <summary>
    /// Registers the reference application's (action, subject) ability model as
    /// ABP permissions, one group with a permission per subject and a child per
    /// supported action. See <see cref="BlueDentalAbilities"/>.
    /// </summary>
    private static void DefineAbilities(IPermissionDefinitionContext context)
    {
        var abilityGroup = context.AddGroup(
            BlueDentalAbilities.GroupName,
            L("Permission:Abilities"));

        foreach (var (subject, actions) in BlueDentalAbilities.Catalog)
        {
            var subjectPermission = abilityGroup.AddPermission(
                BlueDentalAbilities.SubjectPermission(subject),
                L($"Permission:Subject:{subject}"));

            foreach (var action in actions)
            {
                subjectPermission.AddChild(
                    BlueDentalAbilities.Permission(subject, action),
                    L($"Permission:Action:{action}"));
            }
        }
    }

    private static LocalizableString L(string name)
    {
        return LocalizableString.Create<BlueDentalResource>(name);
    }
}
