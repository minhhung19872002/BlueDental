using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Organizations;

public interface IClinicBranchAppService : IApplicationService
{
    Task<PagedResultDto<ClinicBranchDto>> GetListAsync(GetClinicBranchListInput input);

    /// <summary>
    /// The branches the caller may work in, for the header branch picker.
    /// Needs only a signed-in user, not the Organizations permission.
    /// </summary>
    Task<ListResultDto<ClinicBranchDto>> GetAccessibleAsync();
    Task<ClinicBranchDto> GetAsync(Guid id);
    Task<ClinicBranchDto> CreateAsync(CreateClinicBranchDto input);
    Task<ClinicBranchDto> UpdateAsync(Guid id, UpdateClinicBranchDto input);
    Task DeleteAsync(Guid id);
}
