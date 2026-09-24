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
    /// Số phiếu Labo the next order would take, so "BE:LaboField:NewOrder" can open with it
    /// filled in the way the reference does.
    /// </summary>
    Task<string> GetNextOrderCodeAsync();
    Task<LaboOrderDto> UpdateAsync(Guid id, UpdateLaboOrderDto input);

    /// <summary>The detail dialog's Lưu: status and new pictures.</summary>
    Task<LaboOrderDto> SaveDetailAsync(Guid id, SaveLaboOrderDetailDto input);
    Task SendAsync(Guid id);
    Task ReceiveAsync(Guid id);
    Task CompleteAsync(Guid id);
    Task RejectAsync(Guid id, string reason);

    /// <summary>"BE:Common:ExportExcel" on the Labo screen.</summary>
    Task<byte[]> ExportAsync(GetLaboOrderListInput input);
}
