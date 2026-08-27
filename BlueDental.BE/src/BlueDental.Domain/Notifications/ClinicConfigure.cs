using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Notifications;

/// <summary>
/// Cấu hình theo module của phòng khám — reference:
/// <c>GET /clinic-configure?module=sms&amp;isEnabled=true</c>. The observed
/// staging branch had none, so only the list contract is known; the fields a
/// configure carries beyond name/module/enabled are
/// UNKNOWN_REFERENCE_BEHAVIOR.
/// </summary>
public class ClinicConfigure : FullAuditedAggregateRoot<Guid>
{
    public const string SmsModule = "sms";

    public Guid BranchId { get; private set; }

    /// <summary>Module the configure belongs to, e.g. "sms".</summary>
    public string Module { get; private set; } = default!;

    public string Name { get; private set; } = default!;
    public bool IsEnabled { get; private set; }

    protected ClinicConfigure() { }

    public ClinicConfigure(Guid id, Guid branchId, string module, string name, bool isEnabled = true)
        : base(id)
    {
        Check.NotNullOrWhiteSpace(module, nameof(module));
        Check.NotNullOrWhiteSpace(name, nameof(name));

        BranchId = branchId;
        Module = module;
        Name = name;
        IsEnabled = isEnabled;
    }

    public ClinicConfigure Enable()
    {
        IsEnabled = true;
        return this;
    }

    public ClinicConfigure Disable()
    {
        IsEnabled = false;
        return this;
    }
}
