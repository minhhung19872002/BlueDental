using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.Inventory;

public class MaterialAllocationDto : FullAuditedEntityDto<Guid>
{
    public string AllocationCode { get; set; } = default!;
    public Guid DepartmentId { get; set; }
    public string? DepartmentName { get; set; }
    public string? PerformerName { get; set; }
    public string? Note { get; set; }
    public DateTime AllocationTime { get; set; }

    /// <summary>The materials this voucher issued, one line each.</summary>
    public List<MaterialAllocationItemDto> Items { get; set; } = [];
}

public class MaterialAllocationItemDto
{
    public Guid InventoryItemId { get; set; }
    public string Name { get; set; } = default!;
    public decimal Quantity { get; set; }

    /// <summary>Null until a stock-take comes back, which is why the column reads "—".</summary>
    public decimal? ConfirmedQuantity { get; set; }
}

public class CreateMaterialAllocationDto
{
    [Required]
    public Guid DepartmentId { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "Chọn ít nhất một vật tư để phân bổ.")]
    public List<CreateMaterialAllocationItemDto> Items { get; set; } = [];

    [MaxLength(200)]
    public string? PerformerName { get; set; }

    [MaxLength(1000)]
    public string? Note { get; set; }
}

public class CreateMaterialAllocationItemDto
{
    [Required]
    public Guid InventoryItemId { get; set; }

    [Range(0.001, double.MaxValue, ErrorMessage = "Số lượng phân bổ phải lớn hơn 0.")]
    public decimal Quantity { get; set; }
}

public class ConfirmAllocationRemainingDto
{
    [Required]
    public Guid InventoryItemId { get; set; }

    [Range(0, double.MaxValue)]
    public decimal Remaining { get; set; }
}

public class GetMaterialAllocationListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? DepartmentId { get; set; }
    public Guid? BranchId { get; set; }
}

public interface IMaterialAllocationAppService : IApplicationService
{
    Task<PagedResultDto<MaterialAllocationDto>> GetListAsync(GetMaterialAllocationListInput input);
    Task<MaterialAllocationDto> CreateAsync(CreateMaterialAllocationDto input);
    Task<MaterialAllocationDto> ConfirmRemainingAsync(Guid id, ConfirmAllocationRemainingDto input);
    Task DeleteAsync(Guid id);
}
