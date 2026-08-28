using System;
using System.Collections.Generic;
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
    public int SortOrder { get; set; }
}

public class CreateDepartmentDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = default!;

    [MaxLength(1000)]
    public string? Description { get; set; }

    /// <summary>"Số thứ tự" on the reference's dialog.</summary>
    public int SortOrder { get; set; }
}

public class UpdateDepartmentDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = default!;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public int? SortOrder { get; set; }
}

public class GetDepartmentListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? BranchId { get; set; }
}

public class ReorderDepartmentsDto
{
    /// <summary>Department ids in their new order.</summary>
    [Required]
    public List<Guid> Ids { get; set; } = [];
}

public interface IDepartmentAppService : IApplicationService
{
    Task<PagedResultDto<DepartmentDto>> GetListAsync(GetDepartmentListInput input);
    Task<DepartmentDto> CreateAsync(CreateDepartmentDto input);
    Task<DepartmentDto> UpdateAsync(Guid id, UpdateDepartmentDto input);
    Task DeleteAsync(Guid id);

    /// <summary>Persists a whole new order in one call, as the panels do.</summary>
    Task ReorderAsync(ReorderDepartmentsDto input);
}
