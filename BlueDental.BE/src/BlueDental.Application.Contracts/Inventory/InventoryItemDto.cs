using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Inventory;

public class InventoryItemDto : FullAuditedEntityDto<Guid>
{
    public string ItemCode { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Category { get; set; }
    public string? Unit { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderLevel { get; set; }
    public bool NeedsReorder { get; set; }
    public Guid BranchId { get; set; }
    public bool IsActive { get; set; }
}

public class CreateInventoryItemDto
{
    public string ItemCode { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public string? Category { get; set; }
    public string? Unit { get; set; }
    public decimal ReorderLevel { get; set; }
    public decimal? UnitCost { get; set; }
    public Guid BranchId { get; set; }
}

public class UpdateInventoryItemDto
{
    public string Name { get; set; } = default!;
    public string? Category { get; set; }
    public string? Unit { get; set; }
    public decimal ReorderLevel { get; set; }
    public decimal? UnitCost { get; set; }
}

public class AdjustStockDto
{
    public StockMovementType MovementType { get; set; }
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
}

public class GetInventoryItemListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? BranchId { get; set; }
    public bool? NeedsReorder { get; set; }
}
