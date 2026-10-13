using System;
using System.Text.RegularExpressions;
using Volo.Abp;

namespace BlueDental.EInvoicing;

/// <summary>
/// What the THÔNG TIN XUẤT HÓA ĐƠN form asks. Cân nặng and Chiều cao are on the
/// printed sheet only, written by hand (owner 2026-10-12), so they are not here.
/// <see cref="IsCompany"/> is the form's Loại hóa đơn (BA, R-916): each kind
/// asks its own lines and the other kind's lines are dropped.
/// </summary>
public sealed partial record InvoiceRequestDetails(
    bool IsCompany,
    string? FullName,
    int? BirthYear,
    string? Phone,
    string? NationalId,
    string? PersonalAddress,
    string? CompanyName,
    string? TaxCode,
    string? CompanyAddress,
    string? Email,
    bool? WantsPaperInvoice)
{
    /// <summary>
    /// Trimmed, blanks as null, and checked. Cá nhân needs Họ tên, SĐT and CCCD
    /// (Email optional); Công ty needs the company name, the MÃ SỐ THUẾ and the
    /// Email, and keeps only the customer's name (taken from the patient).
    /// </summary>
    public InvoiceRequestDetails Validated()
    {
        var details = IsCompany
            ? this with
            {
                FullName = Clean(FullName, InvoiceRequest.MaxNameLength),
                BirthYear = null,
                Phone = null,
                NationalId = null,
                PersonalAddress = null,
                CompanyName = Clean(CompanyName, InvoiceRequest.MaxNameLength),
                TaxCode = Clean(TaxCode, InvoiceRequest.MaxTaxCodeLength),
                CompanyAddress = Clean(CompanyAddress, InvoiceRequest.MaxAddressLength),
                Email = Clean(Email, InvoiceRequest.MaxEmailLength)
            }
            : this with
            {
                FullName = Clean(FullName, InvoiceRequest.MaxNameLength),
                Phone = CleanPhone(Phone),
                NationalId = Clean(NationalId, InvoiceRequest.MaxNationalIdLength),
                PersonalAddress = Clean(PersonalAddress, InvoiceRequest.MaxAddressLength),
                CompanyName = null,
                TaxCode = null,
                CompanyAddress = null,
                Email = Clean(Email, InvoiceRequest.MaxEmailLength)
            };

        if (details.FullName == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.FullNameRequired);
        }

        if (IsCompany)
        {
            details.CheckCompany();
        }
        else
        {
            details.CheckPersonal();
        }

        if (details.Email != null && !EmailPattern().IsMatch(details.Email))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidEmail);
        }

        return details;
    }

    private void CheckPersonal()
    {
        if (Phone == null || !PhonePattern().IsMatch(Phone))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidPhone);
        }

        if (NationalId == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.NationalIdRequired);
        }

        if (!NationalIdPattern().IsMatch(NationalId))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidNationalId);
        }

        if (BirthYear is { } year && (year < 1900 || year > DateTime.UtcNow.Year))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidBirthYear);
        }
    }

    private void CheckCompany()
    {
        if (CompanyName == null || TaxCode == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.CompanyTaxCodeRequired);
        }

        if (!TaxCodePattern().IsMatch(TaxCode))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidTaxCode);
        }

        if (Email == null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.InvoiceRequest.InvalidEmail);
        }
    }

    private static string? Clean(string? value, int max)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            return null;
        }

        return trimmed.Length <= max ? trimmed : trimmed[..max];
    }

    /// <summary>Spaces, dots and dashes a customer types between digit groups are dropped.</summary>
    private static string? CleanPhone(string? value) =>
        Clean(value is null ? null : PhoneSeparators().Replace(value, string.Empty), InvoiceRequest.MaxPhoneLength);

    [GeneratedRegex(@"[\s.\-()]")]
    private static partial Regex PhoneSeparators();

    /// <summary>The patient form's rule: 8–15 digits, an optional leading +.</summary>
    [GeneratedRegex(@"^\+?\d{8,15}$")]
    private static partial Regex PhonePattern();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailPattern();

    /// <summary>CCCD has 12 digits; the old CMND 9.</summary>
    [GeneratedRegex(@"^(\d{9}|\d{12})$")]
    private static partial Regex NationalIdPattern();

    /// <summary>MST: 10 digits, or 10 + "-" + 3 for a dependent unit (13 digits also accepted).</summary>
    [GeneratedRegex(@"^\d{10}(-?\d{3})?$")]
    private static partial Regex TaxCodePattern();
}
