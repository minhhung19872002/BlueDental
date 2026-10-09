namespace BlueDental.PrepaidCards;

public static class PrepaidCardConsts
{
    public const int MaxNameLength = 200;
    public const int MaxNoteLength = 500;
    public const int MaxCodeLength = 20;

    /// <summary>Family members who may spend a card besides its owner.</summary>
    public const int MaxMembers = 10;

    /// <summary>Longest "Thời hạn sử dụng" a type may set, in months.</summary>
    public const int MaxValidityMonths = 120;

    /// <summary>Card numbers read <c>TT26-0001</c>: prefix, two-digit year, branch sequence.</summary>
    public const string CodePrefix = "TT";
}
