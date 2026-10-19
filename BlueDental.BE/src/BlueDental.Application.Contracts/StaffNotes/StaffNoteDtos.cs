using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.StaffNotes;

public class StaffNoteDto : EntityDto<Guid>
{
    public StaffNoteScope Scope { get; set; }

    public Guid? ClinicBranchId { get; set; }

    public string Content { get; set; } = string.Empty;

    public Guid? CreatorId { get; set; }

    /// <summary>The author's display name, shown under a Chung note.</summary>
    public string? CreatorName { get; set; }

    public DateTime CreationTime { get; set; }

    public DateTime? LastModificationTime { get; set; }

    /// <summary>True when the caller wrote the note, so Sửa / Xóa apply.</summary>
    public bool CanEdit { get; set; }
}

public class GetStaffNoteListInput : PagedResultRequestDto
{
    public StaffNoteScope Scope { get; set; } = StaffNoteScope.Shared;

    /// <summary>Words the content has to hold, in any order and case.</summary>
    public string? Filter { get; set; }
}

public class CreateStaffNoteDto
{
    public StaffNoteScope Scope { get; set; }

    public string Content { get; set; } = string.Empty;
}

public class UpdateStaffNoteDto
{
    public string Content { get; set; } = string.Empty;
}
