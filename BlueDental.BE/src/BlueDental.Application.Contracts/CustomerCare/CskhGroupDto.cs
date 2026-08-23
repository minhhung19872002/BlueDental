using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.CustomerCare;

public class CskhGroupDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Criteria { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class CreateCskhGroupDto
{
    public string Name { get; set; } = default!;
    public string? Criteria { get; set; }
    public string? Description { get; set; }
}

public class UpdateCskhGroupDto
{
    public string Name { get; set; } = default!;
    public string? Criteria { get; set; }
    public string? Description { get; set; }
}

public class GetCskhGroupListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public bool? IsActive { get; set; }
}

public interface ICskhGroupAppService : IApplicationService
{
    Task<PagedResultDto<CskhGroupDto>> GetListAsync(GetCskhGroupListInput input);
    Task<CskhGroupDto> GetAsync(Guid id);
    Task<CskhGroupDto> CreateAsync(CreateCskhGroupDto input);
    Task<CskhGroupDto> UpdateAsync(Guid id, UpdateCskhGroupDto input);
    Task DeleteAsync(Guid id);
}
