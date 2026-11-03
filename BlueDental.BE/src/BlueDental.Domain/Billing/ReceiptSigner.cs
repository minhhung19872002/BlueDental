using System;

namespace BlueDental.Billing;

/// <summary>Ký điện tử: the accountant whose saved signature goes on the PDF, and when it was saved.</summary>
public record ReceiptSigner(Guid UserId, DateTimeOffset SavedAt);
