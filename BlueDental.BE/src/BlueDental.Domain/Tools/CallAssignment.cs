using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

/// <summary>
/// A SIP extension handed to a staff member under one call configuration —
/// the rows of the "Phân Công Gọi" tab under Công cụ → Gọi thoại.
/// </summary>
public class CallAssignment : FullAuditedEntity<Guid>
{
    public Guid ClinicBranchId { get; private set; }

    /// <summary>The SIP extension the PBX rings for this staff member.</summary>
    public string Sip { get; private set; } = string.Empty;

    public Guid CallConfigurationId { get; private set; }
    public Guid StaffId { get; private set; }
    public bool IsActive { get; private set; }

    private CallAssignment() { }

    public CallAssignment(
        Guid id, Guid clinicBranchId, string sip,
        Guid callConfigurationId, Guid staffId, bool isActive)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        Sip = Check.NotNullOrWhiteSpace(sip, nameof(sip), maxLength: 100);
        CallConfigurationId = callConfigurationId;
        StaffId = staffId;
        IsActive = isActive;
    }

    public void Update(string sip, Guid callConfigurationId, Guid staffId, bool isActive)
    {
        Sip = Check.NotNullOrWhiteSpace(sip, nameof(sip), maxLength: 100);
        CallConfigurationId = callConfigurationId;
        StaffId = staffId;
        IsActive = isActive;
    }
}
