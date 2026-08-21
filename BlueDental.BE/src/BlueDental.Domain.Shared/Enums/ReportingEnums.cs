namespace BlueDental.Reporting;

public enum ReportType
{
    AppointmentSummary = 1,
    RevenueAnalysis = 2,
    PatientDemographics = 3,
    TreatmentOutcomes = 4,
    InventoryStatus = 5,
    DentistPerformance = 6,
    InsuranceClaims = 7,
    CustomQuery = 8
}

public enum ReportPeriod
{
    Daily = 1,
    Weekly = 2,
    Monthly = 3,
    Quarterly = 4,
    Annual = 5,
    Custom = 6
}
