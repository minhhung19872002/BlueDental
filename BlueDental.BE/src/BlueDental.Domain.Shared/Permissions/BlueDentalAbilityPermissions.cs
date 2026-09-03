namespace BlueDental.Permissions;

/// <summary>
/// Compile-time permission names for every ability pair, so controllers and
/// application services can write
/// <c>[Authorize(BlueDentalAbilityPermissions.Patient.Export)]</c>.
///
/// Generated from the same observation as <see cref="BlueDentalAbilities"/>
/// (docs/clone/permissions.md). Attributes need constants, which
/// <c>BlueDentalAbilities.Permission(subject, action)</c> cannot provide.
/// The pairing is asserted by BlueDentalAbilityPermissionsTests.
/// </summary>
public static class BlueDentalAbilityPermissions
{
    /// <summary>Subject <c>account</c>.</summary>
    public static class Account
    {
        public const string Subject = "account";
        public const string Read = "BlueDental.account.read";
        public const string Update = "BlueDental.account.update";
    }

    /// <summary>Subject <c>appointment</c>.</summary>
    public static class Appointment
    {
        public const string Subject = "appointment";
        public const string Read = "BlueDental.appointment.read";
        public const string Create = "BlueDental.appointment.create";
        public const string Update = "BlueDental.appointment.update";
        public const string Delete = "BlueDental.appointment.delete";
        public const string Export = "BlueDental.appointment.export";
    }

    /// <summary>Subject <c>catalogConsultation</c>.</summary>
    public static class CatalogConsultation
    {
        public const string Subject = "catalogConsultation";
        public const string Read = "BlueDental.catalogConsultation.read";
        public const string Create = "BlueDental.catalogConsultation.create";
        public const string Update = "BlueDental.catalogConsultation.update";
        public const string Delete = "BlueDental.catalogConsultation.delete";
        public const string Export = "BlueDental.catalogConsultation.export";
    }

    /// <summary>Subject <c>catalogDiagnosis</c>.</summary>
    public static class CatalogDiagnosis
    {
        public const string Subject = "catalogDiagnosis";
        public const string Read = "BlueDental.catalogDiagnosis.read";
        public const string Create = "BlueDental.catalogDiagnosis.create";
        public const string Update = "BlueDental.catalogDiagnosis.update";
        public const string Delete = "BlueDental.catalogDiagnosis.delete";
        public const string Export = "BlueDental.catalogDiagnosis.export";
    }

    /// <summary>Subject <c>catalogHistory</c>.</summary>
    public static class CatalogHistory
    {
        public const string Subject = "catalogHistory";
        public const string Read = "BlueDental.catalogHistory.read";
        public const string Create = "BlueDental.catalogHistory.create";
        public const string Update = "BlueDental.catalogHistory.update";
        public const string Delete = "BlueDental.catalogHistory.delete";
        public const string Export = "BlueDental.catalogHistory.export";
    }

    /// <summary>Subject <c>catalogMedicine</c>.</summary>
    public static class CatalogMedicine
    {
        public const string Subject = "catalogMedicine";
        public const string Read = "BlueDental.catalogMedicine.read";
        public const string Create = "BlueDental.catalogMedicine.create";
        public const string Update = "BlueDental.catalogMedicine.update";
        public const string Delete = "BlueDental.catalogMedicine.delete";
        public const string Export = "BlueDental.catalogMedicine.export";
    }

    /// <summary>Subject <c>catalogOccupation</c>.</summary>
    public static class CatalogOccupation
    {
        public const string Subject = "catalogOccupation";
        public const string Read = "BlueDental.catalogOccupation.read";
        public const string Create = "BlueDental.catalogOccupation.create";
        public const string Update = "BlueDental.catalogOccupation.update";
        public const string Delete = "BlueDental.catalogOccupation.delete";
    }

    /// <summary>Subject <c>catalogPaymentMethod</c>.</summary>
    public static class CatalogPaymentMethod
    {
        public const string Subject = "catalogPaymentMethod";
        public const string Read = "BlueDental.catalogPaymentMethod.read";
        public const string Create = "BlueDental.catalogPaymentMethod.create";
        public const string Update = "BlueDental.catalogPaymentMethod.update";
        public const string Delete = "BlueDental.catalogPaymentMethod.delete";
    }

    /// <summary>Subject <c>catalogPost</c>.</summary>
    public static class CatalogPost
    {
        public const string Subject = "catalogPost";
        public const string Read = "BlueDental.catalogPost.read";
        public const string Create = "BlueDental.catalogPost.create";
        public const string Update = "BlueDental.catalogPost.update";
        public const string Delete = "BlueDental.catalogPost.delete";
    }

    /// <summary>Subject <c>catalogPrescription</c>.</summary>
    public static class CatalogPrescription
    {
        public const string Subject = "catalogPrescription";
        public const string Read = "BlueDental.catalogPrescription.read";
        public const string Create = "BlueDental.catalogPrescription.create";
        public const string Update = "BlueDental.catalogPrescription.update";
        public const string Delete = "BlueDental.catalogPrescription.delete";
        public const string Export = "BlueDental.catalogPrescription.export";
    }

