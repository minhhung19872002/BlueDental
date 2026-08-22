using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Organizations;

public class DepartmentDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? BranchId { get; set; }
    public bool IsActive { get; set; }
}

public class CreateDepartmentDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = default!;

    [MaxLength(1000)]
    public string? Description { get; set; }
}

public class UpdateDepartmentDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = default!;

    [MaxLength(1000)]
    public string? Description { get; set; }
}

public class GetDepartmentListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
}

public interface IDepartmentAppService : IApplicationService
{
    Task<PagedResultDto<DepartmentDto>> GetListAsync(GetDepartmentListInput input);
    Task<DepartmentDto> CreateAsync(CreateDepartmentDto input);
    Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentDto input);
    Task DeleteAsync(Guid id);
}
