using Volo.Abp;
using Volo.Abp.Domain.Values;

namespace BlueDental.Billing.Values;

/// <summary>
/// Value object for monetary amounts with explicit currency code.
/// </summary>
public class Money : ValueObject
{
    public decimal Amount { get; }
    public string Currency { get; }

    protected Money() { Currency = "USD"; }

    public Money(decimal amount, string currency = "USD")
    {
        if (amount < 0)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.NegativeAmount,
                "Monetary amount cannot be negative.");
        }

        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidCurrency,
                $"Currency code must be a 3-letter ISO 4217 code, got '{currency}'.");
        }

        Amount = amount;
        Currency = currency.ToUpperInvariant();
    }

    public static Money Zero(string currency = "USD") => new(0, currency);

    public Money Add(Money other)
    {
        EnsureSameCurrency(other);
        return new Money(Amount + other.Amount, Currency);
    }

    public Money Subtract(Money other)
    {
        EnsureSameCurrency(other);
        return new Money(Amount - other.Amount, Currency);
    }

    public Money Multiply(decimal factor) => new(Amount * factor, Currency);

    public bool IsGreaterThan(Money other)
    {
        EnsureSameCurrency(other);
        return Amount > other.Amount;
    }

    private void EnsureSameCurrency(Money other)
    {
        if (Currency != other.Currency)
        {
            throw new BusinessException(
                BlueDentalDomainErrorCodes.Billing.InvalidCurrency,
                $"Currency mismatch: {Currency} vs {other.Currency}.");
        }
    }

    public override string ToString() => $"{Amount:F2} {Currency}";

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return Amount;
        yield return Currency;
    }
}