    /// <summary>Subject <c>catalogRecordTag</c>.</summary>
    public static class CatalogRecordTag
    {
        public const string Subject = "catalogRecordTag";
        public const string Read = "BlueDental.catalogRecordTag.read";
        public const string Create = "BlueDental.catalogRecordTag.create";
        public const string Update = "BlueDental.catalogRecordTag.update";
        public const string Delete = "BlueDental.catalogRecordTag.delete";
    }

    /// <summary>Subject <c>catalogService</c>.</summary>
    public static class CatalogService
    {
        public const string Subject = "catalogService";
        public const string Read = "BlueDental.catalogService.read";
        public const string Create = "BlueDental.catalogService.create";
        public const string Update = "BlueDental.catalogService.update";
        public const string Delete = "BlueDental.catalogService.delete";
        public const string Export = "BlueDental.catalogService.export";
    }

    /// <summary>Subject <c>catalogSource</c>.</summary>
    public static class CatalogSource
    {
        public const string Subject = "catalogSource";
        public const string Read = "BlueDental.catalogSource.read";
        public const string Create = "BlueDental.catalogSource.create";
        public const string Update = "BlueDental.catalogSource.update";
        public const string Delete = "BlueDental.catalogSource.delete";
        public const string Export = "BlueDental.catalogSource.export";
    }

    /// <summary>Subject <c>catalogTemplate</c>.</summary>
    public static class CatalogTemplate
    {
        public const string Subject = "catalogTemplate";
        public const string Read = "BlueDental.catalogTemplate.read";
        public const string Create = "BlueDental.catalogTemplate.create";
        public const string Update = "BlueDental.catalogTemplate.update";
        public const string Delete = "BlueDental.catalogTemplate.delete";
        public const string Export = "BlueDental.catalogTemplate.export";
    }

    /// <summary>Subject <c>chatbot</c>.</summary>
    public static class Chatbot
    {
        public const string Subject = "chatbot";
        public const string Read = "BlueDental.chatbot.read";
        public const string Create = "BlueDental.chatbot.create";
        public const string Update = "BlueDental.chatbot.update";
        public const string Delete = "BlueDental.chatbot.delete";
        public const string Approve = "BlueDental.chatbot.approve";
        public const string Manage = "BlueDental.chatbot.manage";
    }

    /// <summary>Subject <c>chatbotKnowledge</c>.</summary>
    public static class ChatbotKnowledge
    {
        public const string Subject = "chatbotKnowledge";
        public const string Read = "BlueDental.chatbotKnowledge.read";
        public const string Create = "BlueDental.chatbotKnowledge.create";
        public const string Update = "BlueDental.chatbotKnowledge.update";
        public const string Delete = "BlueDental.chatbotKnowledge.delete";
    }

    /// <summary>Subject <c>cskhCare</c>.</summary>
    public static class CskhCare
    {
        public const string Subject = "cskhCare";
        public const string Read = "BlueDental.cskhCare.read";
        public const string Create = "BlueDental.cskhCare.create";
        public const string Update = "BlueDental.cskhCare.update";
        public const string Export = "BlueDental.cskhCare.export";
    }

    /// <summary>Subject <c>cskhGroup</c>.</summary>
    public static class CskhGroup
    {
        public const string Subject = "cskhGroup";
        public const string Read = "BlueDental.cskhGroup.read";
        public const string Create = "BlueDental.cskhGroup.create";
        public const string Update = "BlueDental.cskhGroup.update";
        public const string Export = "BlueDental.cskhGroup.export";
    }

    /// <summary>Subject <c>helpSupport</c>.</summary>
    public static class HelpSupport
    {
        public const string Subject = "helpSupport";
        public const string Read = "BlueDental.helpSupport.read";
    }

    /// <summary>Subject <c>laboBite</c>.</summary>
    public static class LaboBite
    {
        public const string Subject = "laboBite";
        public const string Read = "BlueDental.laboBite.read";
        public const string Create = "BlueDental.laboBite.create";
        public const string Update = "BlueDental.laboBite.update";
        public const string Delete = "BlueDental.laboBite.delete";
        public const string Export = "BlueDental.laboBite.export";
    }

    /// <summary>Subject <c>laboFinishLine</c>.</summary>
    public static class LaboFinishLine
    {
        public const string Subject = "laboFinishLine";
        public const string Read = "BlueDental.laboFinishLine.read";
        public const string Create = "BlueDental.laboFinishLine.create";
        public const string Update = "BlueDental.laboFinishLine.update";
        public const string Delete = "BlueDental.laboFinishLine.delete";
        public const string Export = "BlueDental.laboFinishLine.export";
    }

