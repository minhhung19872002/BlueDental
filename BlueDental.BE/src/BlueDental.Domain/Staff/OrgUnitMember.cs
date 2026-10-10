using System;
using Volo.Abp.Domain.Entities;

namespace BlueDental.Staff;

/// <summary>
/// Đơn vị chính of one staff member: each person sits in at most one unit
/// (a unique index on <see cref="StaffId"/>). A unit's head is always one of
/// its members. Removing someone from a unit deletes the row, which puts them
/// back under "Chưa thuộc đơn vị nào".
/// </summary>
public class OrgUnitMember : Entity<Guid>
{
    public Guid OrgUnitId { get; private set; }

    public Guid StaffId { get; private set; }

    protected OrgUnitMember() { }

    public OrgUnitMember(Guid id, Guid orgUnitId, Guid staffId)
        : base(id)
    {
        OrgUnitId = orgUnitId;
        StaffId = staffId;
    }

    public void MoveTo(Guid orgUnitId) => OrgUnitId = orgUnitId;
}
