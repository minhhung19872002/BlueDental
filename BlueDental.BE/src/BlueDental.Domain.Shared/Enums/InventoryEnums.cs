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

public enum EquipmentStatus
{
    Operational = 1,
    UnderMaintenance = 2,
    OutOfService = 3,
    Decommissioned = 4
}