    /// <summary>Subject <c>laboMaterial</c>.</summary>
    public static class LaboMaterial
    {
        public const string Subject = "laboMaterial";
        public const string Read = "BlueDental.laboMaterial.read";
        public const string Create = "BlueDental.laboMaterial.create";
        public const string Update = "BlueDental.laboMaterial.update";
        public const string Delete = "BlueDental.laboMaterial.delete";
        public const string Export = "BlueDental.laboMaterial.export";
    }

    /// <summary>Subject <c>laboRhythm</c>.</summary>
    public static class LaboRhythm
    {
        public const string Subject = "laboRhythm";
        public const string Read = "BlueDental.laboRhythm.read";
        public const string Create = "BlueDental.laboRhythm.create";
        public const string Update = "BlueDental.laboRhythm.update";
        public const string Delete = "BlueDental.laboRhythm.delete";
        public const string Export = "BlueDental.laboRhythm.export";
    }

    /// <summary>Subject <c>laboSupplier</c>.</summary>
    public static class LaboSupplier
    {
        public const string Subject = "laboSupplier";
        public const string Read = "BlueDental.laboSupplier.read";
        public const string Create = "BlueDental.laboSupplier.create";
        public const string Update = "BlueDental.laboSupplier.update";
        public const string Delete = "BlueDental.laboSupplier.delete";
        public const string Export = "BlueDental.laboSupplier.export";
    }

    /// <summary>Subject <c>laboTemplate</c>.</summary>
    public static class LaboTemplate
    {
        public const string Subject = "laboTemplate";
        public const string Read = "BlueDental.laboTemplate.read";
        public const string Create = "BlueDental.laboTemplate.create";
        public const string Update = "BlueDental.laboTemplate.update";
        public const string Export = "BlueDental.laboTemplate.export";
    }

    /// <summary>Subject <c>materials</c>.</summary>
    public static class Materials
    {
        public const string Subject = "materials";
        public const string Read = "BlueDental.materials.read";
        public const string Create = "BlueDental.materials.create";
        public const string Update = "BlueDental.materials.update";
        public const string Delete = "BlueDental.materials.delete";
        public const string Approve = "BlueDental.materials.approve";
        public const string Export = "BlueDental.materials.export";
    }

    /// <summary>Subject <c>operationsAssistantHome</c>.</summary>
    public static class OperationsAssistantHome
    {
        public const string Subject = "operationsAssistantHome";
        public const string Read = "BlueDental.operationsAssistantHome.read";
        public const string Create = "BlueDental.operationsAssistantHome.create";
        public const string Update = "BlueDental.operationsAssistantHome.update";
        public const string Delete = "BlueDental.operationsAssistantHome.delete";
        public const string Export = "BlueDental.operationsAssistantHome.export";
    }

    /// <summary>Subject <c>operationsAssistantProcess</c>.</summary>
    public static class OperationsAssistantProcess
    {
        public const string Subject = "operationsAssistantProcess";
        public const string Read = "BlueDental.operationsAssistantProcess.read";
        public const string Create = "BlueDental.operationsAssistantProcess.create";
        public const string Update = "BlueDental.operationsAssistantProcess.update";
        public const string Delete = "BlueDental.operationsAssistantProcess.delete";
        public const string Export = "BlueDental.operationsAssistantProcess.export";
    }

    /// <summary>Subject <c>operationsAssistantTask</c>.</summary>
    public static class OperationsAssistantTask
    {
        public const string Subject = "operationsAssistantTask";
        public const string Read = "BlueDental.operationsAssistantTask.read";
        public const string Create = "BlueDental.operationsAssistantTask.create";
        public const string Update = "BlueDental.operationsAssistantTask.update";
        public const string Delete = "BlueDental.operationsAssistantTask.delete";
        public const string Export = "BlueDental.operationsAssistantTask.export";
    }

    /// <summary>Subject <c>operationsCskhHome</c>.</summary>
    public static class OperationsCskhHome
    {
        public const string Subject = "operationsCskhHome";
        public const string Read = "BlueDental.operationsCskhHome.read";
        public const string Create = "BlueDental.operationsCskhHome.create";
        public const string Update = "BlueDental.operationsCskhHome.update";
        public const string Delete = "BlueDental.operationsCskhHome.delete";
        public const string Export = "BlueDental.operationsCskhHome.export";
    }

    /// <summary>Subject <c>operationsCskhProcess</c>.</summary>
    public static class OperationsCskhProcess
    {
        public const string Subject = "operationsCskhProcess";
        public const string Read = "BlueDental.operationsCskhProcess.read";
        public const string Create = "BlueDental.operationsCskhProcess.create";
        public const string Update = "BlueDental.operationsCskhProcess.update";
        public const string Delete = "BlueDental.operationsCskhProcess.delete";
        public const string Export = "BlueDental.operationsCskhProcess.export";
    }

