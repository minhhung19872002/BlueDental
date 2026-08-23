namespace BlueDental.Inventory;

public enum StockMovementType
{
    Purchase = 1,
    Consumption = 2,
    Adjustment = 3,
    Return = 4,
    Transfer = 5,
    Expired = 6,
    Damaged = 7
}

/// <summary>
/// The "Trạng thái" column of the Vật tư table, derived from stock level and
/// expiry rather than stored — a supply is out of stock, running low, expiring
/// soon, expired, or fine.
/// </summary>
public enum SupplyStatus
{
    Available = 1,
    LowStock = 2,
    OutOfStock = 3,
    ExpiringSoon = 4,
    Expired = 5
}

public enum EquipmentStatus
{
    Operational = 1,
    UnderMaintenance = 2,
    OutOfService = 3,
    Decommissioned = 4
}
