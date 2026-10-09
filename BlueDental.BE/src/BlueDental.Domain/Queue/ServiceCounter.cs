using System;
using System.Text.RegularExpressions;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Queue;

/// <summary>
/// A counter with its own fixed dentist and its own numbered queue (A001,
/// B007, …). Numbers come from a sequence on the counter itself: it restarts
/// at <see cref="StartNumber"/> every clinic day when <see cref="AutoResetDaily"/>
/// is on, otherwise it keeps counting up across days.
/// </summary>
public class ServiceCounter : FullAuditedAggregateRoot<Guid>
{
    public const int MaxNameLength = 50;
    public const int MaxPrefixLength = 2;
    public const int DefaultWaitWarningMinutes = 30;
    public const int DefaultMinutesPerPatient = 12;

    private static readonly Regex PrefixPattern = new("^[A-Z0-9]{1,2}$", RegexOptions.Compiled);

    public Guid ClinicBranchId { get; private set; }
    public string Name { get; private set; } = default!;
    public int SortOrder { get; private set; }
    public bool IsActive { get; private set; }
    public Guid? DentistId { get; private set; }
    public string NumberPrefix { get; private set; } = default!;
    public int StartNumber { get; private set; }
    public bool AutoResetDaily { get; private set; }
    public int WaitWarningMinutes { get; private set; }
    public int MinutesPerPatient { get; private set; }

    /// <summary>The last number handed out; meaningless while <see cref="LastIssuedDate"/> is null.</summary>
    public int LastIssuedNumber { get; private set; }

    /// <summary>The clinic day of the last number; null = the next number restarts the sequence.</summary>
    public DateOnly? LastIssuedDate { get; private set; }

    protected ServiceCounter() { }

    public ServiceCounter(Guid id, Guid clinicBranchId, string name, int sortOrder, CounterSettings settings)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        IsActive = true;
        Update(name, sortOrder, settings);
    }

    public ServiceCounter Update(string name, int sortOrder, CounterSettings settings)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name), maxLength: MaxNameLength);
        var prefix = NormalizePrefix(settings.NumberPrefix);
        if (!PrefixPattern.IsMatch(prefix))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.InvalidPrefix);
        }
        if (settings.StartNumber < 1 || settings.WaitWarningMinutes < 1 || settings.MinutesPerPatient < 1)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.InvalidCounterSettings);
        }

        Name = name.Trim();
        SortOrder = sortOrder;
        NumberPrefix = prefix;
        StartNumber = settings.StartNumber;
        AutoResetDaily = settings.AutoResetDaily;
        WaitWarningMinutes = settings.WaitWarningMinutes;
        MinutesPerPatient = settings.MinutesPerPatient;
        return this;
    }

    /// <summary>
    /// The dentist is fixed to the counter; it can only change once nobody is
    /// waiting at, or being seen by, this counter. Every counter needs one, so
    /// a counter saved before that rule may get its first dentist at any time.
    /// </summary>
    public ServiceCounter AssignDentist(Guid? dentistId, bool hasPatientsInQueue)
    {
        if (dentistId is null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.DentistRequired);
        }
        if (dentistId == DentistId)
        {
            return this;
        }
        if (hasPatientsInQueue && DentistId is not null)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Queue.DentistLocked);
        }

        DentistId = dentistId;
        return this;
    }

    public ServiceCounter Activate()
    {
        IsActive = true;
        return this;
    }

    public ServiceCounter Deactivate()
    {
        IsActive = false;
        return this;
    }

    /// <summary>The number the next ticket would get, skipping any still in the queue.</summary>
    public int PeekNextNumber(DateOnly today, Func<int, bool> isInQueue)
    {
        var restart = LastIssuedDate is null || (AutoResetDaily && LastIssuedDate < today);
        var candidate = restart ? StartNumber : LastIssuedNumber + 1;
        while (isInQueue(candidate))
        {
            candidate++;
        }
        return candidate;
    }

    public int IssueNumber(DateOnly today, Func<int, bool> isInQueue)
    {
        var number = PeekNextNumber(today, isInQueue);
        LastIssuedNumber = number;
        LastIssuedDate = today;
        return number;
    }

    /// <summary>"Đặt lại số thứ tự ngay": the next number starts again from <see cref="StartNumber"/>.</summary>
    public ServiceCounter ResetSequence()
    {
        LastIssuedDate = null;
        return this;
    }

    public string FormatNumber(int number) => $"{NumberPrefix}{number:D3}";

    private static string NormalizePrefix(string? prefix) => (prefix ?? string.Empty).Trim().ToUpperInvariant();
}

public sealed record CounterSettings(
    string NumberPrefix,
    int StartNumber,
    bool AutoResetDaily,
    int WaitWarningMinutes,
    int MinutesPerPatient);
