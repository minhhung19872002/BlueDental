using System;
using System.Collections.Generic;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using System.Threading.Tasks;
using Volo.Abp.Content;

namespace BlueDental.PatientManagement;

public class PatientMedicalRecordDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public Guid RecordSetId { get; set; }
    public MedicalRecordForm Form { get; set; }
    public string Title { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string? Content { get; set; }

    /// <summary>Set once the sheet is cancelled ("Đã hủy").</summary>
    public DateTime? CancelledAt { get; set; }
    public Guid? CancelledById { get; set; }
    public string? CancellerName { get; set; }
    public string? CancelReason { get; set; }
}

public class CreatePatientMedicalRecordDto
{
    public Guid PatientId { get; set; }

    /// <summary>The bộ hồ sơ the sheet is added to; it must be the patient's and not cancelled.</summary>
    public Guid RecordSetId { get; set; }

    public MedicalRecordForm Form { get; set; }
    public string Title { get; set; } = string.Empty;
}

public class UpdatePatientMedicalRecordDto
{
    public string? Title { get; set; }
    public string? Content { get; set; }
}

public class GetPatientMedicalRecordListInput : PagedAndSortedResultRequestDto
{
    public Guid? PatientId { get; set; }
    public Guid? RecordSetId { get; set; }
    public MedicalRecordForm? Form { get; set; }
}

/// <summary>
/// The phones a bệnh án prints, in full. The sheets are never masked by
/// "Ẩn số điện thoại" (clinic, 2026-10-21), so — unlike PatientDto's — these
/// are not marked <see cref="PatientPhoneAttribute"/>.
/// </summary>
public class MedicalRecordPhonesDto
{
    public string? PatientPhone { get; set; }

    /// <summary>Each guardian's phone, by guardian id.</summary>
    public Dictionary<Guid, string> GuardianPhones { get; set; } = new();
}

/// <summary>"Hủy phiếu": the reason is required.</summary>
public class CancelPatientMedicalRecordDto
{
    public string? Reason { get; set; }
}

/// <summary>A drawing stored for a sheet; the sheet's content links to it by <see cref="Url"/>.</summary>
public class MedicalRecordDrawingDto
{
    public Guid Id { get; set; }

    /// <summary>Relative, as the content stores it: a host baked in would break when the app moved.</summary>
    public string Url { get; set; } = string.Empty;
}

public class UploadMedicalRecordDrawingDto
{
    /// <summary>Null when the request carried no file — reported as an invalid drawing.</summary>
    public IRemoteStreamContent? File { get; set; }
}

public interface IPatientMedicalRecordAppService : IApplicationService
{
    Task<PagedResultDto<PatientMedicalRecordDto>> GetListAsync(GetPatientMedicalRecordListInput input);

    Task<PatientMedicalRecordDto> GetAsync(Guid id);

    /// <summary>The patient's and guardians' phones as the sheets print them — whole.</summary>
    Task<MedicalRecordPhonesDto> GetPhonesAsync(Guid patientId);

    Task<PatientMedicalRecordDto> CreateAsync(CreatePatientMedicalRecordDto input);

    Task<PatientMedicalRecordDto> UpdateAsync(Guid id, UpdatePatientMedicalRecordDto input);

    /// <summary>
    /// "Hủy phiếu". A sheet is never erased: it stays in its set marked Đã hủy,
    /// with who cancelled it, when and why, and can no longer change.
    /// </summary>
    Task<PatientMedicalRecordDto> CancelAsync(Guid id, CancelPatientMedicalRecordDto input);

    /// <summary>
    /// Stores a drawing for the sheet. The sheet only links to it once its
    /// content is saved with the returned link.
    /// </summary>
    Task<MedicalRecordDrawingDto> UploadDrawingAsync(Guid id, UploadMedicalRecordDrawingDto input);

    Task<IRemoteStreamContent> GetDrawingAsync(Guid id, Guid drawingId);
}
