using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Permissions;

/// <summary>
/// The reference application authorises with a CASL-style ability model:
/// pairs of <c>(action, subject)</c> returned by
/// <c>GET /api/v1/user/me/permissions</c>. This catalog mirrors that model
/// 1:1 so BlueDental can gate the same operations.
///
/// ABP permission names are derived as <c>BlueDental.&lt;subject&gt;.&lt;action&gt;</c>
/// via <see cref="Permission"/>, and registered by
/// <c>BlueDentalPermissionDefinitionProvider</c>.
///
/// Source: docs/clone/permissions.md (observed read-only, role <c>clinicAdmin</c>).
/// </summary>
public static class BlueDentalAbilities
{
    public const string GroupName = "BlueDental.Abilities";

    /// <summary>Every action verb used by the reference ability model.</summary>
    public static class Actions
    {
        public const string Read = "read";
        public const string Create = "create";
        public const string Update = "update";
        public const string Delete = "delete";
        public const string Export = "export";
        public const string Approve = "approve";
        public const string Finalize = "finalize";
        public const string Print = "print";
        public const string Continue = "continue";
        public const string Complete = "complete";
        public const string Deposit = "deposit";
        public const string Withdraw = "withdraw";
        public const string Transfer = "transfer";
        public const string HidePhone = "hidePhone";
        public const string AttendanceOthers = "attendanceOthers";
        public const string Manage = "manage";
    }

    /// <summary>Every subject the reference exposes.</summary>
    public static class Subjects
    {
        public const string Account = "account";
        public const string Appointment = "appointment";
        public const string BranchManager = "branchManager";
        public const string CatalogConsultation = "catalogConsultation";
        public const string CatalogDiagnosis = "catalogDiagnosis";
        public const string CatalogHistory = "catalogHistory";
        public const string CatalogMedicine = "catalogMedicine";
        public const string CatalogOccupation = "catalogOccupation";
        public const string CatalogPaymentMethod = "catalogPaymentMethod";
        public const string CatalogPost = "catalogPost";
        public const string CatalogPrescription = "catalogPrescription";
        public const string CatalogRecordTag = "catalogRecordTag";
        public const string CatalogService = "catalogService";
        public const string CatalogSource = "catalogSource";
        public const string CatalogTemplate = "catalogTemplate";
        public const string Chatbot = "chatbot";
        public const string CskhCare = "cskhCare";
        public const string CskhGroup = "cskhGroup";
        public const string HelpSupport = "helpSupport";
        public const string LaboBite = "laboBite";
        public const string LaboFinishLine = "laboFinishLine";
        public const string LaboMaterial = "laboMaterial";
        public const string LaboRhythm = "laboRhythm";
        public const string LaboSupplier = "laboSupplier";
        public const string LaboTemplate = "laboTemplate";
        public const string Materials = "materials";
        public const string OperationsAssistantHome = "operationsAssistantHome";
        public const string OperationsAssistantProcess = "operationsAssistantProcess";
        public const string OperationsAssistantTask = "operationsAssistantTask";
        public const string OperationsCskhHome = "operationsCskhHome";
        public const string OperationsCskhProcess = "operationsCskhProcess";
        public const string OperationsCskhReport = "operationsCskhReport";
        public const string OperationsCskhTask = "operationsCskhTask";
        public const string OperationsFinanceAccess = "operationsFinanceAccess";
        public const string OperationsFinanceHome = "operationsFinanceHome";
        public const string OperationsFinanceInvoice = "operationsFinanceInvoice";
        public const string OperationsFinanceProcess = "operationsFinanceProcess";
        public const string OperationsFinanceServiceComplete = "operationsFinanceServiceComplete";
        public const string OperationsFinanceTask = "operationsFinanceTask";
        public const string OperationsMarketingHome = "operationsMarketingHome";
        public const string OperationsMarketingProcess = "operationsMarketingProcess";
        public const string OperationsMarketingReport = "operationsMarketingReport";
        public const string OperationsMarketingTask = "operationsMarketingTask";
        public const string OperationsOverviewDiagnosis = "operationsOverviewDiagnosis";
        public const string OperationsOverviewHome = "operationsOverviewHome";
        public const string OperationsOverviewPrescription = "operationsOverviewPrescription";
        public const string OperationsOverviewProcess = "operationsOverviewProcess";
        public const string OperationsOverviewReport = "operationsOverviewReport";
        public const string OperationsOverviewTask = "operationsOverviewTask";
        public const string OperationsReceptionHome = "operationsReceptionHome";
        public const string OperationsReceptionProcess = "operationsReceptionProcess";
        public const string OperationsReceptionReport = "operationsReceptionReport";
        public const string OperationsReceptionTask = "operationsReceptionTask";
        public const string OperationsSecurityHome = "operationsSecurityHome";
        public const string OperationsSecurityProcess = "operationsSecurityProcess";
        public const string OperationsSecurityTask = "operationsSecurityTask";
        public const string OperationsTreatmentAccess = "operationsTreatmentAccess";
        public const string OperationsTreatmentHome = "operationsTreatmentHome";
        public const string OperationsTreatmentProcess = "operationsTreatmentProcess";
        public const string OperationsTreatmentReport = "operationsTreatmentReport";
        public const string OperationsTreatmentTask = "operationsTreatmentTask";
        public const string Patient = "patient";
        public const string Payment = "payment";
        public const string Prescription = "prescription";
        public const string Reception = "reception";
        public const string ReportCashflowCategory = "reportCashflowCategory";
        public const string ReportCost = "reportCost";
        public const string ReportIncome = "reportIncome";
        public const string ReportResult = "reportResult";
        public const string ReportSales = "reportSales";
        public const string ReportTransfer = "reportTransfer";
        public const string ReportTransferCategory = "reportTransferCategory";
        public const string RolePermission = "rolePermission";
        public const string Staff = "staff";
        public const string ToolCall = "toolCall";
        public const string ToolMessage = "toolMessage";
        public const string TreatmentConsultation = "treatmentConsultation";
        public const string TreatmentCskh = "treatmentCskh";
        public const string TreatmentDiagnosis = "treatmentDiagnosis";
        public const string TreatmentImage = "treatmentImage";
        public const string TreatmentLabo = "treatmentLabo";
        public const string TreatmentStage = "treatmentStage";
        public const string Voucher = "voucher";
        public const string WorkSchedule = "workSchedule";
    }

