using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Operations;

/// <summary>
/// Trang chủ / Quy trình của từng khối (Quản trị vận hành).
/// </summary>
public interface IOperationsArticleAppService : IApplicationService
{
    Task<PagedResultDto<OperationsArticleDto>> GetListAsync(GetOperationsArticleListInput input);
    Task<OperationsArticleDto> GetAsync(Guid id);
    Task<OperationsArticleDto> CreateAsync(CreateOperationsArticleDto input);
    Task<OperationsArticleDto> UpdateAsync(Guid id, UpdateOperationsArticleDto input);
    Task<OperationsArticleDto> PublishAsync(Guid id);
    Task<OperationsArticleDto> UnpublishAsync(Guid id);
    Task DeleteAsync(Guid id);
}

/// <summary>
/// Công việc của từng khối.
/// </summary>
public interface IOperationsTaskAppService : IApplicationService
{
    Task<PagedResultDto<OperationsTaskDto>> GetListAsync(GetOperationsTaskListInput input);
    Task<OperationsTaskStatsDto> GetStatsAsync(GetOperationsTaskListInput input);
    Task<OperationsTaskDto> GetAsync(Guid id);
    Task<OperationsTaskDto> CreateAsync(CreateOperationsTaskDto input);
    Task<OperationsTaskDto> UpdateAsync(Guid id, UpdateOperationsTaskDto input);
    Task<OperationsTaskDto> StartAsync(Guid id);
    Task<OperationsTaskDto> CompleteAsync(Guid id);
    Task<OperationsTaskDto> CancelAsync(Guid id, CancelOperationsTaskDto input);
    Task DeleteAsync(Guid id);
}
