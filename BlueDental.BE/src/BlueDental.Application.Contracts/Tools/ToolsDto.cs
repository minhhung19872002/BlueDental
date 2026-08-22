using System;
using System.ComponentModel.DataAnnotations;

namespace BlueDental.Tools;

// ── Call Assignment ───────────────────────────────────────────────────────

public class CallAssignmentDto
{
    public Guid Id { get; set; }
    public Guid PatientId { get; set; }
    public Guid StaffId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? StaffName { get; set; }
    public string? Notes { get; set; }
    public int Status { get; set; }
    public DateTime? CalledAt { get; set; }
    public DateTime CreationTime { get; set; }
}

public class CreateCallAssignmentDto
{
    [Required] public Guid PatientId { get; set; }
    [Required] public Guid StaffId { get; set; }
    [Required] public string PatientName { get; set; } = string.Empty;
    [Required] public string PhoneNumber { get; set; } = string.Empty;
    public string? Notes { get; set; }
}

public class UpdateCallAssignmentStatusDto
{
    [Required] public int Status { get; set; }
    public string? Notes { get; set; }
}

public class GetCallAssignmentListInput
{
    public int? Status { get; set; }
    public Guid? StaffId { get; set; }
    public string? Filter { get; set; }
    public int MaxResultCount { get; set; } = 20;
    public int SkipCount { get; set; }
}

// ── Call Log ──────────────────────────────────────────────────────────────

public class CallLogDto
{
    public Guid Id { get; set; }
    public Guid? PatientId { get; set; }
    public Guid? StaffId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string? StaffName { get; set; }
    public int DurationSeconds { get; set; }
    public int Direction { get; set; }
    public int Status { get; set; }
    public string? Notes { get; set; }
    public DateTime CreationTime { get; set; }
}

public class CreateCallLogDto
{
    public Guid? PatientId { get; set; }
    public Guid? StaffId { get; set; }
    [Required] public string PatientName { get; set; } = string.Empty;
    [Required] public string PhoneNumber { get; set; } = string.Empty;
    public string? StaffName { get; set; }
    public int DurationSeconds { get; set; }
    public int Direction { get; set; }
    public int Status { get; set; }
    public string? Notes { get; set; }
}

public class GetCallLogListInput
{
    public int? Direction { get; set; }
    public int? Status { get; set; }
    public string? Filter { get; set; }
    public int MaxResultCount { get; set; } = 20;
    public int SkipCount { get; set; }
}

// ── Message Template ──────────────────────────────────────────────────────

public class MessageTemplateDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int Channel { get; set; }
    public string? Category { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreationTime { get; set; }
    public DateTime? LastModificationTime { get; set; }
}

public class CreateMessageTemplateDto
{
    [Required] public string Name { get; set; } = string.Empty;
    [Required] public string Content { get; set; } = string.Empty;
    [Required] public int Channel { get; set; }
    public string? Category { get; set; }
}

public class UpdateMessageTemplateDto
{
    [Required] public string Name { get; set; } = string.Empty;
    [Required] public string Content { get; set; } = string.Empty;
    public string? Category { get; set; }
}

public class GetMessageTemplateListInput
{
    public int? Channel { get; set; }
    public string? Filter { get; set; }
    public int MaxResultCount { get; set; } = 20;
    public int SkipCount { get; set; }
}

// ── Message Log ───────────────────────────────────────────────────────────

public class MessageLogDto
{
    public Guid Id { get; set; }
    public Guid? PatientId { get; set; }
    public Guid? TemplateId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string RecipientPhone { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public int Channel { get; set; }
    public int Status { get; set; }
    public DateTime? SentAt { get; set; }
    public string? ErrorMessage { get; set; }
    public DateTime CreationTime { get; set; }
}

public class GetMessageLogListInput
{
    public int? Channel { get; set; }
    public int? Status { get; set; }
    public string? Filter { get; set; }
    public int MaxResultCount { get; set; } = 20;
    public int SkipCount { get; set; }
}
