using System;
using System.Collections.Generic;
using System.Linq;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Inventory;

/// <summary>
/// One issue of materials out of the clinic store to a department.
///
/// A voucher carries <em>several</em> materials, which is how the reference
/// models it: you tick what you need in Vật tư phòng khám, name the department,
/// and the whole selection leaves on one voucher under one code.
/// </summary>
public class MaterialAllocation : FullAuditedAggregateRoot<Guid>
{
    public string AllocationCode { get; private set; } = default!;
    public Guid DepartmentId { get; private set; }
    public Guid BranchId { get; private set; }
    public string? PerformerName { get; private set; }
    public string? Note { get; private set; }
    public DateTime AllocationTime { get; private set; }

    private readonly List<MaterialAllocationItem> _items = [];

    /// <summary>The materials this voucher issued, one line each.</summary>
    public IReadOnlyCollection<MaterialAllocationItem> Items => _items;

    /// <summary>Everything issued on this voucher, across its lines.</summary>
    public decimal TotalQuantity => _items.Sum(item => item.Quantity);

    protected MaterialAllocation() { }

    public MaterialAllocation(
        Guid id,
        string allocationCode,
        Guid departmentId,
        Guid branchId,
        string? performerName = null,
        string? note = null,
        // A voucher is sometimes written up after the fact, so when it happened
        // is not always when it was recorded.
        DateTime? allocationTime = null)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(allocationCode, nameof(allocationCode));

        AllocationCode = allocationCode;
        DepartmentId = departmentId;
        BranchId = branchId;
        PerformerName = performerName;
        Note = note;
        AllocationTime = allocationTime ?? DateTime.UtcNow;
    }

    /// <summary>
    /// Adds a material to the voucher. A line of nothing is not a line, and the
    /// same material twice on one voucher is a mistake rather than two issues —
    /// the reference's dialog gives each material a single quantity box.
    /// </summary>
    public MaterialAllocation AddItem(
        Guid itemId,
        Guid inventoryItemId,
        string name,
        decimal quantity)
    {
        if (quantity <= 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidStockMovement,
                "Số lượng phân bổ phải lớn hơn 0.");
        }

        if (_items.Any(item => item.InventoryItemId == inventoryItemId))
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidStockMovement,
                "Mỗi vật tư chỉ xuất hiện một lần trên cùng một phiếu phân bổ.");
        }

        _items.Add(new MaterialAllocationItem(itemId, Id, inventoryItemId, name, quantity));
        return this;
    }

    public void UpdateNote(string? note) => Note = note;

    /// <summary>
    /// The department reports back how much of one line is still on its shelf.
    /// </summary>
    public MaterialAllocation ConfirmRemaining(Guid inventoryItemId, decimal remaining)
    {
        var line = _items.FirstOrDefault(item => item.InventoryItemId == inventoryItemId)
            ?? throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidStockMovement,
                "Vật tư này không nằm trên phiếu phân bổ.");

        line.Confirm(remaining);
        return this;
    }
}

/// <summary>One material on a voucher: how much went out, how much is confirmed left.</summary>
public class MaterialAllocationItem : Volo.Abp.Domain.Entities.Entity<Guid>
{
    public Guid MaterialAllocationId { get; private set; }
    public Guid InventoryItemId { get; private set; }

    /// <summary>
    /// The name as it was at the time. The reference prints the material's name
    /// on the voucher, and a voucher is a record of what happened — renaming the
    /// material later should not rewrite history.
    /// </summary>
    public string Name { get; private set; } = default!;

    public decimal Quantity { get; private set; }

    /// <summary>
    /// What the department confirmed is still there, or null while no stock-take
    /// has come back — which is why the column reads "—" until then.
    /// </summary>
    public decimal? ConfirmedQuantity { get; private set; }

    protected MaterialAllocationItem() { }

    internal MaterialAllocationItem(
        Guid id,
        Guid materialAllocationId,
        Guid inventoryItemId,
        string name,
        decimal quantity)
        : base(id)
    {
        MaterialAllocationId = materialAllocationId;
        InventoryItemId = inventoryItemId;
        Name = name;
        Quantity = quantity;
    }

    internal void Confirm(decimal remaining)
    {
        if (remaining < 0 || remaining > Quantity)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Inventory.InvalidStockMovement,
                $"Số lượng còn lại phải nằm trong khoảng 0 đến {Quantity}.");
        }

        ConfirmedQuantity = remaining;
    }
}
