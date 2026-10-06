using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Staff;

/// <summary>One row of Nhân viên → Chế tài, with the names the table shows.</summary>
public class StaffPenaltyDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public Guid StaffId { get; set; }
    public string? StaffName { get; set; }
    public Guid? ViolationTypeId { get; set; }
    public string? ViolationTypeName { get; set; }
    public DateOnly ViolationDate { get; set; }
    public StaffPenaltyAction Action { get; set; }
    public decimal FineAmount { get; set; }
    public string? Description { get; set; }
    public StaffPenaltyStatus Status { get; set; }
    public Guid? ApproverId { get; set; }
    public string? ApproverName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
    public Guid? CreatorId { get; set; }
    public string? CreatorName { get; set; }
    public DateTime CreationTime { get; set; }
}

/// <summary>The page plus what the filtered records add up to.</summary>
public class StaffPenaltyListResultDto : PagedResultDto<StaffPenaltyDto>
{
    /// <summary>Σ FineAmount of the <b>approved</b> records matching the filter — the sum a payroll would deduct.</summary>
    public decimal ApprovedFineTotal { get; set; }
}

public class GetStaffPenaltyListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public Guid? StaffId { get; set; }
    public StaffPenaltyStatus? Status { get; set; }
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }

    /// <summary>Matches the staff member's name, user name, or the description.</summary>
    [StringLength(100)]
    public string? Filter { get; set; }
}

public class StaffPenaltyInputDto
{
    [Required]
    public Guid StaffId { get; set; }

    public Guid? ViolationTypeId { get; set; }

    [Required]
    public DateOnly ViolationDate { get; set; }

    [Required]
    public StaffPenaltyAction Action { get; set; }

    [Range(0, 999_999_999_999)]
    public decimal FineAmount { get; set; }

    [StringLength(2000)]
    public string? Description { get; set; }
}

public class CreateStaffPenaltyDto : StaffPenaltyInputDto
{
    /// <summary>Defaults to the caller's current branch.</summary>
    public Guid? ClinicBranchId { get; set; }
}

public class UpdateStaffPenaltyDto : StaffPenaltyInputDto;

public class CancelStaffPenaltyDto
{
    [Required]
    [StringLength(500)]
    public string Reason { get; set; } = string.Empty;
}

/// <summary>One Loại vi phạm.</summary>
public class StaffViolationTypeDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = default!;
    public decimal DefaultFineAmount { get; set; }
    public DateTime CreationTime { get; set; }
}

public class GetStaffViolationTypeListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }

    [StringLength(100)]
    public string? Filter { get; set; }
}

public class StaffViolationTypeInputDto
{
    [Required]
    [StringLength(200)]
    public string Name { get; set; } = string.Empty;

    [Range(0, 999_999_999_999)]
    public decimal DefaultFineAmount { get; set; }
}

public class CreateStaffViolationTypeDto : StaffViolationTypeInputDto
{
    public Guid? ClinicBranchId { get; set; }
}

public class UpdateStaffViolationTypeDto : StaffViolationTypeInputDto;
