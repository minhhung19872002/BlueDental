using System;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using System.Threading.Tasks;

namespace BlueDental.PatientManagement;

public class PatientMedicalRecordDto : FullAuditedEntityDto<Guid>
{
    public Guid PatientId { get; set; }
    public Guid ClinicBranchId { get; set; }
    public MedicalRecordForm Form { get; set; }
    public string Title { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public string? Content { get; set; }
}

public class CreatePatientMedicalRecordDto
{
    public Guid PatientId { get; set; }
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
    public MedicalRecordForm? Form { get; set; }
}

public interface IPatientMedicalRecordAppService : IApplicationService
{
    Task<PagedResultDto<PatientMedicalRecordDto>> GetListAsync(GetPatientMedicalRecordListInput input);

    Task<PatientMedicalRecordDto> GetAsync(Guid id);

    Task<PatientMedicalRecordDto> CreateAsync(CreatePatientMedicalRecordDto input);

    Task<PatientMedicalRecordDto> UpdateAsync(Guid id, UpdatePatientMedicalRecordDto input);

    Task DeleteAsync(Guid id);
}
