using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Labo;

public interface ILaboAppService : IApplicationService
{
    Task<PagedResultDto<LaboOrderDto>> GetListAsync(GetLaboOrderListInput input);
    Task<LaboStatsDto> GetStatsAsync(GetLaboOrderListInput input);
    Task<LaboOrderDto> GetAsync(Guid id);
    Task<LaboOrderDto> CreateAsync(CreateLaboOrderDto input);

    /// <summary>
    /// Số phiếu Labo the next order would take, so "Đặt mới" can open with it
    /// filled in the way the reference does.
    /// </summary>
    Task<string> GetNextOrderCodeAsync();
    Task<LaboOrderDto> UpdateAsync(Guid id, UpdateLaboOrderDto input);
    Task SendAsync(Guid id);
    Task ReceiveAsync(Guid id);
    Task CompleteAsync(Guid id);
    Task RejectAsync(Guid id, string reason);

    /// <summary>"Xuất Excel" on the Labo screen.</summary>
    Task<byte[]> ExportAsync(GetLaboOrderListInput input);
}
