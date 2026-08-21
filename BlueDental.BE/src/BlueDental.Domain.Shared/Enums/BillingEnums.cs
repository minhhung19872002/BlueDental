namespace BlueDental.Billing;

public enum InvoiceStatus
{
    Draft = 1,
    Issued = 2,
    PartiallyPaid = 3,
    Paid = 4,
    Overdue = 5,
    Voided = 6,
    Refunded = 7
}

public enum PaymentMethod
{
    Cash = 1,
    CreditCard = 2,
    DebitCard = 3,
    BankTransfer = 4,
    Insurance = 5,
    MobilePayment = 6,
    Voucher = 7
}

public enum InsuranceClaimStatus
{
    Pending = 1,
    Submitted = 2,
    UnderReview = 3,
    Approved = 4,
    PartiallyApproved = 5,
    Rejected = 6,
    Appealed = 7,
    Settled = 8
}
