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

/// <summary>
/// What the sheets of one set print about its treatment slips (save/P1810.drawio):
/// the set's numbers, its dates, each slip's doctor, the services on the slips
/// and every công đoạn worked on them.
/// </summary>
public class MedicalRecordSheetFactsDto
{
    /// <summary>Mã lưu trữ — <c>NK-{MMyy}{patient code}{oldest slip}</c>; null while the set holds no slip.</summary>
    public string? StorageCode { get; set; }

    /// <summary>Số ngoại trú — <c>NGT-{MMyy of the treatment start}{patient code}-{xxxx}</c>.</summary>
    public string? OutpatientNumber { get; set; }

    /// <summary>"BỆNH ÁN NĂM 20__" — the year the oldest slip was opened.</summary>
    public int? Year { get; set; }

    /// <summary>The oldest công đoạn of every slip.</summary>
    public DateOnly? TreatmentStartDate { get; set; }

    /// <summary>Null until every service on every slip is finished; warranty work is left out.</summary>
    public DateOnly? TreatmentEndDate { get; set; }

    /// <summary>The slips the set holds, oldest first.</summary>
    public List<MedicalRecordSheetPlanDto> Plans { get; set; } = new();

    /// <summary>Their services, slip by slip and in each slip's own order.</summary>
    public List<MedicalRecordSheetServiceDto> Services { get; set; } = new();

    /// <summary>Every công đoạn on those services, oldest first.</summary>
    public List<MedicalRecordSheetVisitDto> Visits { get; set; } = new();
}

public class MedicalRecordSheetPlanDto
{
    public Guid TreatmentPlanId { get; set; }
    public string PlanCode { get; set; } = string.Empty;
    public DateTime CreationTime { get; set; }

    /// <summary>When the slip joined the set — the set's history of what was added.</summary>
    public DateTime AttachedAt { get; set; }

    /// <summary>
    /// Bác sĩ điều trị — the slip's doctor (Bác sĩ tiếp nhận), as the sheets print a
    /// doctor: their Chức danh, else their name. Every name in these facts reads so.
    /// </summary>
    public string? DentistName { get; set; }

    /// <summary>Their Chức vụ from the staff record (not the Chức danh).</summary>
    public string? DentistPosition { get; set; }

    /// <summary>The day the slip's last service was finished; null while it is still being treated.</summary>
    public DateOnly? EndDate { get; set; }
}

public class MedicalRecordSheetServiceDto
{
    public Guid TreatmentPlanId { get; set; }
    public string ServiceName { get; set; } = string.Empty;
    public List<int> ToothCodes { get; set; } = new();

    /// <summary>The diagnosis declared for the service, as Danh mục codes it (K12.2).</summary>
    public string? DiagnosisCode { get; set; }
    public string? DiagnosisName { get; set; }

    /// <summary>Thành tiền of the line.</summary>
    public decimal Amount { get; set; }

    /// <summary>The consulting line it came from: its day, and Nhân sự tư vấn 1.</summary>
    public DateTime? ConsultedAt { get; set; }
    public string? ConsultantName { get; set; }
}

/// <summary>One công đoạn, as Phiếu theo dõi điều trị lists it.</summary>
public class MedicalRecordSheetVisitDto
{
    public DateOnly TreatmentDate { get; set; }

    /// <summary>When the công đoạn was written — the hh:mm printed beside its day.</summary>
    public DateTime RecordedAt { get; set; }

    public string ServiceName { get; set; } = string.Empty;
    public List<int> ToothCodes { get; set; } = new();
    public string? DiagnosisCode { get; set; }
    public string? DiagnosisName { get; set; }

    /// <summary>Nội dung điều trị — the công đoạn's note.</summary>
    public string? Content { get; set; }

    public string? DoctorName { get; set; }
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

    /// <summary>What the set's sheets print about its treatment slips.</summary>
    Task<MedicalRecordSheetFactsDto> GetSheetFactsAsync(Guid id);
}
