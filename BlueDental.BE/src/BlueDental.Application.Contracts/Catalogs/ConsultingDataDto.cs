using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Catalogs;

public class ConsultingDataDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; }
}

public class CreateConsultingDataDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class UpdateConsultingDataDto
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class GetConsultingDataListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface IConsultingDataAppService : IApplicationService
{
    Task<PagedResultDto<ConsultingDataDto>> GetListAsync(GetConsultingDataListInput input);
    Task<ConsultingDataDto> GetAsync(Guid id);
    Task<ConsultingDataDto> CreateAsync(CreateConsultingDataDto input);
    Task<ConsultingDataDto> UpdateAsync(Guid id, UpdateConsultingDataDto input);
    Task DeleteAsync(Guid id);
}
