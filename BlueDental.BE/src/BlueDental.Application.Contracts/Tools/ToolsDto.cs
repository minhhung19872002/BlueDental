using System;
using System.ComponentModel.DataAnnotations;

namespace BlueDental.Tools;

// ── Call Configuration ────────────────────────────────────────────────────

// The secret ("Mã bí mật") is write-only: no DTO ever carries it back out.
public class CallConfigurationDto
{
    public Guid Id { get; set; }
    public Guid BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Provider { get; set; }
    public string ApiKey { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreationTime { get; set; }
}

public class CreateCallConfigurationDto
{
    [Required] public Guid BranchId { get; set; }
    [Required] public string Name { get; set; } = string.Empty;
    public int Provider { get; set; }
    [Required] public string ApiKey { get; set; } = string.Empty;
    [Required] public string SecretKey { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class UpdateCallConfigurationDto
{
    [Required] public string Name { get; set; } = string.Empty;
    public int Provider { get; set; }
    [Required] public string ApiKey { get; set; } = string.Empty;
    /// <summary>Blank keeps the stored secret — the client never sees it.</summary>
    public string? SecretKey { get; set; }
    public bool IsActive { get; set; }
}

public class GetCallConfigurationListInput
{
    public string? Filter { get; set; }
    public int MaxResultCount { get; set; } = 20;
    public int SkipCount { get; set; }
}

// ── Call Assignment ───────────────────────────────────────────────────────

public class CallAssignmentDto
{
    public Guid Id { get; set; }
    public string Sip { get; set; } = string.Empty;
    public Guid CallConfigurationId { get; set; }
    public string ConfigurationName { get; set; } = string.Empty;
    public Guid StaffId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public int Provider { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreationTime { get; set; }
}

public class CreateCallAssignmentDto
{
    [Required] public Guid BranchId { get; set; }
    [Required] public string Sip { get; set; } = string.Empty;
    [Required] public Guid CallConfigurationId { get; set; }
    [Required] public Guid StaffId { get; set; }
    public bool IsActive { get; set; } = true;
}

public class UpdateCallAssignmentDto
{
    [Required] public string Sip { get; set; } = string.Empty;
    [Required] public Guid CallConfigurationId { get; set; }
    [Required] public Guid StaffId { get; set; }
    public bool IsActive { get; set; }
}

public class GetCallAssignmentListInput
{
    public string? Filter { get; set; }
    public int MaxResultCount { get; set; } = 20;
    public int SkipCount { get; set; }
}

// ── Call Log ──────────────────────────────────────────────────────────────

public class CallLogDto
{
    public Guid Id { get; set; }
    public Guid? StaffId { get; set; }
    public string? StaffName { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string CallCode { get; set; } = string.Empty;
    public string? ExtensionCode { get; set; }
    public string PhoneNumber { get; set; } = string.Empty;
    public int Status { get; set; }
    public int Provider { get; set; }
    public DateTime CalledAt { get; set; }
}

// Kept so tests and a future provider webhook can record calls; the reference
// UI itself only reads this list.
public class CreateCallLogDto
{
    [Required] public Guid BranchId { get; set; }
    public Guid? StaffId { get; set; }
    public string? StaffName { get; set; }
    [Required] public string CallCode { get; set; } = string.Empty;
    public string? ExtensionCode { get; set; }
    [Required] public string PhoneNumber { get; set; } = string.Empty;
    public int Status { get; set; }
    public int Provider { get; set; }
    public DateTime CalledAt { get; set; }
}

public class GetCallLogListInput
{
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public Guid? StaffId { get; set; }
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
    [Required] public Guid BranchId { get; set; }
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
    public Guid? BranchId { get; set; }
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
    public Guid? BranchId { get; set; }
    public int? Channel { get; set; }
    public int? Status { get; set; }
    public string? Filter { get; set; }
    public int MaxResultCount { get; set; } = 20;
    public int SkipCount { get; set; }
}
