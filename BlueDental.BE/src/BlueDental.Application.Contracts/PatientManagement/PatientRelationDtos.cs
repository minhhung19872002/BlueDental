using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.PatientManagement;

/// <summary>
/// "Mối quan hệ" (function list 4.8). BlueDental-local; see
/// docs/clone/pages/patient-relations.md. Guarded by the patient subject: the
/// relations are part of the record.
/// </summary>
public interface IPatientRelationshipAppService : IApplicationService
{
    /// <summary>Every record related to the patient — declared relations and guardian links.</summary>
    Task<ListResultDto<PatientRelationDto>> GetListAsync(Guid patientId);

    /// <summary>
    /// Người nhà: family relations, guardian links and the members of the
    /// patient's family group — who a family prepaid card may be shared with.
    /// </summary>
    Task<ListResultDto<PatientRelationDto>> GetFamilyAsync(Guid patientId);

    Task<PatientRelationDto> CreateAsync(CreatePatientRelationDto input);
    Task<PatientRelationDto> UpdateAsync(Guid id, UpdatePatientRelationDto input);
    Task DeleteAsync(Guid id);
}

/// <summary>Where a relation comes from; only <see cref="Relationship"/> rows can be edited here.</summary>
public enum PatientRelationSource
{
    Relationship = 1,
    /// <summary>A guardian picked from a patient record (Người giám hộ, 4.9) — edited there.</summary>
    Guardian = 2,
    /// <summary>A fellow member of the family group (Hồ sơ nhóm) with no declared relation.</summary>
    FamilyGroup = 3,
}

/// <summary>For a <see cref="PatientRelationSource.Guardian"/> row: who guards whom.</summary>
public enum GuardianDirection
{
    /// <summary>The other record is this patient's guardian.</summary>
    GuardsPatient = 1,
    /// <summary>This patient is the other record's guardian.</summary>
    GuardedByPatient = 2,
}

public class PatientRelationDto
{
    /// <summary>The relationship's id; null for guardian and family-group rows.</summary>
    public Guid? Id { get; set; }

    public PatientRelationSource Source { get; set; }
    public GuardianDirection? GuardianDirection { get; set; }

    public Guid RelatedPatientId { get; set; }
    public string RelatedPatientCode { get; set; } = string.Empty;
    public string RelatedPatientName { get; set; } = string.Empty;
    public Gender RelatedPatientGender { get; set; }
    public DateOnly? RelatedPatientDateOfBirth { get; set; }

    /// <summary>What the related record is to this patient; null for a family-group row.</summary>
    public PatientRelationType? Type { get; set; }

    public bool IsFamily { get; set; }
    public string? Note { get; set; }
}

public class CreatePatientRelationDto
{
    public Guid PatientId { get; set; }
    public Guid RelatedPatientId { get; set; }

    /// <summary>What the related record is to <see cref="PatientId"/>.</summary>
    public PatientRelationType Type { get; set; }

    [StringLength(PatientRelationConsts.MaxNoteLength)]
    public string? Note { get; set; }
}

public class UpdatePatientRelationDto
{
    /// <summary>The record the relation is read from — either side of the pair.</summary>
    public Guid PatientId { get; set; }

    public PatientRelationType Type { get; set; }

    [StringLength(PatientRelationConsts.MaxNoteLength)]
    public string? Note { get; set; }
}

/// <summary>"Hồ sơ nhóm" (function list 4.10). BlueDental-local; subject <c>patientGroup</c>.</summary>
public interface IPatientGroupAppService : IApplicationService
{
    Task<PagedResultDto<PatientGroupDto>> GetListAsync(GetPatientGroupListInput input);
    Task<PatientGroupDetailDto> GetAsync(Guid id);

    /// <summary>The groups a patient belongs to, with their members — the record's own tab.</summary>
    Task<ListResultDto<PatientGroupDetailDto>> GetByPatientAsync(Guid patientId);

    Task<PatientGroupDetailDto> CreateAsync(SavePatientGroupDto input);
    Task<PatientGroupDetailDto> UpdateAsync(Guid id, SavePatientGroupDto input);
    Task DeleteAsync(Guid id);
}

public class GetPatientGroupListInput : PagedResultRequestDto
{
    /// <summary>The group's name, or a member's name / code.</summary>
    public string? Filter { get; set; }

    public PatientGroupKind? Kind { get; set; }
}

public class PatientGroupDto : EntityDto<Guid>
{
    public string Name { get; set; } = string.Empty;
    public PatientGroupKind Kind { get; set; }
    public string? Note { get; set; }
    public string? SharedMedicalNote { get; set; }
    public int MemberCount { get; set; }
    public string? HeadName { get; set; }

    /// <summary>Every member's name, in order — for the list row.</summary>
    public List<string> MemberNames { get; set; } = new();

    public DateTime CreationTime { get; set; }
}

public class PatientGroupDetailDto : PatientGroupDto
{
    public List<PatientGroupMemberDto> Members { get; set; } = new();
}

/// <summary>One member, with what a dentist looks up first.</summary>
public class PatientGroupMemberDto
{
    public Guid PatientId { get; set; }
    public string PatientCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public Gender Gender { get; set; }
    public DateOnly? DateOfBirth { get; set; }
    public PatientGroupRole Role { get; set; }

    /// <summary>What this member is to the Chủ hộ, from the declared relations; null when none is declared.</summary>
    public PatientRelationType? RelationToHead { get; set; }

    /// <summary>Tiểu sử bệnh — names from the Lịch sử bệnh catalog.</summary>
    public List<string> DiseaseHistory { get; set; } = new();

    public DateTimeOffset? LastVisitAt { get; set; }
    public DateTimeOffset? NextAppointmentAt { get; set; }
    public decimal TotalDebt { get; set; }
}

public class SavePatientGroupDto
{
    [Required]
    [StringLength(PatientRelationConsts.MaxGroupNameLength)]
    public string Name { get; set; } = string.Empty;

    public PatientGroupKind Kind { get; set; } = PatientGroupKind.Family;

    [StringLength(PatientRelationConsts.MaxGroupNoteLength)]
    public string? Note { get; set; }

    [StringLength(PatientRelationConsts.MaxSharedMedicalNoteLength)]
    public string? SharedMedicalNote { get; set; }

    public List<SavePatientGroupMemberDto> Members { get; set; } = new();
}

public class SavePatientGroupMemberDto
{
    public Guid PatientId { get; set; }
    public PatientGroupRole Role { get; set; } = PatientGroupRole.Member;
}
