using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Labo;

public interface ILaboAppService : IApplicationService
{
    Task<PagedResultDto<LaboOrderDto>> GetListAsync(GetLaboOrderListInput input);
    Task<LaboOrderDto> GetAsync(Guid id);
    Task<LaboOrderDto> CreateAsync(CreateLaboOrderDto input);
    Task<LaboOrderDto> UpdateAsync(Guid id, UpdateLaboOrderDto input);
    Task SendAsync(Guid id);
    Task ReceiveAsync(Guid id);
    Task CompleteAsync(Guid id);
    Task RejectAsync(Guid id, string reason);
}
