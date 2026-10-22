namespace BlueDental.Tools;

// Shared with the API contracts, so the template DTOs carry them typed.

public enum MessageChannelType
{
    Sms = 0,
    Zalo = 1,
    Email = 2,
}

public enum MessageTemplateStatus : short
{
    /// <summary>"Nháp" — saved with Lưu nháp; never sent.</summary>
    Draft = 0,

    /// <summary>"Sẵn sàng" — can be picked in Gửi tin nhắn.</summary>
    Ready = 1,

    /// <summary>"Chờ duyệt" — Zalo is still reviewing the ZNS template.</summary>
    PendingApproval = 2,

    /// <summary>"Bị từ chối" — Zalo refused the ZNS template.</summary>
    Rejected = 3,

    /// <summary>"Ngưng dùng" — Zalo disabled or deleted the ZNS template.</summary>
    Disabled = 4,
}

public enum MessageVariableGroup
{
    Customer = 1,
    Appointment = 2,
    Treatment = 3,
    System = 4,
}

/// <summary>What a send does for a customer the variable has no value for.</summary>
public enum MessageVariableWhenEmpty
{
    /// <summary>"trống: Quý khách" — put the variable's fallback in its place.</summary>
    UseFallback = 1,

    /// <summary>"trống: bỏ qua khách" — leave the customer out of the send.</summary>
    SkipCustomer = 2,

    /// <summary>"trống: luôn có" — every customer has one; a blank still skips rather than sending a hole.</summary>
    AlwaysPresent = 3,
}
