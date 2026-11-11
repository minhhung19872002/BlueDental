using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.Imaging;

public static class XrayDeviceConsts
{
    public const int MaxNameLength = 100;

    /// <summary>The header the X-ray agent sends its token in.</summary>
    public const string TokenHeader = "X-Xray-Device-Token";
}

// ── Cài đặt → Máy X-quang ───────────────────────────────────────────────────

public class XrayDeviceDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTime CreationTime { get; set; }
    public DateTimeOffset? LastSeenAt { get; set; }
    public DateTimeOffset? RevokedAt { get; set; }
    public bool IsActive { get; set; }
}

/// <summary>Only the create call carries the token — shown once, to paste into the agent.</summary>
public class PairedXrayDeviceDto : XrayDeviceDto
{
    public string Token { get; set; } = string.Empty;
}

public class CreateXrayDeviceDto
{
    public Guid ClinicBranchId { get; set; }

    [Required]
    [StringLength(XrayDeviceConsts.MaxNameLength)]
    public string Name { get; set; } = string.Empty;
}

public interface IXrayDeviceAppService : IApplicationService
{
    Task<List<XrayDeviceDto>> GetListAsync(Guid clinicBranchId);
    Task<PairedXrayDeviceDto> CreateAsync(CreateXrayDeviceDto input);
    Task RevokeAsync(Guid id);

    /// <summary>The branch has a paired PC: the Hình ảnh tab offers "Mở EzDent-i".</summary>
    Task<bool> HasActiveAsync(Guid clinicBranchId);
}

// ── Station: what the agent on the X-ray PC calls ───────────────────────────

public class XrayStationDto
{
    public string DeviceName { get; set; } = string.Empty;
    public string BranchName { get; set; } = string.Empty;
}

public class ReceiveXrayImageDto
{
    public IRemoteStreamContent? File { get; set; }

    /// <summary>Mã hồ sơ read off the file or folder name.</summary>
    public string? Code { get; set; }

    /// <summary>Patient name read off the file name — a suggestion only, never matched on.</summary>
    public string? Name { get; set; }

    public int? BirthYear { get; set; }

    /// <summary>When the file was written on the X-ray PC.</summary>
    public DateTimeOffset? CapturedAt { get; set; }
}

public class XrayReceiveResultDto
{
    public Guid InboxItemId { get; set; }
    public XrayInboxStatus Status { get; set; }

    /// <summary>The same bytes were already received from this PC; nothing was added.</summary>
    public bool Duplicate { get; set; }
}

/// <summary>What linkage.xml needs to open the patient in EzDent-i — nothing more.</summary>
public class XrayStationPatientDto
{
    public string PatientCode { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public Gender Gender { get; set; }
}

public interface IXrayStationAppService : IApplicationService
{
    Task<XrayStationDto> PingAsync(string? token);
    Task<XrayReceiveResultDto> ReceiveImageAsync(string? token, ReceiveXrayImageDto input);
    Task<XrayStationPatientDto> GetPatientByCodeAsync(string? token, string code);
}

// ── Ảnh chưa gán hồ sơ ──────────────────────────────────────────────────────

public class GetXrayInboxListInput : PagedResultRequestDto
{
    public Guid? ClinicBranchId { get; set; }
}

public class XrayInboxItemDto : EntityDto<Guid>
{
    public Guid ClinicBranchId { get; set; }
    public Guid XrayDeviceId { get; set; }
    public string? XrayDeviceName { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string? HintCode { get; set; }
    public string? HintName { get; set; }
    public int? HintBirthYear { get; set; }
    public DateTimeOffset? CapturedAt { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public XrayInboxStatus Status { get; set; }
    public string Url { get; set; } = string.Empty;
}

public enum XraySuggestionReason
{
    /// <summary>The code read off the file is this record's, in another spelling or as its ID hệ thống.</summary>
    Code = 1,

    /// <summary>Same name (accents aside) and birth year.</summary>
    NameAndBirthYear = 2,

    /// <summary>Same name, birth year unknown on one side.</summary>
    Name = 3
}

public class XrayPatientSuggestionDto
{
    public Guid PatientId { get; set; }
    public string PatientCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int? BirthYear { get; set; }
    public XraySuggestionReason Reason { get; set; }
}

public class AssignXrayInboxItemDto
{
    public Guid PatientId { get; set; }
}

public interface IXrayInboxAppService : IApplicationService
{
    Task<PagedResultDto<XrayInboxItemDto>> GetListAsync(GetXrayInboxListInput input);
    Task<int> GetCountAsync(Guid? clinicBranchId);
    Task<IRemoteStreamContent> GetContentAsync(Guid id);
    Task<List<XrayPatientSuggestionDto>> GetSuggestionsAsync(Guid id);

    /// <summary>Puts the picture on the record, in Trước điều trị; returns the new picture's id.</summary>
    Task<Guid> AssignAsync(Guid id, AssignXrayInboxItemDto input);

    Task DiscardAsync(Guid id);
}