    /// <summary>Subject <c>operationsCskhReport</c>.</summary>
    public static class OperationsCskhReport
    {
        public const string Subject = "operationsCskhReport";
        public const string Read = "BlueDental.operationsCskhReport.read";
        public const string Export = "BlueDental.operationsCskhReport.export";
    }

    /// <summary>Subject <c>operationsCskhTask</c>.</summary>
    public static class OperationsCskhTask
    {
        public const string Subject = "operationsCskhTask";
        public const string Read = "BlueDental.operationsCskhTask.read";
        public const string Create = "BlueDental.operationsCskhTask.create";
        public const string Update = "BlueDental.operationsCskhTask.update";
        public const string Delete = "BlueDental.operationsCskhTask.delete";
        public const string Export = "BlueDental.operationsCskhTask.export";
    }

    /// <summary>Subject <c>operationsFinanceAccess</c>.</summary>
    public static class OperationsFinanceAccess
    {
        public const string Subject = "operationsFinanceAccess";
        public const string Read = "BlueDental.operationsFinanceAccess.read";
        public const string Export = "BlueDental.operationsFinanceAccess.export";
    }

    /// <summary>Subject <c>operationsFinanceHome</c>.</summary>
    public static class OperationsFinanceHome
    {
        public const string Subject = "operationsFinanceHome";
        public const string Read = "BlueDental.operationsFinanceHome.read";
        public const string Create = "BlueDental.operationsFinanceHome.create";
        public const string Update = "BlueDental.operationsFinanceHome.update";
        public const string Delete = "BlueDental.operationsFinanceHome.delete";
        public const string Export = "BlueDental.operationsFinanceHome.export";
    }

    /// <summary>Subject <c>operationsFinanceInvoice</c>.</summary>
    public static class OperationsFinanceInvoice
    {
        public const string Subject = "operationsFinanceInvoice";
        public const string Read = "BlueDental.operationsFinanceInvoice.read";
        public const string Export = "BlueDental.operationsFinanceInvoice.export";
    }

    /// <summary>Subject <c>operationsFinanceProcess</c>.</summary>
    public static class OperationsFinanceProcess
    {
        public const string Subject = "operationsFinanceProcess";
        public const string Read = "BlueDental.operationsFinanceProcess.read";
        public const string Create = "BlueDental.operationsFinanceProcess.create";
        public const string Update = "BlueDental.operationsFinanceProcess.update";
        public const string Delete = "BlueDental.operationsFinanceProcess.delete";
        public const string Export = "BlueDental.operationsFinanceProcess.export";
    }

    /// <summary>Subject <c>operationsFinanceServiceComplete</c>.</summary>
    public static class OperationsFinanceServiceComplete
    {
        public const string Subject = "operationsFinanceServiceComplete";
        public const string Read = "BlueDental.operationsFinanceServiceComplete.read";
        public const string Export = "BlueDental.operationsFinanceServiceComplete.export";
    }

    /// <summary>Subject <c>operationsFinanceTask</c>.</summary>
    public static class OperationsFinanceTask
    {
        public const string Subject = "operationsFinanceTask";
        public const string Read = "BlueDental.operationsFinanceTask.read";
        public const string Create = "BlueDental.operationsFinanceTask.create";
        public const string Update = "BlueDental.operationsFinanceTask.update";
        public const string Delete = "BlueDental.operationsFinanceTask.delete";
        public const string Export = "BlueDental.operationsFinanceTask.export";
    }

    /// <summary>Subject <c>operationsMarketingHome</c>.</summary>
    public static class OperationsMarketingHome
    {
        public const string Subject = "operationsMarketingHome";
        public const string Read = "BlueDental.operationsMarketingHome.read";
        public const string Create = "BlueDental.operationsMarketingHome.create";
        public const string Update = "BlueDental.operationsMarketingHome.update";
        public const string Delete = "BlueDental.operationsMarketingHome.delete";
        public const string Export = "BlueDental.operationsMarketingHome.export";
    }

    /// <summary>Subject <c>operationsMarketingProcess</c>.</summary>
    public static class OperationsMarketingProcess
    {
        public const string Subject = "operationsMarketingProcess";
        public const string Read = "BlueDental.operationsMarketingProcess.read";
        public const string Create = "BlueDental.operationsMarketingProcess.create";
        public const string Update = "BlueDental.operationsMarketingProcess.update";
        public const string Delete = "BlueDental.operationsMarketingProcess.delete";
        public const string Export = "BlueDental.operationsMarketingProcess.export";
    }

    /// <summary>Subject <c>operationsMarketingReport</c>.</summary>
    public static class OperationsMarketingReport
    {
        public const string Subject = "operationsMarketingReport";
        public const string Read = "BlueDental.operationsMarketingReport.read";
        public const string Export = "BlueDental.operationsMarketingReport.export";
    }

