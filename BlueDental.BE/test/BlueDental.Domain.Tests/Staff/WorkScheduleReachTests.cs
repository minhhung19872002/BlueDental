using System;
using System.Collections.Generic;
using BlueDental.Staff;
using Xunit;

namespace BlueDental.Domain.Tests.Staff;

/// <summary>Who sees and who manages whom on the Lịch làm việc board (BA P0911, F-90).</summary>
public class WorkScheduleReachTests
{
    private static readonly Guid DepartmentId = Guid.NewGuid();
    private static readonly Guid TeamId = Guid.NewGuid();
    private static readonly Guid OtherDepartmentId = Guid.NewGuid();

    private static readonly Guid Director = Guid.NewGuid();
    private static readonly Guid RootMember = Guid.NewGuid();
    private static readonly Guid DepartmentHead = Guid.NewGuid();
    private static readonly Guid Receptionist = Guid.NewGuid();
    private static readonly Guid Cashier = Guid.NewGuid();
    private static readonly Guid TeamHead = Guid.NewGuid();
    private static readonly Guid TeamDentist = Guid.NewGuid();
    private static readonly Guid OtherHead = Guid.NewGuid();
    private static readonly Guid OtherMember = Guid.NewGuid();
    private static readonly Guid Unassigned = Guid.NewGuid();

    private static readonly List<OrgScopeUnit> Units =
    [
        new(OrgUnit.RootId, null, OrgUnitKind.Root, Director),
        new(DepartmentId, OrgUnit.RootId, OrgUnitKind.Department, DepartmentHead),
        new(TeamId, DepartmentId, OrgUnitKind.DoctorTeam, TeamHead),
        new(OtherDepartmentId, OrgUnit.RootId, OrgUnitKind.Department, OtherHead),
    ];

    private static readonly List<(Guid, Guid)> Members =
    [
        (OrgUnit.RootId, Director),
        (OrgUnit.RootId, RootMember),
        (DepartmentId, DepartmentHead),
        (DepartmentId, Receptionist),
        (DepartmentId, Cashier),
        (TeamId, TeamHead),
        (TeamId, TeamDentist),
        (OtherDepartmentId, OtherHead),
        (OtherDepartmentId, OtherMember),
    ];

    private static WorkScheduleReach For(Guid viewer, bool isAdmin = false) =>
        OrgChartScope.WorkScheduleReachOf(viewer, isAdmin, Units, Members);

    [Fact]
    public void An_Admin_And_The_Director_Reach_Everyone()
    {
        Assert.Same(WorkScheduleReach.Everyone, For(Unassigned, isAdmin: true));
        Assert.Same(WorkScheduleReach.Everyone, For(Director));
    }

    [Fact]
    public void A_Department_Head_Sees_And_Manages_The_Department_And_Its_Teams()
    {
        var reach = For(DepartmentHead);

        var below = new HashSet<Guid> { Receptionist, Cashier, TeamHead, TeamDentist };
        Assert.Equal(below, reach.Managed);
        Assert.Equal(new HashSet<Guid>(below) { DepartmentHead }, reach.Visible);
        Assert.False(reach.Sees(OtherMember));
    }

    [Fact]
    public void A_Department_Member_Sees_Their_Department_But_Manages_No_One()
    {
        var reach = For(Receptionist);

        Assert.Equal(new HashSet<Guid> { DepartmentHead, Receptionist, Cashier }, reach.Visible);
        Assert.Empty(reach.Managed!);
        Assert.False(reach.Sees(TeamDentist));
    }

    [Fact]
    public void A_Team_Head_Manages_Their_Team_Only()
    {
        var reach = For(TeamHead);

        Assert.Equal(new HashSet<Guid> { TeamDentist }, reach.Managed);
        Assert.Equal(new HashSet<Guid> { TeamHead, TeamDentist }, reach.Visible);
    }

    [Theory]
    [MemberData(nameof(SelfOnlyViewers))]
    public void A_Team_Member_A_Root_Member_Or_Someone_In_No_Unit_Sees_Only_Themselves(Guid viewer)
    {
        var reach = For(viewer);

        Assert.Equal(new HashSet<Guid> { viewer }, reach.Visible);
        Assert.Empty(reach.Managed!);
    }

    public static TheoryData<Guid> SelfOnlyViewers => new() { TeamDentist, RootMember, Unassigned };

    [Fact]
    public void Someone_In_No_Unit_Shows_Only_To_Themselves_The_Director_And_An_Admin()
    {
        Assert.False(For(DepartmentHead).Sees(Unassigned));
        Assert.False(For(Receptionist).Sees(Unassigned));
        Assert.True(For(Director).Sees(Unassigned));
        Assert.True(For(Unassigned).Sees(Unassigned));
    }
}
