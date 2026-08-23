using System;
using Volo.Abp.Application.Dtos;

namespace BlueDental.Inventory;

/// <summary>
/// One row of the Vật tư table. Column order follows the reference: tên vật liệu,
/// nhóm phân loại, nhập kho, hạn sử dụng, cảnh báo hết hạn, tồn kho, trạng thái,
/// nhà cung cấp, xuất xứ, giá nhập, giá bán.
/// </summary>
public class InventoryItemDto : FullAuditedEntityDto<Guid>
{
    public string ItemCode { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? TaxonomyId { get; set; }
    public string? TaxonomyName { get; set; }
    public string? Category { get; set; }
    public string? Unit { get; set; }
    public DateOnly? StockedAt { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public int ExpiryWarningDays { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderLevel { get; set; }
    public bool NeedsReorder { get; set; }

    /// <summary>Derived from stock and expiry — see InventoryItem.StatusAsOf.</summary>
    public SupplyStatus Status { get; set; }

    public string? Supplier { get; set; }
    public string? Origin { get; set; }

    /// <summary>Giá nhập.</summary>
    public decimal? UnitCost { get; set; }

    /// <summary>Giá bán.</summary>
    public decimal? SalePrice { get; set; }

    public Guid BranchId { get; set; }
    public bool IsActive { get; set; }
}

public class CreateInventoryItemDto
{
    public string ItemCode { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string? Description { get; set; }
    public Guid? TaxonomyId { get; set; }
    public string? Category { get; set; }
    public string? Unit { get; set; }
    public decimal ReorderLevel { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? SalePrice { get; set; }
    public string? Supplier { get; set; }
    public string? Origin { get; set; }
    public Guid BranchId { get; set; }
}

public class UpdateInventoryItemDto
{
    public string Name { get; set; } = default!;
    public Guid? TaxonomyId { get; set; }
    public string? Unit { get; set; }
    public decimal ReorderLevel { get; set; }
    public decimal? UnitCost { get; set; }
    public decimal? SalePrice { get; set; }
    public string? Supplier { get; set; }
    public string? Origin { get; set; }
}

public class AdjustStockDto
{
    public StockMovementType MovementType { get; set; }
    public decimal Quantity { get; set; }
    public string? Notes { get; set; }
}

/// <summary>Nhập kho — a receipt carries its own expiry.</summary>
public class ReceiveStockDto
{
    public decimal Quantity { get; set; }
    public DateOnly StockedAt { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public int? ExpiryWarningDays { get; set; }
}

public class GetInventoryItemListInput : PagedAndSortedResultRequestDto
{
    public string? Filter { get; set; }
    public Guid? BranchId { get; set; }
    public Guid? TaxonomyId { get; set; }
    public bool? NeedsReorder { get; set; }
    public SupplyStatus? Status { get; set; }
    public bool? IsActive { get; set; }
}

/// <summary>Counters above the supplies table.</summary>
public class InventoryStatsDto
{
    public int Total { get; set; }
    public int Available { get; set; }
    public int LowStock { get; set; }
    public int OutOfStock { get; set; }
    public int ExpiringSoon { get; set; }
    public int Expired { get; set; }
    public decimal StockValue { get; set; }
}