    /// <summary>Subject <c>operationsMarketingTask</c>.</summary>
    public static class OperationsMarketingTask
    {
        public const string Subject = "operationsMarketingTask";
        public const string Read = "BlueDental.operationsMarketingTask.read";
        public const string Create = "BlueDental.operationsMarketingTask.create";
        public const string Update = "BlueDental.operationsMarketingTask.update";
        public const string Delete = "BlueDental.operationsMarketingTask.delete";
        public const string Export = "BlueDental.operationsMarketingTask.export";
    }

    /// <summary>Subject <c>operationsOverviewDiagnosis</c>.</summary>
    public static class OperationsOverviewDiagnosis
    {
        public const string Subject = "operationsOverviewDiagnosis";
        public const string Read = "BlueDental.operationsOverviewDiagnosis.read";
        public const string Export = "BlueDental.operationsOverviewDiagnosis.export";
    }

    /// <summary>Subject <c>operationsOverviewHome</c>.</summary>
    public static class OperationsOverviewHome
    {
        public const string Subject = "operationsOverviewHome";
        public const string Read = "BlueDental.operationsOverviewHome.read";
        public const string Create = "BlueDental.operationsOverviewHome.create";
        public const string Update = "BlueDental.operationsOverviewHome.update";
        public const string Delete = "BlueDental.operationsOverviewHome.delete";
        public const string Export = "BlueDental.operationsOverviewHome.export";
    }

    /// <summary>Subject <c>operationsOverviewPrescription</c>.</summary>
    public static class OperationsOverviewPrescription
    {
        public const string Subject = "operationsOverviewPrescription";
        public const string Read = "BlueDental.operationsOverviewPrescription.read";
        public const string Export = "BlueDental.operationsOverviewPrescription.export";
    }

    /// <summary>Subject <c>operationsOverviewProcess</c>.</summary>
    public static class OperationsOverviewProcess
    {
        public const string Subject = "operationsOverviewProcess";
        public const string Read = "BlueDental.operationsOverviewProcess.read";
        public const string Create = "BlueDental.operationsOverviewProcess.create";
        public const string Update = "BlueDental.operationsOverviewProcess.update";
        public const string Delete = "BlueDental.operationsOverviewProcess.delete";
        public const string Export = "BlueDental.operationsOverviewProcess.export";
    }

    /// <summary>Subject <c>operationsOverviewReport</c>.</summary>
    public static class OperationsOverviewReport
    {
        public const string Subject = "operationsOverviewReport";
        public const string Read = "BlueDental.operationsOverviewReport.read";
        public const string Export = "BlueDental.operationsOverviewReport.export";
    }

    /// <summary>Subject <c>operationsOverviewTask</c>.</summary>
    public static class OperationsOverviewTask
    {
        public const string Subject = "operationsOverviewTask";
        public const string Read = "BlueDental.operationsOverviewTask.read";
        public const string Create = "BlueDental.operationsOverviewTask.create";
        public const string Update = "BlueDental.operationsOverviewTask.update";
        public const string Delete = "BlueDental.operationsOverviewTask.delete";
        public const string Export = "BlueDental.operationsOverviewTask.export";
    }

    /// <summary>Subject <c>operationsReceptionHome</c>.</summary>
    public static class OperationsReceptionHome
    {
        public const string Subject = "operationsReceptionHome";
        public const string Read = "BlueDental.operationsReceptionHome.read";
        public const string Create = "BlueDental.operationsReceptionHome.create";
        public const string Update = "BlueDental.operationsReceptionHome.update";
        public const string Delete = "BlueDental.operationsReceptionHome.delete";
        public const string Export = "BlueDental.operationsReceptionHome.export";
    }

    /// <summary>Subject <c>operationsReceptionProcess</c>.</summary>
    public static class OperationsReceptionProcess
    {
        public const string Subject = "operationsReceptionProcess";
        public const string Read = "BlueDental.operationsReceptionProcess.read";
        public const string Create = "BlueDental.operationsReceptionProcess.create";
        public const string Update = "BlueDental.operationsReceptionProcess.update";
        public const string Delete = "BlueDental.operationsReceptionProcess.delete";
        public const string Export = "BlueDental.operationsReceptionProcess.export";
    }

    /// <summary>Subject <c>operationsReceptionReport</c>.</summary>
    public static class OperationsReceptionReport
    {
        public const string Subject = "operationsReceptionReport";
        public const string Read = "BlueDental.operationsReceptionReport.read";
        public const string Export = "BlueDental.operationsReceptionReport.export";
    }

    /// <summary>Subject <c>operationsReceptionTask</c>.</summary>
    public static class OperationsReceptionTask
    {
        public const string Subject = "operationsReceptionTask";
        public const string Read = "BlueDental.operationsReceptionTask.read";
        public const string Create = "BlueDental.operationsReceptionTask.create";
        public const string Update = "BlueDental.operationsReceptionTask.update";
        public const string Delete = "BlueDental.operationsReceptionTask.delete";
        public const string Export = "BlueDental.operationsReceptionTask.export";
    }

