namespace BlueDental;

public static class BlueDentalConsts
{
    public const string UserClinicBranchIdPropertyName = "ClinicBranchId";

    /// <summary>
    /// IdentityUser extra property: the account may sign in from outside the
    /// IP ranges of its branches (Cụm 11 mục 11, "đăng nhập ngoài công ty").
    /// </summary>
    public const string UserAllowLoginOutsideOfficePropertyName = "AllowLoginOutsideOffice";

    /// <summary>
    /// IdentityUser extra property: the account may use the software outside
    /// its branches' "Giờ được phép sử dụng" (Cụm 11 mục 13).
    /// </summary>
    public const string UserAllowLoginOutsideHoursPropertyName = "AllowLoginOutsideHours";

    /// <summary>IdentityUser extra properties: "Quy định giảm giá" — giảm tối đa % / VNĐ (Cụm 11 mục 12).</summary>
    public const string UserMaxDiscountPercentPropertyName = "MaxDiscountPercent";
    public const string UserMaxDiscountAmountPropertyName = "MaxDiscountAmount";
}
