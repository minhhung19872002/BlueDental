using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// One tooth plus the surfaces involved. Mirrors the reference application's
/// <c>content[]</c> element on diagnoses and advises.
/// </summary>
public class ToothSelectionDto
{
    /// <summary>FDI tooth number (11-48 permanent, 51-85 deciduous).</summary>
    public int ToothCode { get; set; }

    public bool Selected { get; set; }
    public bool Top { get; set; }
    public bool Right { get; set; }
    public bool Bottom { get; set; }
    public bool Left { get; set; }
    public bool Center { get; set; }
}

public class PatientDiagnosisDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid DiagnosisId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Note { get; set; }
    public PatientDiagnosisStatus Status { get; set; }
    public bool HasTreatmentService { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();

    public string? DiagnosisName { get; set; }
    public string? StaffName { get; set; }
}

public class CreatePatientDiagnosisDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid DiagnosisId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public string? Note { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
}

public class UpdatePatientDiagnosisDto
{
    public Guid StaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public string? Note { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
}

public class GetPatientDiagnosisListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public Guid? StaffId { get; set; }
    public PatientDiagnosisStatus? Status { get; set; }

    /// <summary>Filter to diagnoses that have not produced a treatment service yet.</summary>
    public bool? HasTreatmentService { get; set; }
}

public class PatientAdviseDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid DiagnosisId { get; set; }
    public Guid PatientDiagnosisId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public Guid? AdviseGroupId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string? Note { get; set; }
    public decimal OriginalPrice { get; set; }
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public decimal? VoucherDiscountAmount { get; set; }
    public PatientAdviseStatus Status { get; set; }
    public int SortOrder { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
    public List<Guid> ImageIds { get; set; } = new();

    public decimal GrossAmount { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal EffectiveAmount { get; set; }

    public string? ServiceName { get; set; }
    public string? StaffName { get; set; }
}

public class CreatePatientAdviseDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid PatientDiagnosisId { get; set; }
    public Guid DiagnosisId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid StaffId { get; set; }
    public Guid? SecondStaffId { get; set; }
    public Guid? AdviseGroupId { get; set; }
    public decimal OriginalPrice { get; set; }
    public decimal Price { get; set; }
    public int Quantity { get; set; } = 1;
    public DiscountType DiscountType { get; set; } = DiscountType.None;
    public decimal DiscountValue { get; set; }
    public int SortOrder { get; set; }
    public string? Note { get; set; }
    public List<ToothSelectionDto> Teeth { get; set; } = new();
}

public class UpdatePatientAdviseDto
{
    public decimal Price { get; set; }
    public int Quantity { get; set; }
    public DiscountType DiscountType { get; set; }
    public decimal DiscountValue { get; set; }
    public Guid? AdviseGroupId { get; set; }
    public int SortOrder { get; set; }
    public string? Note { get; set; }
}

public class GetPatientAdviseListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
    public Guid? PatientDiagnosisId { get; set; }
    public Guid? AdviseGroupId { get; set; }
    public Guid? TreatmentPlanId { get; set; }
    public PatientAdviseStatus? Status { get; set; }
}

/// <summary>Totals shown above the consulting table.</summary>
public class PatientAdviseSummaryDto
{
    public int TotalCount { get; set; }
    public int AcceptedCount { get; set; }
    public int ConvertedCount { get; set; }
    public decimal TotalGrossAmount { get; set; }
    public decimal TotalDiscountAmount { get; set; }
    public decimal TotalEffectiveAmount { get; set; }
}

public class AdviseGroupDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public int AdviseCount { get; set; }
    public decimal TotalEffectiveAmount { get; set; }
}

public class CreateAdviseGroupDto
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateAdviseGroupDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetAdviseGroupListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? ClinicBranchId { get; set; }
}
