using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Inventory;

/// <summary>
/// Aggregate root for dental supply/material inventory items.
/// </summary>
public class InventoryItem : FullAuditedAggregateRoot<Guid>
{
    public string ItemCode { get; private set; } = default!;
    public string Name { get; private set; } = default!;
    public string? Description { get; private set; }
    public string? Category { get; private set; }
    public string? Unit { get; private set; }
    public decimal QuantityOnHand { get; private set; }
    public decimal ReorderLevel { get; private set; }
    public decimal? UnitCost { get; private set; }
    public string? Supplier { get; private set; }
    public Guid BranchId { get; private set; }
    public bool IsActive { get; private set; }

    /// <summary>Nhóm phân loại — a taxonomy group of the <c>supplies</c> catalog.</summary>
    public Guid? TaxonomyId { get; private set; }

    /// <summary>Nhập kho — when the current stock was received.</summary>
    public DateOnly? StockedAt { get; private set; }

    /// <summary>Hạn sử dụng.</summary>
    public DateOnly? ExpiryDate { get; private set; }

    /// <summary>Cảnh báo hết hạn — how many days ahead to warn.</summary>
    public int ExpiryWarningDays { get; private set; }

    /// <summary>Xuất xứ.</summary>
    public string? Origin { get; private set; }

    /// <summary>Giá bán (giá nhập is <see cref="UnitCost"/>).</summary>
    public decimal? SalePrice { get; private set; }

    protected InventoryItem() { }

    public InventoryItem(
        Guid id,
        string itemCode,
        string name,
        Guid branchId,
        decimal reorderLevel,
        string? category = null,
        string? unit = null,
        decimal? unitCost = null)
        : base(id)
    {
        ItemCode = itemCode;
        Name = name;
        BranchId = branchId;
        ReorderLevel = reorderLevel;
        Category = category;
        Unit = unit;
        UnitCost = unitCost;
        QuantityOnHand = 0;
        IsActive = true;
        ExpiryWarningDays = DefaultExpiryWarningDays;
    }

    /// <summary>Default warning window when none is configured.</summary>
    public const int DefaultExpiryWarningDays = 30;

    public InventoryItem UpdateCatalogInfo(
        string name,
        Guid? taxonomyId,
        string? supplier,
        string? origin,
        string? unit,
        decimal? unitCost,
        decimal? salePrice)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));

        if (unitCost is < 0m || salePrice is < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidPrice,
                "Giá vật tư không được âm.");
        }

        Name = name;
        TaxonomyId = taxonomyId;
        Supplier = supplier;
        Origin = origin;
        Unit = unit;
        UnitCost = unitCost;
        SalePrice = salePrice;
        return this;
    }

    /// <summary>Records a stock receipt with its expiry, as the Nhập kho column shows.</summary>
    public InventoryItem ReceiveStock(
        decimal quantity,
        DateOnly stockedAt,
        DateOnly? expiryDate = null,
        int? expiryWarningDays = null)
    {
        AddStock(quantity);
        return SetShelfLife(stockedAt, expiryDate, expiryWarningDays);
    }

    /// <summary>
    /// The dates a material keeps, with no stock arriving alongside them.
    ///
    /// A material can be catalogued before any of it is held — the reference
    /// leaves "Số lượng" optional — so recording when it was stocked and when
    /// it expires must not require a receipt. AddStock still refuses a
    /// quantity of zero; that guard belongs to stock, not to shelf life.
    /// </summary>
    public InventoryItem SetShelfLife(
        DateOnly? stockedAt,
        DateOnly? expiryDate = null,
        int? expiryWarningDays = null)
    {
        var against = stockedAt ?? StockedAt;

        if (expiryDate.HasValue && against.HasValue && expiryDate.Value < against.Value)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidExpiry,
                "Hạn sử dụng phải sau ngày nhập kho.");
        }

        if (stockedAt.HasValue)
        {
            StockedAt = stockedAt.Value;
        }

        ExpiryDate = expiryDate;

        if (expiryWarningDays.HasValue)
        {
            if (expiryWarningDays.Value < 0)
            {
                throw new BusinessException(
                    BlueDentalDomainErrorCodes.Inventory.InvalidExpiry,
                    "Số ngày cảnh báo hết hạn không được âm.");
            }

            ExpiryWarningDays = expiryWarningDays.Value;
        }

        return this;
    }

    public InventoryItem SetReorderLevel(decimal reorderLevel)
    {
        if (reorderLevel < 0m)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidStockMovement,
                "Mức tồn tối thiểu không được âm.");
        }

        ReorderLevel = reorderLevel;
        return this;
    }

    /// <summary>
    /// Trạng thái shown in the table. Expiry outranks stock level: an expired
    /// supply must not read as "còn hàng" just because the shelf is full.
    /// </summary>
    public SupplyStatus StatusAsOf(DateOnly today)
    {
        if (ExpiryDate.HasValue)
        {
            if (ExpiryDate.Value < today)
            {
                return SupplyStatus.Expired;
            }

            if (ExpiryDate.Value.DayNumber - today.DayNumber <= ExpiryWarningDays)
            {
                return SupplyStatus.ExpiringSoon;
            }
        }

        if (QuantityOnHand <= 0m)
        {
            return SupplyStatus.OutOfStock;
        }

        return NeedsReorder ? SupplyStatus.LowStock : SupplyStatus.Available;
    }

    public InventoryItem AddStock(decimal quantity, string? notes = null)
    {
        if (quantity <= 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidStockMovement,
                "Stock increase quantity must be positive.");
        }

        QuantityOnHand += quantity;
        return this;
    }

    public InventoryItem ConsumeStock(decimal quantity)
    {
        if (quantity <= 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidStockMovement,
                "Consumption quantity must be positive.");
        }

        if (quantity > QuantityOnHand)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InsufficientStock,
                $"Insufficient stock: requested {quantity}, available {QuantityOnHand}.");
        }

        QuantityOnHand -= quantity;
        return this;
    }

    public InventoryItem Update(string name, string? category, string? unit, decimal reorderLevel, decimal? unitCost)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name));
        Name = name;
        Category = category;
        Unit = unit;
        ReorderLevel = reorderLevel;
        UnitCost = unitCost;
        return this;
    }

    public bool NeedsReorder => QuantityOnHand <= ReorderLevel;

    public InventoryItem Deactivate() { IsActive = false; return this; }
    public InventoryItem Activate() { IsActive = true; return this; }
}
