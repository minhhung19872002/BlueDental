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

        // Inventory
        var inventoryPerm = myGroup.AddPermission(
            BlueDentalPermissions.Inventory.Default,
            L("Permission:Inventory"));
        inventoryPerm.AddChild(BlueDentalPermissions.Inventory.View, L("Permission:Inventory.View"));
        inventoryPerm.AddChild(BlueDentalPermissions.Inventory.Manage, L("Permission:Inventory.Manage"));

        // Reporting
        var reportPerm = myGroup.AddPermission(
            BlueDentalPermissions.Reporting.Default,
            L("Permission:Reporting"));
        reportPerm.AddChild(BlueDentalPermissions.Reporting.View, L("Permission:Reporting.View"));
        reportPerm.AddChild(BlueDentalPermissions.Reporting.Generate, L("Permission:Reporting.Generate"));
    }

    private static LocalizableString L(string name)
    {
        return LocalizableString.Create<BlueDentalResource>(name);
    }
}
