using System;
using Volo.Abp;

namespace BlueDental.Staff;

/// <summary>
/// The work record of a staff member (Cụm 11 mục 1): chức vụ, chứng chỉ hành
/// nghề and hợp đồng. All optional; what is filled in has to hold together.
/// </summary>
public static class StaffEmployment
{
    public const int MaxPositionLength = 100;
    public const int MaxCertificateNumberLength = 50;
    public const int MaxCertificatePlaceLength = 200;

    /// <summary>
    /// A contract cannot end before it starts, and a practising certificate
    /// cannot be issued in the future.
    /// </summary>
    public static void EnsureValid(
        DateOnly? contractStart, DateOnly? contractEnd, DateOnly? certificateIssuedOn, DateOnly clinicToday)
    {
        if (contractStart.HasValue && contractEnd.HasValue && contractEnd < contractStart)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.ContractEndsBeforeStart);
        }

        if (certificateIssuedOn > clinicToday)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Staff.CertificateIssuedInFuture);
        }
    }

    /// <summary>Trimmed, or null when blank.</summary>
    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
