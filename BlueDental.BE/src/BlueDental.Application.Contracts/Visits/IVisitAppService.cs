using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Visits;

public interface IVisitAppService : IApplicationService
{
    Task<PagedResultDto<VisitDto>> GetListAsync(GetVisitListInput input);
    Task<VisitStatsDto> GetStatsAsync(GetVisitListInput input);
    Task<VisitDto> GetAsync(Guid id);
    Task<VisitDto> CreateAsync(CreateVisitDto input);
    Task<VisitDto> UpdateAsync(Guid id, UpdateVisitDto input);
    Task CheckInAsync(Guid id);
    Task StartAsync(Guid id);
    Task CompleteAsync(Guid id, string? notes);
    Task CancelAsync(Guid id, string reason);
    Task MarkNoShowAsync(Guid id);
    Task<VisitDto> RecordOutcomeAsync(Guid id, RecordVisitOutcomeDto input);
}
