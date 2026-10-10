using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Staff;

/// <summary>Nhân sự → Sơ đồ tổ chức (F-67). BlueDental-local.</summary>
public interface IOrgChartAppService : IApplicationService
{
    Task<OrgChartDto> GetAsync();
    Task<OrgUnitCodeDto> GetNextCodeAsync(OrgUnitKind kind);
    Task<OrgUnitDto> CreateAsync(CreateOrgUnitDto input);
    Task<OrgUnitDto> UpdateAsync(Guid id, UpdateOrgUnitDto input);
    Task DeleteAsync(Guid id);
    Task<OrgUnitDto> ChangeRootHeadAsync(ChangeOrgRootHeadDto input);
    Task AssignAsync(AssignOrgUnitMembersDto input);
    Task<PagedResultDto<OrgUnitChangeLogDto>> GetHistoryAsync(GetOrgChartHistoryInput input);
}
