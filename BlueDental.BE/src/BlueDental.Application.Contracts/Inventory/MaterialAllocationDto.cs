using System;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Inventory;

public class MaterialAllocationDto : FullAuditedEntityDto<Guid>
{
    public string AllocationCode { get; set; } = default!;
    public Guid InventoryItemId { get; set; }
    public string? InventoryItemName { get; set; }
    public Guid DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public decimal AllocatedQuantity { get; set; }
    public decimal ConfirmedRemaining { get; set; }
    public string? PerformerName { get; set; }
    public string? Note { get; set; }
    public DateTime AllocationTime { get; set; }
}

public class CreateMaterialAllocationDto
{
    [Required]
    public Guid InventoryItemId { get; set; }

    [Required]
    public Guid DepartmentId { get; set; }

    [Range(0.001, double.MaxValue)]
    public decimal AllocatedQuantity { get; set; }

    [MaxLength(200)]
    public string? PerformerName { get; set; }

    [MaxLength(1000)]
    public string? Note { get; set; }
}

public class GetMaterialAllocationListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? DepartmentId { get; set; }
}

public interface IMaterialAllocationAppService : IApplicationService
{
    Task<PagedResultDto<MaterialAllocationDto>> GetListAsync(GetMaterialAllocationListInput input);
    Task<MaterialAllocationDto> CreateAsync(CreateMaterialAllocationDto input);
    Task DeleteAsync(Guid id);
}
