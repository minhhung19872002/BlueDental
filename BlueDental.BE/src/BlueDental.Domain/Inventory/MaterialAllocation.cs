using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Inventory;

public class MaterialAllocation : FullAuditedAggregateRoot<Guid>
{
    public string AllocationCode { get; private set; } = default!;
    public Guid InventoryItemId { get; private set; }
    public Guid DepartmentId { get; private set; }
    public Guid BranchId { get; private set; }
    public decimal AllocatedQuantity { get; private set; }
    public decimal ConfirmedRemaining { get; private set; }
    public string? PerformerName { get; private set; }
    public string? Note { get; private set; }
    public DateTime AllocationTime { get; private set; }

    protected MaterialAllocation() { }

    public MaterialAllocation(
        Guid id,
        string allocationCode,
        Guid inventoryItemId,
        Guid departmentId,
        Guid branchId,
        decimal allocatedQuantity,
        string? performerName = null,
        string? note = null)
        : base(id)
    {
        AllocationCode = allocationCode;
        InventoryItemId = inventoryItemId;
        DepartmentId = departmentId;
        BranchId = branchId;
        AllocatedQuantity = allocatedQuantity;
        ConfirmedRemaining = allocatedQuantity;
        PerformerName = performerName;
        Note = note;
        AllocationTime = DateTime.UtcNow;
    }

    public void UpdateNote(string? note) => Note = note;

    public void ConfirmUsage(decimal usedQuantity)
    {
        ConfirmedRemaining = Math.Max(0, ConfirmedRemaining - usedQuantity);
    }
}