    /// <summary>
    /// Subject -> the actions that subject supports. Taken verbatim from the
    /// reference's <c>clinicAdmin</c> ability set, which covers every subject.
    /// </summary>
    public static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> Catalog =
        new Dictionary<string, IReadOnlyList<string>>
    {
        ["account"] = [Actions.Read, Actions.Update],
        ["appointment"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        // BlueDental-local: the reference has no branchManager subject.
        ["branchManager"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete],
        ["catalogConsultation"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["catalogDiagnosis"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["catalogHistory"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["catalogMedicine"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["catalogOccupation"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete],
        ["catalogPaymentMethod"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete],
        ["catalogPost"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete],
        ["catalogPrescription"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["catalogRecordTag"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete],
        ["catalogService"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["catalogSource"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["catalogTemplate"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["chatbot"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Approve, Actions.Manage],
        ["cskhCare"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Export],
        ["cskhGroup"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Export],
        ["helpSupport"] = [Actions.Read],
        ["laboBite"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["laboFinishLine"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["laboMaterial"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["laboRhythm"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["laboSupplier"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["laboTemplate"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Export],
        ["materials"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Approve, Actions.Export],
        ["operationsAssistantHome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsAssistantProcess"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsAssistantTask"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsCskhHome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsCskhProcess"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsCskhReport"] = [Actions.Read, Actions.Export],
        ["operationsCskhTask"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsFinanceAccess"] = [Actions.Read, Actions.Export],
        ["operationsFinanceHome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsFinanceInvoice"] = [Actions.Read, Actions.Export],
        ["operationsFinanceProcess"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsFinanceServiceComplete"] = [Actions.Read, Actions.Export],
        ["operationsFinanceTask"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsMarketingHome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsMarketingProcess"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsMarketingReport"] = [Actions.Read, Actions.Export],
        ["operationsMarketingTask"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsOverviewDiagnosis"] = [Actions.Read, Actions.Export],
        ["operationsOverviewHome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsOverviewPrescription"] = [Actions.Read, Actions.Export],
        ["operationsOverviewProcess"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsOverviewReport"] = [Actions.Read, Actions.Export],
        ["operationsOverviewTask"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsReceptionHome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsReceptionProcess"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsReceptionReport"] = [Actions.Read, Actions.Export],
        ["operationsReceptionTask"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsSecurityHome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsSecurityProcess"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsSecurityTask"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsTreatmentAccess"] = [Actions.Read, Actions.Export],
        ["operationsTreatmentHome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsTreatmentProcess"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["operationsTreatmentReport"] = [Actions.Read, Actions.Export],
        ["operationsTreatmentTask"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["patient"] = [Actions.Read, Actions.Create, Actions.Update, Actions.HidePhone, Actions.Export],
        ["payment"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export, Actions.Finalize],
        ["prescription"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["reception"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["reportCashflowCategory"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["reportCost"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Approve, Actions.Export],
        ["reportIncome"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["reportResult"] = [Actions.Read, Actions.Export],
        ["reportSales"] = [Actions.Read, Actions.Export],
        ["reportTransfer"] = [Actions.Read, Actions.Update, Actions.Delete, Actions.Deposit, Actions.Withdraw, Actions.Transfer, Actions.Export],
        ["reportTransferCategory"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete],
        ["rolePermission"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete],
        ["staff"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["toolCall"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["toolMessage"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["treatmentConsultation"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Print],
        ["treatmentCskh"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["treatmentDiagnosis"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete],
        ["treatmentImage"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["treatmentLabo"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["treatmentStage"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Continue, Actions.Complete, Actions.Print],
        ["voucher"] = [Actions.Read, Actions.Create, Actions.Update, Actions.Delete, Actions.Export],
        ["workSchedule"] = [Actions.Read, Actions.Update, Actions.AttendanceOthers],
    };

    /// <summary>ABP permission name for one ability pair.</summary>
    public static string Permission(string subject, string action) =>
        $"BlueDental.{subject}.{action}";

    /// <summary>ABP permission name of the subject group itself.</summary>
    public static string SubjectPermission(string subject) => $"BlueDental.{subject}";

    /// <summary>All ability pairs, flattened.</summary>
    public static IEnumerable<(string Subject, string Action)> All() =>
        Catalog.SelectMany(pair => pair.Value.Select(action => (pair.Key, action)));

    public static bool Supports(string subject, string action) =>
        Catalog.TryGetValue(subject, out var actions) && actions.Contains(action);
}
