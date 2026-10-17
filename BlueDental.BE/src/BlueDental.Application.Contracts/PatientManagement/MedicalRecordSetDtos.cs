using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.TreatmentManagement;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.PatientManagement;

/// <summary>A bộ hồ sơ bệnh án, with the treatment slips it was opened for.</summary>
public class MedicalRecordSetDto : CreationAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }

    /// <summary><c>HS{patient code}-{DDMMYYYY}-{nn}</c>.</summary>
    public string Code { get; set; } = string.Empty;

    public MedicalRecordSetStatus Status { get; set; }
    public DateTime? CancelledAt { get; set; }
    public Guid? CancelledById { get; set; }
    public string? CancellerName { get; set; }

    /// <summary>The forms its index shows ("Mục hiển thị"), in index order.</summary>
    public List<MedicalRecordForm> VisibleForms { get; set; } = new();

    /// <summary>
    /// Newest slip first. A live set lists the slips it holds; a cancelled one
    /// the slips it was opened for, though it no longer holds them.
    /// </summary>
    public List<MedicalRecordSetPlanDto> Plans { get; set; } = new();
}

/// <summary>
/// A treatment slip as the record sets see it: its numbers, what it treats, its
/// doctor, how far it has got, and which live set holds it.
/// </summary>
public class MedicalRecordSetPlanDto
{
    public Guid TreatmentPlanId { get; set; }

    /// <summary>Mã phiếu điều trị — DT01.</summary>
    public string PlanCode { get; set; } = string.Empty;

    public DateTime CreationTime { get; set; }

    /// <summary>Mã phiếu chẩn đoán — CD26-0039 — the slip's lines were consulted from; null when none was.</summary>
    public string? DiagnosisSlipCode { get; set; }

    /// <summary>Tên chẩn đoán, from Danh mục.</summary>
    public string? DiagnosisName { get; set; }

    /// <summary>The services on the slip, comma separated.</summary>
    public string? TreatmentName { get; set; }

    public Guid DentistId { get; set; }
    public string? DentistName { get; set; }

    public TreatmentPlanStatus PlanStatus { get; set; }

    /// <summary>"Chưa điều trị" — the slip reads Đã tạo; only such a slip may leave or change set.</summary>
    public bool NotStarted { get; set; }

    /// <summary>The live set that holds the slip, if any.</summary>
    public Guid? RecordSetId { get; set; }
    public string? RecordSetCode { get; set; }
}

public class CreateMedicalRecordSetDto
{
    public Guid PatientId { get; set; }
    public List<Guid> TreatmentPlanIds { get; set; } = new();

    /// <summary>Empty means every form.</summary>
    public List<MedicalRecordForm> VisibleForms { get; set; } = new();
}

public class UpdateMedicalRecordSetDto
{
    /// <summary>The whole list the set should hold once saved.</summary>
    public List<Guid> TreatmentPlanIds { get; set; } = new();

    public List<MedicalRecordForm> VisibleForms { get; set; } = new();
}

public interface IMedicalRecordSetAppService : IApplicationService
{
    /// <summary>A patient's sets: live ones newest first, then the cancelled ones.</summary>
    Task<ListResultDto<MedicalRecordSetDto>> GetListAsync(Guid patientId);

    /// <summary>Every treatment slip of the patient, newest first, with the set holding it.</summary>
    Task<ListResultDto<MedicalRecordSetPlanDto>> GetPlansAsync(Guid patientId);

    Task<MedicalRecordSetDto> CreateAsync(CreateMedicalRecordSetDto input);

    Task<MedicalRecordSetDto> UpdateAsync(Guid id, UpdateMedicalRecordSetDto input);

    /// <summary>"Hủy bộ hồ sơ" — kept, read-only, its slips freed.</summary>
    Task<MedicalRecordSetDto> CancelAsync(Guid id);
}