    /// <summary>Subject <c>operationsSecurityHome</c>.</summary>
    public static class OperationsSecurityHome
    {
        public const string Subject = "operationsSecurityHome";
        public const string Read = "BlueDental.operationsSecurityHome.read";
        public const string Create = "BlueDental.operationsSecurityHome.create";
        public const string Update = "BlueDental.operationsSecurityHome.update";
        public const string Delete = "BlueDental.operationsSecurityHome.delete";
        public const string Export = "BlueDental.operationsSecurityHome.export";
    }

    /// <summary>Subject <c>operationsSecurityProcess</c>.</summary>
    public static class OperationsSecurityProcess
    {
        public const string Subject = "operationsSecurityProcess";
        public const string Read = "BlueDental.operationsSecurityProcess.read";
        public const string Create = "BlueDental.operationsSecurityProcess.create";
        public const string Update = "BlueDental.operationsSecurityProcess.update";
        public const string Delete = "BlueDental.operationsSecurityProcess.delete";
        public const string Export = "BlueDental.operationsSecurityProcess.export";
    }

    /// <summary>Subject <c>operationsSecurityTask</c>.</summary>
    public static class OperationsSecurityTask
    {
        public const string Subject = "operationsSecurityTask";
        public const string Read = "BlueDental.operationsSecurityTask.read";
        public const string Create = "BlueDental.operationsSecurityTask.create";
        public const string Update = "BlueDental.operationsSecurityTask.update";
        public const string Delete = "BlueDental.operationsSecurityTask.delete";
        public const string Export = "BlueDental.operationsSecurityTask.export";
    }

    /// <summary>Subject <c>operationsTreatmentAccess</c>.</summary>
    public static class OperationsTreatmentAccess
    {
        public const string Subject = "operationsTreatmentAccess";
        public const string Read = "BlueDental.operationsTreatmentAccess.read";
        public const string Export = "BlueDental.operationsTreatmentAccess.export";
    }

    /// <summary>Subject <c>operationsTreatmentHome</c>.</summary>
    public static class OperationsTreatmentHome
    {
        public const string Subject = "operationsTreatmentHome";
        public const string Read = "BlueDental.operationsTreatmentHome.read";
        public const string Create = "BlueDental.operationsTreatmentHome.create";
        public const string Update = "BlueDental.operationsTreatmentHome.update";
        public const string Delete = "BlueDental.operationsTreatmentHome.delete";
        public const string Export = "BlueDental.operationsTreatmentHome.export";
    }

    /// <summary>Subject <c>operationsTreatmentProcess</c>.</summary>
    public static class OperationsTreatmentProcess
    {
        public const string Subject = "operationsTreatmentProcess";
        public const string Read = "BlueDental.operationsTreatmentProcess.read";
        public const string Create = "BlueDental.operationsTreatmentProcess.create";
        public const string Update = "BlueDental.operationsTreatmentProcess.update";
        public const string Delete = "BlueDental.operationsTreatmentProcess.delete";
        public const string Export = "BlueDental.operationsTreatmentProcess.export";
    }

    /// <summary>Subject <c>operationsTreatmentReport</c>.</summary>
    public static class OperationsTreatmentReport
    {
        public const string Subject = "operationsTreatmentReport";
        public const string Read = "BlueDental.operationsTreatmentReport.read";
        public const string Export = "BlueDental.operationsTreatmentReport.export";
    }

    /// <summary>Subject <c>operationsTreatmentTask</c>.</summary>
    public static class OperationsTreatmentTask
    {
        public const string Subject = "operationsTreatmentTask";
        public const string Read = "BlueDental.operationsTreatmentTask.read";
        public const string Create = "BlueDental.operationsTreatmentTask.create";
        public const string Update = "BlueDental.operationsTreatmentTask.update";
        public const string Delete = "BlueDental.operationsTreatmentTask.delete";
        public const string Export = "BlueDental.operationsTreatmentTask.export";
    }

    /// <summary>Subject <c>patient</c>.</summary>
    public static class Patient
    {
        public const string Subject = "patient";
        public const string Read = "BlueDental.patient.read";
        public const string Create = "BlueDental.patient.create";
        public const string Update = "BlueDental.patient.update";
        public const string HidePhone = "BlueDental.patient.hidePhone";
        public const string Export = "BlueDental.patient.export";
    }

    /// <summary>Subject <c>payment</c>.</summary>
    public static class Payment
    {
        public const string Subject = "payment";
        public const string Read = "BlueDental.payment.read";
        public const string Create = "BlueDental.payment.create";
        public const string Update = "BlueDental.payment.update";
        public const string Delete = "BlueDental.payment.delete";
        public const string Export = "BlueDental.payment.export";
        public const string Finalize = "BlueDental.payment.finalize";
    }

    /// <summary>Subject <c>prescription</c>.</summary>
    public static class Prescription
    {
        public const string Subject = "prescription";
        public const string Read = "BlueDental.prescription.read";
        public const string Create = "BlueDental.prescription.create";
        public const string Update = "BlueDental.prescription.update";
        public const string Delete = "BlueDental.prescription.delete";
        public const string Export = "BlueDental.prescription.export";
    }

