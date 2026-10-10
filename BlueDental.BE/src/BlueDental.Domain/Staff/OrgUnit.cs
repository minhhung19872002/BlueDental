using System;
using Volo.Abp;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Staff;

/// <summary>
/// One box of Nhân sự → Sơ đồ tổ chức (F-67, BlueDental-local). The chart is
/// clinic-wide, not per branch: one <see cref="OrgUnitKind.Root"/> headed by the
/// Tổng giám đốc, Phòng ban right under it, Team bác sĩ under a Phòng ban or
/// under the root. Who sits in a unit lives in <see cref="OrgUnitMember"/>.
/// </summary>
public class OrgUnit : FullAuditedAggregateRoot<Guid>
{
    public const int MaxNameLength = OrgUnitConsts.MaxNameLength;
    public const int MaxCodeLength = OrgUnitConsts.MaxCodeLength;

    /// <summary>The root row, inserted by the migration that creates the table.</summary>
    public static readonly Guid RootId = new("0f9a0000-0000-4000-8000-000000000001");

    public string Code { get; private set; } = default!;

    public string Name { get; private set; } = default!;

    public OrgUnitKind Kind { get; private set; }

    public Guid? ParentId { get; private set; }

    /// <summary>Trưởng đơn vị. Required below the root; the root may wait for its Tổng giám đốc.</summary>
    public Guid? HeadStaffId { get; private set; }

    public bool IsRoot => Kind == OrgUnitKind.Root;

    protected OrgUnit() { }

    public static OrgUnit CreateRoot(Guid id, string code, string name, Guid? headStaffId)
    {
        var root = new OrgUnit { Id = id, Kind = OrgUnitKind.Root };
        root.SetNameAndCode(name, code);
        root.HeadStaffId = headStaffId;
        return root;
    }

    public static OrgUnit Create(
        Guid id,
        OrgUnitKind kind,
        string code,
        string name,
        OrgUnit parent,
        Guid headStaffId)
    {
        if (kind == OrgUnitKind.Root)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.RootLocked);
        }

        var unit = new OrgUnit { Id = id, Kind = kind };
        unit.Update(code, name, parent, headStaffId);
        return unit;
    }

    /// <summary>
    /// Sửa đơn vị. The kind stays what it was created as: turning a Phòng ban
    /// with teams into a team would leave those teams under a team.
    /// </summary>
    public OrgUnit Update(string code, string name, OrgUnit parent, Guid headStaffId)
    {
        EnsureNotRoot();
        Check.NotNull(parent, nameof(parent));
        EnsureParentFits(Kind, parent);
        if (parent.Id == Id)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.InvalidParent);
        }

        if (headStaffId == Guid.Empty)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.HeadRequired);
        }

        SetNameAndCode(name, code);
        ParentId = parent.Id;
        HeadStaffId = headStaffId;
        return this;
    }

    /// <summary>The root's one change: who the Tổng giám đốc is.</summary>
    public OrgUnit ChangeRootHead(Guid? headStaffId)
    {
        if (!IsRoot)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.InvalidParent);
        }

        HeadStaffId = headStaffId == Guid.Empty ? null : headStaffId;
        return this;
    }

    public void EnsureNotRoot()
    {
        if (IsRoot)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.RootLocked);
        }
    }

    /// <summary>Phòng ban → under the root only; Team bác sĩ → under the root or a Phòng ban.</summary>
    public static bool ParentFits(OrgUnitKind kind, OrgUnitKind parentKind) => kind switch
    {
        OrgUnitKind.Department => parentKind == OrgUnitKind.Root,
        OrgUnitKind.DoctorTeam => parentKind is OrgUnitKind.Root or OrgUnitKind.Department,
        _ => false,
    };

    private static void EnsureParentFits(OrgUnitKind kind, OrgUnit parent)
    {
        if (!ParentFits(kind, parent.Kind))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.OrgChart.InvalidParent);
        }
    }

    private void SetNameAndCode(string name, string code)
    {
        Check.NotNullOrWhiteSpace(name, nameof(name), MaxNameLength);
        Check.NotNullOrWhiteSpace(code, nameof(code), MaxCodeLength);
        Name = string.Join(' ', name.Split(' ', StringSplitOptions.RemoveEmptyEntries));
        Code = code.Trim();
    }
}
