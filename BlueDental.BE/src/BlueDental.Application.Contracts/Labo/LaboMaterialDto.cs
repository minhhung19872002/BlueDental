using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Labo;

public class LaboMaterialDto : FullAuditedEntityDto<Guid>
{
    public string Name { get; set; } = default!;
    public string? Category { get; set; }
    public string? Description { get; set; }
    public Guid? SupplierId { get; set; }
    public bool IsActive { get; set; }
}

public class CreateLaboMaterialDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = default!;

    [MaxLength(100)]
    public string? Category { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    public Guid? SupplierId { get; set; }
}

public class UpdateLaboMaterialDto
{
    [Required]
    [MaxLength(200)]
    public string Name { get; set; } = default!;

    [MaxLength(100)]
    public string? Category { get; set; }

    [MaxLength(1000)]
    public string? Description { get; set; }

    public Guid? SupplierId { get; set; }
}

public class GetLaboMaterialListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
}

public interface ILaboMaterialAppService : IApplicationService
{
    Task<PagedResultDto<LaboMaterialDto>> GetListAsync(GetLaboMaterialListInput input);
    Task<LaboMaterialDto> CreateAsync(CreateLaboMaterialDto input);
    Task<LaboMaterialDto> UpdateAsync(Guid id, UpdateLaboMaterialDto input);
    Task DeleteAsync(Guid id);
}