    /// <summary>Subject <c>reception</c>.</summary>
    public static class Reception
    {
        public const string Subject = "reception";
        public const string Read = "BlueDental.reception.read";
        public const string Create = "BlueDental.reception.create";
        public const string Update = "BlueDental.reception.update";
        public const string Delete = "BlueDental.reception.delete";
        public const string Export = "BlueDental.reception.export";
    }

    /// <summary>Subject <c>reportCashflowCategory</c>.</summary>
    public static class ReportCashflowCategory
    {
        public const string Subject = "reportCashflowCategory";
        public const string Read = "BlueDental.reportCashflowCategory.read";
        public const string Create = "BlueDental.reportCashflowCategory.create";
        public const string Update = "BlueDental.reportCashflowCategory.update";
        public const string Delete = "BlueDental.reportCashflowCategory.delete";
        public const string Export = "BlueDental.reportCashflowCategory.export";
    }

    /// <summary>Subject <c>reportCost</c>.</summary>
    public static class ReportCost
    {
        public const string Subject = "reportCost";
        public const string Read = "BlueDental.reportCost.read";
        public const string Create = "BlueDental.reportCost.create";
        public const string Update = "BlueDental.reportCost.update";
        public const string Delete = "BlueDental.reportCost.delete";
        public const string Approve = "BlueDental.reportCost.approve";
        public const string Export = "BlueDental.reportCost.export";
    }

    /// <summary>Subject <c>reportIncome</c>.</summary>
    public static class ReportIncome
    {
        public const string Subject = "reportIncome";
        public const string Read = "BlueDental.reportIncome.read";
        public const string Create = "BlueDental.reportIncome.create";
        public const string Update = "BlueDental.reportIncome.update";
        public const string Delete = "BlueDental.reportIncome.delete";
        public const string Export = "BlueDental.reportIncome.export";
    }

    /// <summary>Subject <c>reportResult</c>.</summary>
    public static class ReportResult
    {
        public const string Subject = "reportResult";
        public const string Read = "BlueDental.reportResult.read";
        public const string Export = "BlueDental.reportResult.export";
    }

    /// <summary>Subject <c>reportSales</c>.</summary>
    public static class ReportSales
    {
        public const string Subject = "reportSales";
        public const string Read = "BlueDental.reportSales.read";
        public const string Export = "BlueDental.reportSales.export";
    }

    /// <summary>Subject <c>reportTransfer</c>.</summary>
    public static class ReportTransfer
    {
        public const string Subject = "reportTransfer";
        public const string Read = "BlueDental.reportTransfer.read";
        public const string Update = "BlueDental.reportTransfer.update";
        public const string Delete = "BlueDental.reportTransfer.delete";
        public const string Deposit = "BlueDental.reportTransfer.deposit";
        public const string Withdraw = "BlueDental.reportTransfer.withdraw";
        public const string Transfer = "BlueDental.reportTransfer.transfer";
        public const string Export = "BlueDental.reportTransfer.export";
    }

    /// <summary>Subject <c>reportTransferCategory</c>.</summary>
    public static class ReportTransferCategory
    {
        public const string Subject = "reportTransferCategory";
        public const string Read = "BlueDental.reportTransferCategory.read";
        public const string Create = "BlueDental.reportTransferCategory.create";
        public const string Update = "BlueDental.reportTransferCategory.update";
        public const string Delete = "BlueDental.reportTransferCategory.delete";
    }

    /// <summary>Subject <c>rolePermission</c>.</summary>
    public static class RolePermission
    {
        public const string Subject = "rolePermission";
        public const string Read = "BlueDental.rolePermission.read";
        public const string Create = "BlueDental.rolePermission.create";
        public const string Update = "BlueDental.rolePermission.update";
        public const string Delete = "BlueDental.rolePermission.delete";
    }

    /// <summary>Subject <c>staff</c>.</summary>
    public static class Staff
    {
        public const string Subject = "staff";
        public const string Read = "BlueDental.staff.read";
        public const string Create = "BlueDental.staff.create";
        public const string Update = "BlueDental.staff.update";
        public const string Delete = "BlueDental.staff.delete";
        public const string Export = "BlueDental.staff.export";
    }

    /// <summary>Subject <c>branchManager</c>.</summary>
    public static class BranchManager
    {
        public const string Subject = "branchManager";
        public const string Read = "BlueDental.branchManager.read";
        public const string Create = "BlueDental.branchManager.create";
        public const string Update = "BlueDental.branchManager.update";
        public const string Delete = "BlueDental.branchManager.delete";
    }

    /// <summary>Subject <c>toolCall</c>.</summary>
    public static class ToolCall
    {
        public const string Subject = "toolCall";
        public const string Read = "BlueDental.toolCall.read";
        public const string Create = "BlueDental.toolCall.create";
        public const string Update = "BlueDental.toolCall.update";
        public const string Delete = "BlueDental.toolCall.delete";
        public const string Export = "BlueDental.toolCall.export";
    }

