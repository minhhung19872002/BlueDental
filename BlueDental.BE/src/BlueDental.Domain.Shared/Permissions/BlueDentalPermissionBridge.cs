using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Permissions;

/// <summary>
/// Maps the legacy module permissions (<see cref="BlueDentalPermissions"/>,
/// the names most AppServices still carry in their <c>[Authorize]</c>
/// attributes) onto the ability leaves the Phân quyền screen actually grants
/// (<see cref="BlueDentalAbilities"/>, <c>BlueDental.&lt;subject&gt;.&lt;action&gt;</c>).
///
/// The Phân quyền tab only ever writes ability leaves. Before this bridge a
/// custom role could tick every box and still be refused by every service
/// guarded with a legacy name, because those names were seeded to the three
/// static roles only. A legacy permission is treated as granted when ANY of
/// its listed abilities is granted: the legacy names are coarser than the
/// ability tree, so a one-to-many "any of" mapping is the only faithful one.
///
/// <c>SystemAdministration.Users</c> and <c>AuditLogs</c> stay with the roles
/// that hold those names directly. <c>SystemAdministration.Roles</c> and the
/// matching <c>AbpIdentity.Roles</c> names are bridged to <c>rolePermission</c>
/// so the Phân quyền tab works for custom roles.
///
/// ASSUMPTIONS (the reference has no legacy layer, so these pairings are ours):
/// Organizations = branchManager (the seeder already pairs their Create
/// exclusions); Catalogs = any catalog subject; TreatmentPlans/Records =
/// the treatment tab subjects; Billing = payment; Inventory = materials;
/// Reporting/Finance = the report subjects; Timekeeping = workSchedule;
/// Tools = toolCall/toolMessage/chatbot.
/// </summary>
public static class BlueDentalPermissionBridge
{
    private static string P(string subject, string action) => BlueDentalAbilities.Permission(subject, action);

    /// <summary>
    /// Every (subject, action) pair the catalog actually defines. A group such
    /// as the finance reports mixes subjects with different action sets, so
    /// unsupported pairs are dropped instead of becoming dead leaves.
    /// </summary>
    private static IReadOnlyList<string> Each(IEnumerable<string> subjects, params string[] actions) =>
        subjects
            .SelectMany(s => actions.Where(a => BlueDentalAbilities.Supports(s, a)).Select(a => P(s, a)))
            .Distinct()
            .ToList();

    private static readonly string[] CatalogSubjects =
    [
        BlueDentalAbilities.Subjects.CatalogService,
        BlueDentalAbilities.Subjects.CatalogDiagnosis,
        BlueDentalAbilities.Subjects.CatalogMedicine,
        BlueDentalAbilities.Subjects.CatalogConsultation,
        BlueDentalAbilities.Subjects.CatalogSource,
        BlueDentalAbilities.Subjects.CatalogHistory,
        BlueDentalAbilities.Subjects.CatalogOccupation,
        BlueDentalAbilities.Subjects.CatalogPrescription,
        BlueDentalAbilities.Subjects.CatalogTemplate,
        BlueDentalAbilities.Subjects.CatalogRecordTag,
        BlueDentalAbilities.Subjects.CatalogPaymentMethod,
        BlueDentalAbilities.Subjects.CatalogPost,
    ];

    private static readonly string[] TreatmentSubjects =
    [
        BlueDentalAbilities.Subjects.TreatmentStage,
        BlueDentalAbilities.Subjects.TreatmentDiagnosis,
        BlueDentalAbilities.Subjects.TreatmentConsultation,
    ];

    private static readonly string[] TreatmentRecordSubjects =
    [
        BlueDentalAbilities.Subjects.TreatmentStage,
        BlueDentalAbilities.Subjects.TreatmentDiagnosis,
        BlueDentalAbilities.Subjects.TreatmentConsultation,
        BlueDentalAbilities.Subjects.PatientMedicalRecord,
        BlueDentalAbilities.Subjects.TreatmentImage,
        BlueDentalAbilities.Subjects.TreatmentCskh,
    ];

    private static readonly string[] LaboSubjects =
    [
        BlueDentalAbilities.Subjects.TreatmentLabo,
        "laboTemplate", "laboMaterial", "laboSupplier", "laboBite", "laboFinishLine", "laboRhythm",
    ];

    private static readonly string[] ReportSubjects =
    [
        "reportSales", "reportIncome", "reportCost", "reportResult", "reportTransfer",
    ];

    private static readonly string[] FinanceSubjects =
    [
        "reportSales", "reportIncome", "reportCost", "reportResult", "reportTransfer",
        "reportCashflowCategory", "reportTransferCategory",
    ];

    private static readonly string[] CskhSubjects = ["cskhCare", "cskhGroup"];

