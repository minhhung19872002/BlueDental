namespace BlueDental.PatientManagement;

/// <summary>
/// Shared so the DTO can validate a "BE:Field:ReasonForVisit" line to the same length
/// the column stores it at, without Application.Contracts reaching into Domain.
/// </summary>
public static class PatientExaminationReasonConsts
{
    public const int MaxContentLength = 1000;
    public const int MaxNoteLength = 1000;
}