    /// <summary>Subject <c>toolMessage</c>.</summary>
    public static class ToolMessage
    {
        public const string Subject = "toolMessage";
        public const string Read = "BlueDental.toolMessage.read";
        public const string Create = "BlueDental.toolMessage.create";
        public const string Update = "BlueDental.toolMessage.update";
        public const string Delete = "BlueDental.toolMessage.delete";
        public const string Export = "BlueDental.toolMessage.export";
    }

    /// <summary>Subject <c>treatmentConsultation</c>.</summary>
    public static class TreatmentConsultation
    {
        public const string Subject = "treatmentConsultation";
        public const string Read = "BlueDental.treatmentConsultation.read";
        public const string Create = "BlueDental.treatmentConsultation.create";
        public const string Update = "BlueDental.treatmentConsultation.update";
        public const string Delete = "BlueDental.treatmentConsultation.delete";
        public const string Print = "BlueDental.treatmentConsultation.print";
    }

    /// <summary>Subject <c>treatmentCskh</c>.</summary>
    public static class TreatmentCskh
    {
        public const string Subject = "treatmentCskh";
        public const string Read = "BlueDental.treatmentCskh.read";
        public const string Create = "BlueDental.treatmentCskh.create";
        public const string Update = "BlueDental.treatmentCskh.update";
        public const string Delete = "BlueDental.treatmentCskh.delete";
        public const string Export = "BlueDental.treatmentCskh.export";
    }

    /// <summary>Subject <c>treatmentDiagnosis</c>.</summary>
    public static class TreatmentDiagnosis
    {
        public const string Subject = "treatmentDiagnosis";
        public const string Read = "BlueDental.treatmentDiagnosis.read";
        public const string Create = "BlueDental.treatmentDiagnosis.create";
        public const string Update = "BlueDental.treatmentDiagnosis.update";
        public const string Delete = "BlueDental.treatmentDiagnosis.delete";
    }

    /// <summary>Subject <c>treatmentImage</c>.</summary>
    public static class TreatmentImage
    {
        public const string Subject = "treatmentImage";
        public const string Read = "BlueDental.treatmentImage.read";
        public const string Create = "BlueDental.treatmentImage.create";
        public const string Update = "BlueDental.treatmentImage.update";
        public const string Delete = "BlueDental.treatmentImage.delete";
        public const string Export = "BlueDental.treatmentImage.export";
    }

    /// <summary>Subject <c>patientMedicalRecord</c> — the patient's Bệnh án sheets.</summary>
    public static class PatientMedicalRecord
    {
        public const string Subject = "patientMedicalRecord";
        public const string Read = "BlueDental.patientMedicalRecord.read";
        public const string Create = "BlueDental.patientMedicalRecord.create";
        public const string Update = "BlueDental.patientMedicalRecord.update";
        public const string Delete = "BlueDental.patientMedicalRecord.delete";
        public const string Print = "BlueDental.patientMedicalRecord.print";
    }

    /// <summary>Subject <c>treatmentLabo</c>.</summary>
    public static class TreatmentLabo
    {
        public const string Subject = "treatmentLabo";
        public const string Read = "BlueDental.treatmentLabo.read";
        public const string Create = "BlueDental.treatmentLabo.create";
        public const string Update = "BlueDental.treatmentLabo.update";
        public const string Delete = "BlueDental.treatmentLabo.delete";
        public const string Export = "BlueDental.treatmentLabo.export";
    }

    /// <summary>Subject <c>treatmentStage</c>.</summary>
    public static class TreatmentStage
    {
        public const string Subject = "treatmentStage";
        public const string Read = "BlueDental.treatmentStage.read";
        public const string Create = "BlueDental.treatmentStage.create";
        public const string Update = "BlueDental.treatmentStage.update";
        public const string Continue = "BlueDental.treatmentStage.continue";
        public const string Complete = "BlueDental.treatmentStage.complete";
        public const string Print = "BlueDental.treatmentStage.print";
    }

    /// <summary>Subject <c>voucher</c>.</summary>
    public static class Voucher
    {
        public const string Subject = "voucher";
        public const string Read = "BlueDental.voucher.read";
        public const string Create = "BlueDental.voucher.create";
        public const string Update = "BlueDental.voucher.update";
        public const string Delete = "BlueDental.voucher.delete";
        public const string Export = "BlueDental.voucher.export";
    }

    /// <summary>Subject <c>workSchedule</c>.</summary>
    public static class WorkSchedule
    {
        public const string Subject = "workSchedule";
        public const string Read = "BlueDental.workSchedule.read";
        public const string Update = "BlueDental.workSchedule.update";
        public const string AttendanceOthers = "BlueDental.workSchedule.attendanceOthers";
    }
}
