using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Operations;

public class OperationsArticleDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public OperationsDepartment Department { get; set; }
    public OperationsSection Section { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Content { get; set; }
    public int SortOrder { get; set; }
    public bool IsPublished { get; set; }
    public bool IsPinned { get; set; }
    public DateTimeOffset? PublishedAt { get; set; }
    public string? AuthorName { get; set; }
}

public class CreateOperationsArticleDto
{
    public Guid ClinicBranchId { get; set; }
    public OperationsDepartment Department { get; set; }
    public OperationsSection Section { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Content { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateOperationsArticleDto
{
    public string Title { get; set; } = string.Empty;
    public string? Summary { get; set; }
    public string? Content { get; set; }
    public int SortOrder { get; set; }
    public bool IsPinned { get; set; }
}

public class GetOperationsArticleListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public OperationsDepartment? Department { get; set; }
    public OperationsSection? Section { get; set; }
    public bool? IsPublished { get; set; }
    public string? Filter { get; set; }
}

public class OperationsTaskDto : FullAuditedEntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public OperationsDepartment Department { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? AssigneeStaffId { get; set; }
    public string? AssigneeName { get; set; }
    public DateOnly? DueDate { get; set; }
    public OperationsTaskStatus Status { get; set; }
    public bool IsOverdue { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? CancellationReason { get; set; }
}

public class CreateOperationsTaskDto
{
    public Guid ClinicBranchId { get; set; }
    public OperationsDepartment Department { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? AssigneeStaffId { get; set; }
    public DateOnly? DueDate { get; set; }
}

public class UpdateOperationsTaskDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public Guid? AssigneeStaffId { get; set; }
    public DateOnly? DueDate { get; set; }
}

public class GetOperationsTaskListInput : PagedAndSortedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
    public OperationsDepartment? Department { get; set; }
    public OperationsTaskStatus? Status { get; set; }
    public Guid? AssigneeStaffId { get; set; }
    public bool? OverdueOnly { get; set; }
    public string? Filter { get; set; }
}

public class CancelOperationsTaskDto
{
    public string Reason { get; set; } = string.Empty;
}

/// <summary>Counters for a department's Công việc board.</summary>
public class OperationsTaskStatsDto
{
    public int Total { get; set; }
    public int Todo { get; set; }
    public int InProgress { get; set; }
    public int Done { get; set; }
    public int Overdue { get; set; }
}
