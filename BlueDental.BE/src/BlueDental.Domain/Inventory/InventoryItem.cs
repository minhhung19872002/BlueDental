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

    public bool NeedsReorder => QuantityOnHand <= ReorderLevel;

    public InventoryItem Deactivate() { IsActive = false; return this; }
    public InventoryItem Activate() { IsActive = true; return this; }
}
