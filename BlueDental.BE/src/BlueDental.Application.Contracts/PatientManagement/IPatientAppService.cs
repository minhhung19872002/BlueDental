using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.PatientManagement;

public interface IPatientAppService : IApplicationService
{
    Task<PagedResultDto<PatientDto>> GetListAsync(GetPatientListInput input);
    Task<PatientDto> GetAsync(Guid id);
    Task<PatientDto> RegisterAsync(RegisterPatientDto input);
    Task<PatientDto> UpdateAsync(Guid id, UpdatePatientDto input);
    Task DeactivateAsync(Guid id);

    /// <summary>"Xuất file" on the patient list.</summary>
    Task<byte[]> ExportAsync(GetPatientListInput input);
}
