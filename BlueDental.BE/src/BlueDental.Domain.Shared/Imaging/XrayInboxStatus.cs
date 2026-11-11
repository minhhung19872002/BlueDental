namespace BlueDental.Imaging;

/// <summary>What became of a picture an X-ray PC sent (F-95).</summary>
public enum XrayInboxStatus
{
    /// <summary>Ảnh chưa gán hồ sơ — waiting for staff.</summary>
    Pending = 1,

    /// <summary>Its code named a record of the device's branch; put there on arrival.</summary>
    AutoAssigned = 2,

    /// <summary>Put on a record by a staff member.</summary>
    Assigned = 3,

    /// <summary>Bỏ qua — set aside by a staff member.</summary>
    Discarded = 4
}
