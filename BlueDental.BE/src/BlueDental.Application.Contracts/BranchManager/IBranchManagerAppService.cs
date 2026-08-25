using System;
using System.IO;
using System.Threading.Tasks;
using BlueDental.Staff;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;
using Volo.Abp.Content;

namespace BlueDental.BranchManager;

public interface IBranchManagerAppService : IApplicationService
{
    Task<PagedResultDto<BranchManagerDto>> GetListAsync(GetBranchManagerListInput input);
    Task<BranchManagerDto> GetAsync(Guid id);
    Task<BranchManagerDto> CreateAsync(CreateBranchManagerDto input);
    Task<BranchManagerDto> UpdateAsync(Guid id, UpdateBranchManagerDto input);
    Task DeleteAsync(Guid id);
    Task<AvatarResultDto> UploadAvatarAsync(Guid id, RemoteStreamContent file);
    Task DeleteAvatarAsync(Guid id);
    Task<Stream> GetAvatarContentAsync(Guid id);
}
