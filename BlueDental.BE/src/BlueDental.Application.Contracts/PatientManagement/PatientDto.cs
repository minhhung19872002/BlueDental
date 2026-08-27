using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;

namespace BlueDental.PatientManagement;

public class PatientDto : FullAuditedEntityDto<Guid>
{
    public string PatientCode { get; set; } = default!;
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public string FullName { get; set; } = default!;

    /// <summary>Null when the front desk registered the patient without one.</summary>
    public DateOnly? DateOfBirth { get; set; }

    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? NationalId { get; set; }
    public PatientStatus Status { get; set; }
    public Guid BranchId { get; set; }

    // ── The rest of the hồ sơ dialog ─────────────────────────────────────────

    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public Guid? OccupationEntryId { get; set; }
    public string? OccupationOther { get; set; }
    public string? InsuranceNumber { get; set; }

    /// <summary>Số nhà/ Đường — the street line, without province or ward.</summary>
    public string? Address { get; set; }

    public string? ProvinceCode { get; set; }
    public string? WardCode { get; set; }
    public string? ExaminationReason { get; set; }
    public string? Note { get; set; }

    /// <summary>Thẻ hồ sơ — ids from the branch's PatientTag catalog.</summary>
    public List<Guid> TagIds { get; set; } = new();

    /// <summary>Tiểu sử bệnh — entry ids from the Lịch sử bệnh catalog.</summary>
    public List<Guid> DiseaseHistoryEntryIds { get; set; } = new();
}

/// <summary>
/// One row of the patient list. Deliberately not <see cref="PatientDto"/>: the
/// table shows a money and appointment rollup that the record itself does not
/// carry, and the dialog needs fields the table never renders.
/// </summary>
public class PatientListItemDto
{
    public Guid Id { get; set; }
    public string PatientCode { get; set; } = default!;

    /// <summary>Họ và tên, in Vietnamese order.</summary>
    public string FullName { get; set; } = default!;

    public DateOnly? DateOfBirth { get; set; }
    public string? PhoneNumber { get; set; }

    /// <summary>Trạng thái — derived from the patient's treatment slips.</summary>
    public PatientTreatmentStatus TreatmentStatus { get; set; }

    /// <summary>Dịch vụ — distinct service names across the patient's slips.</summary>
    public List<string> ServiceNames { get; set; } = new();

    /// <summary>Bác sĩ — distinct dentists on those slips.</summary>
    public List<string> StaffNames { get; set; } = new();

    /// <summary>Số tiền — what every slip totals to, after discounts.</summary>
    public decimal TotalAmount { get; set; }

    /// <summary>Thực thu — payments taken, less refunds.</summary>
    public decimal TotalRevenue { get; set; }

    /// <summary>Công nợ — what is still owed.</summary>
    public decimal TotalDebt { get; set; }

    /// <summary>Lịch hẹn gần nhất — the next appointment still ahead.</summary>
    public DateTimeOffset? NextAppointmentAt { get; set; }

    /// <summary>Lần khám cuối — the last visit, falling back to registration.</summary>
    public DateTimeOffset? LastVisitAt { get; set; }

    public DateTime CreationTime { get; set; }
}

/// <summary>The code the "Tạo hồ sơ" dialog opens with, split as it renders it.</summary>
public class PatientCodeEstimateDto
{
    /// <summary>The fixed half, e.g. <c>BD26</c> — shown greyed and not editable.</summary>
    public string Prefix { get; set; } = default!;

    /// <summary>The editable half, e.g. <c>013</c>.</summary>
    public string Sequence { get; set; } = default!;

    /// <summary>Prefix and sequence joined — what would be saved as-is.</summary>
    public string Code { get; set; } = default!;
}

/// <summary>Answer to the dialog's duplicate-phone check.</summary>
public class PhoneAvailabilityDto
{
    public bool Exists { get; set; }

    /// <summary>Who already holds it, so the dialog can name them.</summary>
    public string? PatientName { get; set; }

    public string? PatientCode { get; set; }
}

public class RegisterPatientDto
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;

    /// <summary>Optional — the dialog does not require a birth date.</summary>
    public DateOnly? DateOfBirth { get; set; }

    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? NationalId { get; set; }

    /// <summary>Null keeps the code the server suggests.</summary>
    public string? PatientCode { get; set; }

    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public Guid? OccupationEntryId { get; set; }
    public string? OccupationOther { get; set; }
    public string? InsuranceNumber { get; set; }
    public string? Address { get; set; }
    public string? ProvinceCode { get; set; }
    public string? WardCode { get; set; }
    public string? ExaminationReason { get; set; }
    public string? Note { get; set; }

    public List<Guid>? TagIds { get; set; }
    public List<Guid>? DiseaseHistoryEntryIds { get; set; }
}

public class UpdatePatientDto
{
    public string FirstName { get; set; } = default!;
    public string LastName { get; set; } = default!;
    public DateOnly? DateOfBirth { get; set; }
    public Gender Gender { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }

    /// <summary>Null keeps the current code.</summary>
    public string? PatientCode { get; set; }

    public Guid? SourceTaxonomyId { get; set; }
    public Guid? SourceEntryId { get; set; }
    public Guid? OccupationEntryId { get; set; }
    public string? OccupationOther { get; set; }
    public string? InsuranceNumber { get; set; }
    public string? Address { get; set; }
    public string? ProvinceCode { get; set; }
    public string? WardCode { get; set; }
    public string? ExaminationReason { get; set; }
    public string? Note { get; set; }

    /// <summary>Null = keep the current tags; a list replaces them whole.</summary>
    public List<Guid>? TagIds { get; set; }

    /// <summary>Null = keep the current history; a list replaces it whole.</summary>
    public List<Guid>? DiseaseHistoryEntryIds { get; set; }
}

public class GetPatientListInput : PagedAndSortedResultRequestDto
{
    /// <summary>Tìm kiếm — matches name, patient code or phone.</summary>
    public string? Filter { get; set; }

    /// <summary>Record lifecycle, not the treatment tabs.</summary>
    public PatientStatus? Status { get; set; }

    /// <summary>The Tất cả / Hoàn tất / Đang điều trị / Chưa phát sinh tabs.</summary>
    public PatientTreatmentFilter? TreatmentStatus { get; set; }

    /// <summary>Bác sĩ — patients with a slip run by this dentist.</summary>
    public Guid? StaffId { get; set; }

    /// <summary>Phân loại dịch vụ — a group of the Dịch vụ catalog.</summary>
    public Guid? ServiceTaxonomyId { get; set; }

    /// <summary>Phân loại theo Tag — patients carrying this Thẻ hồ sơ.</summary>
    public Guid? TagId { get; set; }

    /// <summary>Start of the Ngày/Tuần/Tháng window, on registration date.</summary>
    public DateTimeOffset? FromDate { get; set; }

    /// <summary>End of that window, inclusive.</summary>
    public DateTimeOffset? ToDate { get; set; }
}