    private static readonly string[] ToolSubjects =
    [
        BlueDentalAbilities.Subjects.ToolCall,
        BlueDentalAbilities.Subjects.ToolMessage,
        "chatbot", "chatbotKnowledge",
    ];

    private const string Read = BlueDentalAbilities.Actions.Read;
    private const string Create = BlueDentalAbilities.Actions.Create;
    private const string Update = BlueDentalAbilities.Actions.Update;
    private const string Delete = BlueDentalAbilities.Actions.Delete;
    private const string Export = BlueDentalAbilities.Actions.Export;
    private const string Approve = BlueDentalAbilities.Actions.Approve;

    /// <summary>Legacy permission name to the ability names any one of which grants it.</summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> Map =
        new Dictionary<string, IReadOnlyList<string>>
        {
            // Organizations (clinic branches, departments) = branchManager
            [BlueDentalPermissions.Organizations.Default] = Each([BlueDentalAbilities.Subjects.BranchManager], Read),
            [BlueDentalPermissions.Organizations.View] = Each([BlueDentalAbilities.Subjects.BranchManager], Read),
            [BlueDentalPermissions.Organizations.Create] = Each([BlueDentalAbilities.Subjects.BranchManager], Create),
            [BlueDentalPermissions.Organizations.Edit] = Each([BlueDentalAbilities.Subjects.BranchManager], Update),
            [BlueDentalPermissions.Organizations.Delete] = Each([BlueDentalAbilities.Subjects.BranchManager], Delete),

            // Catalogs (Danh mục) = any catalog subject
            [BlueDentalPermissions.Catalogs.Default] = Each(CatalogSubjects, Read),
            [BlueDentalPermissions.Catalogs.View] = Each(CatalogSubjects, Read),
            [BlueDentalPermissions.Catalogs.Create] = Each(CatalogSubjects, Create),
            [BlueDentalPermissions.Catalogs.Edit] = Each(CatalogSubjects, Update),
            [BlueDentalPermissions.Catalogs.Delete] = Each(CatalogSubjects, Delete),

            // Patients
            [BlueDentalPermissions.PatientManagement.Default] = Each(["patient"], Read),
            [BlueDentalPermissions.PatientManagement.Patients.Default] = Each(["patient"], Read),
            [BlueDentalPermissions.PatientManagement.Patients.View] = Each(["patient"], Read),
            [BlueDentalPermissions.PatientManagement.Patients.Create] = Each(["patient"], Create),
            [BlueDentalPermissions.PatientManagement.Patients.Edit] = Each(["patient"], Update),
            // The reference never deletes a patient; editing is the closest right.
            [BlueDentalPermissions.PatientManagement.Patients.Delete] = Each(["patient"], Update),
            [BlueDentalPermissions.PatientManagement.MedicalHistory.Default] = Each([BlueDentalAbilities.Subjects.PatientMedicalRecord], Read),
            [BlueDentalPermissions.PatientManagement.MedicalHistory.View] = Each([BlueDentalAbilities.Subjects.PatientMedicalRecord], Read),
            [BlueDentalPermissions.PatientManagement.MedicalHistory.Manage] = Each([BlueDentalAbilities.Subjects.PatientMedicalRecord], Create, Update, Delete),

            // Appointments
            [BlueDentalPermissions.Appointments.Default] = Each([BlueDentalAbilities.Subjects.Appointment], Read),
            [BlueDentalPermissions.Appointments.View] = Each([BlueDentalAbilities.Subjects.Appointment], Read),
            [BlueDentalPermissions.Appointments.Create] = Each([BlueDentalAbilities.Subjects.Appointment], Create),
            [BlueDentalPermissions.Appointments.Edit] = Each([BlueDentalAbilities.Subjects.Appointment], Update),
            [BlueDentalPermissions.Appointments.Delete] = Each([BlueDentalAbilities.Subjects.Appointment], Delete),
            [BlueDentalPermissions.Appointments.Confirm] = Each([BlueDentalAbilities.Subjects.Appointment], Update),
            [BlueDentalPermissions.Appointments.Cancel] = Each([BlueDentalAbilities.Subjects.Appointment], Update),
            [BlueDentalPermissions.Appointments.CheckIn] = Each([BlueDentalAbilities.Subjects.Appointment], Update),
            [BlueDentalPermissions.Appointments.Complete] = Each([BlueDentalAbilities.Subjects.Appointment], Update),

            // Treatment (Điều trị tab subjects)
            [BlueDentalPermissions.TreatmentManagement.Default] = Each(TreatmentRecordSubjects, Read),
            [BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Default] = Each(TreatmentSubjects, Read),
            [BlueDentalPermissions.TreatmentManagement.TreatmentPlans.View] = Each(TreatmentSubjects, Read),
            [BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Create] = Each(TreatmentSubjects, Create),
            [BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Edit] = Each(TreatmentSubjects, Update),
            [BlueDentalPermissions.TreatmentManagement.TreatmentPlans.Approve] =
            [
                P(BlueDentalAbilities.Subjects.TreatmentStage, BlueDentalAbilities.Actions.Complete),
                P(BlueDentalAbilities.Subjects.TreatmentStage, Update),
            ],
            [BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Default] = Each(TreatmentRecordSubjects, Read),
            [BlueDentalPermissions.TreatmentManagement.TreatmentRecords.View] = Each(TreatmentRecordSubjects, Read),
            [BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Create] = Each(TreatmentRecordSubjects, Create),
            [BlueDentalPermissions.TreatmentManagement.TreatmentRecords.Edit] = Each(TreatmentRecordSubjects, Update),
            [BlueDentalPermissions.TreatmentManagement.Prescriptions.Default] = Each(["prescription"], Read),
            [BlueDentalPermissions.TreatmentManagement.Prescriptions.View] = Each(["prescription"], Read),
            [BlueDentalPermissions.TreatmentManagement.Prescriptions.Create] = Each(["prescription"], Create),
            [BlueDentalPermissions.TreatmentManagement.Prescriptions.Dispense] = Each(["prescription"], Update),

            // Billing = payment
            [BlueDentalPermissions.Billing.Default] = Each(["payment"], Read),
            [BlueDentalPermissions.Billing.Invoices.Default] = Each(["payment"], Read),
            [BlueDentalPermissions.Billing.Invoices.View] = Each(["payment"], Read),
            [BlueDentalPermissions.Billing.Invoices.Create] = Each(["payment"], Create),
            [BlueDentalPermissions.Billing.Invoices.Edit] = Each(["payment"], Update),
            [BlueDentalPermissions.Billing.Invoices.Process] = Each(["payment"], Create, BlueDentalAbilities.Actions.Finalize),
            [BlueDentalPermissions.Billing.Invoices.Void] = Each(["payment"], Delete),
            [BlueDentalPermissions.Billing.InsuranceClaims.Default] = Each(["payment"], Read),
            [BlueDentalPermissions.Billing.InsuranceClaims.View] = Each(["payment"], Read),
            [BlueDentalPermissions.Billing.InsuranceClaims.Submit] = Each(["payment"], Create),
            [BlueDentalPermissions.Billing.InsuranceClaims.Process] = Each(["payment"], BlueDentalAbilities.Actions.Finalize, Update),

            // Inventory = materials
            [BlueDentalPermissions.Inventory.Default] = Each(["materials"], Read),
            [BlueDentalPermissions.Inventory.View] = Each(["materials"], Read),
            [BlueDentalPermissions.Inventory.Manage] = Each(["materials"], Create, Update, Delete),
            [BlueDentalPermissions.Inventory.AdjustStock] = Each(["materials"], Update, Approve),

            // Reporting = the /report subjects
            [BlueDentalPermissions.Reporting.Default] = Each(ReportSubjects, Read),
            [BlueDentalPermissions.Reporting.View] = Each(ReportSubjects, Read),
            [BlueDentalPermissions.Reporting.Generate] = Each(ReportSubjects, Read),
            [BlueDentalPermissions.Reporting.Export] = Each(ReportSubjects, Export),

            // Labo
            [BlueDentalPermissions.LaboOrders.Default] = Each(LaboSubjects, Read),
            [BlueDentalPermissions.LaboOrders.View] = Each(LaboSubjects, Read),
            [BlueDentalPermissions.LaboOrders.Create] = Each(LaboSubjects, Create),
            [BlueDentalPermissions.LaboOrders.Edit] = Each(LaboSubjects, Update),
            [BlueDentalPermissions.LaboOrders.Workflow] = Each([BlueDentalAbilities.Subjects.TreatmentLabo], Update),

            // Customer care (CSKH)
            [BlueDentalPermissions.CustomerCare.Default] = Each(CskhSubjects, Read),
            [BlueDentalPermissions.CustomerCare.View] = Each(CskhSubjects, Read),
            [BlueDentalPermissions.CustomerCare.Create] = Each(CskhSubjects, Create),
            [BlueDentalPermissions.CustomerCare.Manage] = Each(CskhSubjects, Update),

            // Staff (Nhân sự)
            [BlueDentalPermissions.Staff.Default] = Each([BlueDentalAbilities.Subjects.Staff], Read),
            [BlueDentalPermissions.Staff.View] = Each([BlueDentalAbilities.Subjects.Staff], Read),
            [BlueDentalPermissions.Staff.Manage] = Each([BlueDentalAbilities.Subjects.Staff], Create, Update, Delete),

            // Branch manager
            [BlueDentalPermissions.BranchManager.Default] = Each([BlueDentalAbilities.Subjects.BranchManager], Read),
            [BlueDentalPermissions.BranchManager.View] = Each([BlueDentalAbilities.Subjects.BranchManager], Read),
            [BlueDentalPermissions.BranchManager.Manage] = Each([BlueDentalAbilities.Subjects.BranchManager], Create, Update, Delete),

            // Finance (Thu chi, sổ quỹ, danh mục dòng tiền)
            [BlueDentalPermissions.Finance.Default] = Each(FinanceSubjects, Read),
            [BlueDentalPermissions.Finance.View] = Each(FinanceSubjects, Read),
            [BlueDentalPermissions.Finance.Manage] = Each(FinanceSubjects, Create, Update, Delete,
                BlueDentalAbilities.Actions.Deposit, BlueDentalAbilities.Actions.Withdraw, BlueDentalAbilities.Actions.Transfer),

            // Promotions = voucher
            [BlueDentalPermissions.Promotions.Default] = Each([BlueDentalAbilities.Subjects.Voucher], Read),
            [BlueDentalPermissions.Promotions.View] = Each([BlueDentalAbilities.Subjects.Voucher], Read),
            [BlueDentalPermissions.Promotions.Manage] = Each([BlueDentalAbilities.Subjects.Voucher], Create, Update, Delete),

            // Timekeeping = workSchedule
            [BlueDentalPermissions.Timekeeping.Default] = Each([BlueDentalAbilities.Subjects.WorkSchedule], Read),
            [BlueDentalPermissions.Timekeeping.View] = Each([BlueDentalAbilities.Subjects.WorkSchedule], Read),
            [BlueDentalPermissions.Timekeeping.Manage] = Each([BlueDentalAbilities.Subjects.WorkSchedule], Update, BlueDentalAbilities.Actions.AttendanceOthers),

            // Tools
            [BlueDentalPermissions.Tools.Default] = Each(ToolSubjects, Read),
            [BlueDentalPermissions.Tools.View] = Each(ToolSubjects, Read),
            [BlueDentalPermissions.Tools.Manage] = Each(ToolSubjects, Create, Update, Delete),

            // ABP Identity — the Phân quyền tab calls ABP's built-in Identity
            // and PermissionManagement endpoints, which check these names.
            // Without bridging them the tab 403s even when rolePermission is granted.
            ["AbpIdentity.Roles"] = Each([BlueDentalAbilities.Subjects.RolePermission], Read),
            ["AbpIdentity.Roles.Create"] = Each([BlueDentalAbilities.Subjects.RolePermission], Create),
            ["AbpIdentity.Roles.Update"] = Each([BlueDentalAbilities.Subjects.RolePermission], Update),
            ["AbpIdentity.Roles.Delete"] = Each([BlueDentalAbilities.Subjects.RolePermission], Delete),
            ["AbpIdentity.Roles.ManagePermissions"] = Each([BlueDentalAbilities.Subjects.RolePermission], Update),

            // Our own SystemAdmin.Roles permissions, bridged the same way so both
            // naming schemes resolve to the same ability leaves.
            [BlueDentalPermissions.SystemAdministration.Roles.Default] = Each([BlueDentalAbilities.Subjects.RolePermission], Read),
            [BlueDentalPermissions.SystemAdministration.Roles.Create] = Each([BlueDentalAbilities.Subjects.RolePermission], Create),
            [BlueDentalPermissions.SystemAdministration.Roles.Edit] = Each([BlueDentalAbilities.Subjects.RolePermission], Update),
            [BlueDentalPermissions.SystemAdministration.Roles.Delete] = Each([BlueDentalAbilities.Subjects.RolePermission], Delete),
            [BlueDentalPermissions.SystemAdministration.Roles.ManagePermissions] = Each([BlueDentalAbilities.Subjects.RolePermission], Update),
        };

    /// <summary>The abilities that stand in for <paramref name="legacyPermission"/>; empty when it is not bridged.</summary>
    public static IReadOnlyList<string> AbilitiesFor(string legacyPermission) =>
        Map.TryGetValue(legacyPermission, out var abilities) ? abilities : [];

    public static bool IsBridged(string permissionName) => Map.ContainsKey(permissionName);

    /// <summary>
    /// Every mapped ability, so a startup or test check can confirm each one
    /// really exists in <see cref="BlueDentalAbilities.Catalog"/>.
    /// </summary>
    public static IEnumerable<string> AllTargets() => Map.Values.SelectMany(v => v).Distinct();
}
