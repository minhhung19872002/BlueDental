using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace BlueDental.CustomerCare;

/// <summary>A care note as both the chat's "Ghi chú nội bộ" and the record's "Lịch sử chăm sóc" show it.</summary>
public class CareNoteDto
{
    public Guid Id { get; set; }
    public Guid? ConversationId { get; set; }
    public Guid? PatientId { get; set; }
    public string Content { get; set; } = string.Empty;
    public CareNoteOutcome? Outcome { get; set; }
    public Guid AuthorId { get; set; }
    public string? AuthorName { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? LastEditorName { get; set; }
    public DateTime? LastEditedAt { get; set; }
    public bool IsRemoved { get; set; }
    public string? RemoverName { get; set; }
    public DateTime? RemovedAt { get; set; }

    /// <summary>Oldest first: Tạo, every Sửa with the text before and after, Xoá.</summary>
    public List<CareNoteRevisionDto> Revisions { get; set; } = [];
}

public class CareNoteRevisionDto
{
    public CareNoteAction Action { get; set; }
    public string? Before { get; set; }
    public string? After { get; set; }
    public string? ActorName { get; set; }
    public DateTime At { get; set; }
}

public class SaveCareNoteInput
{
    [Required]
    [StringLength(CareNoteConsts.MaxContentLength)]
    public string Content { get; set; } = string.Empty;

    /// <summary>"Kết quả cuộc gọi" — only when writing; a change keeps the one picked.</summary>
    public CareNoteOutcome? Outcome { get; set; }
}
