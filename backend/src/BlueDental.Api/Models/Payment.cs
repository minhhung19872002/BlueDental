namespace BlueDental.Api.Models;

public enum PaymentMethod
{
    Cash,
    BankTransfer,
    Card,
    EWallet
}

public sealed class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PatientId { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; } = PaymentMethod.Cash;
    public DateTime PaidAtUtc { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
    public Patient? Patient { get; set; }
}
