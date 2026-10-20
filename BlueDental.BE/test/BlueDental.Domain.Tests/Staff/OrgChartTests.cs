using System;
using System.Collections.Generic;
using BlueDental.Staff;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.Staff;

/// <summary>Sơ đồ tổ chức (F-67): unit guards and the schedule scope rule.</summary>
public class OrgChartTests
{
    private static readonly OrgUnit Root = OrgUnit.CreateRoot(OrgUnit.RootId, "BD", "BlueDental", null);

    private static OrgUnit Department(Guid? head = null) =>
        OrgUnit.Create(Guid.NewGuid(), OrgUnitKind.Department, "PB-001", "Phòng Khám", Root, head ?? Guid.NewGuid());

    private static OrgUnit Team(OrgUnit parent) =>
        OrgUnit.Create(Guid.NewGuid(), OrgUnitKind.DoctorTeam, "TBS-001", "Team Implant", parent, Guid.NewGuid());

    private static string CodeOf(Action act) => Assert.Throws<BusinessException>(act).Code!;

    [Theory]
    [InlineData(OrgUnitKind.Department, OrgUnitKind.Root, true)]
    [InlineData(OrgUnitKind.Department, OrgUnitKind.Department, false)]
    [InlineData(OrgUnitKind.Department, OrgUnitKind.DoctorTeam, false)]
    [InlineData(OrgUnitKind.DoctorTeam, OrgUnitKind.Root, true)]
    [InlineData(OrgUnitKind.DoctorTeam, OrgUnitKind.Department, true)]
    [InlineData(OrgUnitKind.DoctorTeam, OrgUnitKind.DoctorTeam, false)]
    public void Parent_Must_Fit_The_Kind(OrgUnitKind kind, OrgUnitKind parentKind, bool expected)
    {
        Assert.Equal(expected, OrgUnit.ParentFits(kind, parentKind));
    }

    [Fact]
    public void A_Department_Cannot_Sit_Under_Another_Department()
    {
        Assert.Equal(BlueDentalDomainErrorCodes.OrgChart.InvalidParent, CodeOf(() =>
            OrgUnit.Create(Guid.NewGuid(), OrgUnitKind.Department, "PB-002", "Phòng 2", Department(), Guid.NewGuid())));
    }

    [Fact]
    public void A_Team_Cannot_Sit_Under_Another_Team()
    {
        Assert.Equal(BlueDentalDomainErrorCodes.OrgChart.InvalidParent, CodeOf(() => Team(Team(Root))));
    }

    [Fact]
    public void A_Unit_Needs_A_Head()
    {
        Assert.Equal(BlueDentalDomainErrorCodes.OrgChart.HeadRequired, CodeOf(() =>
            OrgUnit.Create(Guid.NewGuid(), OrgUnitKind.DoctorTeam, "TBS-001", "Team", Root, Guid.Empty)));
    }

    [Fact]
    public void Root_Cannot_Be_Created_Or_Edited_As_A_Unit()
    {
        Assert.Equal(BlueDentalDomainErrorCodes.OrgChart.RootLocked, CodeOf(() =>
            OrgUnit.Create(Guid.NewGuid(), OrgUnitKind.Root, "X", "X", Root, Guid.NewGuid())));

        var root = OrgUnit.CreateRoot(OrgUnit.RootId, "BD", "BlueDental", null);
        Assert.Equal(BlueDentalDomainErrorCodes.OrgChart.RootLocked, CodeOf(() =>
            root.Update("BD", "Other", Root, Guid.NewGuid())));
        Assert.Equal(BlueDentalDomainErrorCodes.OrgChart.RootLocked, CodeOf(root.EnsureNotRoot));
    }

    [Fact]
    public void Root_Head_Can_Change_And_Be_Cleared()
    {
        var root = OrgUnit.CreateRoot(OrgUnit.RootId, "BD", "BlueDental", null);
        var director = Guid.NewGuid();

        Assert.Equal(director, root.ChangeRootHead(director).HeadStaffId);
        Assert.Null(root.ChangeRootHead(Guid.Empty).HeadStaffId);
    }

    [Fact]
    public void Only_The_Root_Changes_Head_Through_ChangeRootHead()
    {
        Assert.Equal(BlueDentalDomainErrorCodes.OrgChart.InvalidParent, CodeOf(() => Department().ChangeRootHead(Guid.NewGuid())));
    }

    [Fact]
    public void Name_Collapses_Spaces_And_Code_Keeps_Its_Case()
    {
        var unit = OrgUnit.Create(Guid.NewGuid(), OrgUnitKind.DoctorTeam, "  tbs-Abc ", "  Team   Răng  Sứ ", Root, Guid.NewGuid());

        Assert.Equal("Team Răng Sứ", unit.Name);
        Assert.Equal("tbs-Abc", unit.Code);
    }

    [Fact]
    public void A_Unit_Cannot_Be_Its_Own_Parent()
    {
        var department = Department();

        // A Phòng ban only fits under the root, so try the self-parent with a team.
        var team = Team(department);
        Assert.Equal(BlueDentalDomainErrorCodes.OrgChart.InvalidParent, CodeOf(() =>
            team.Update("TBS-001", "Team", team, Guid.NewGuid())));
    }

    // ---- Scope -------------------------------------------------------------

    private sealed class Chart
    {
        public readonly Guid Director = Guid.NewGuid();
        public readonly Guid RootDentist = Guid.NewGuid();
        public readonly Guid DepartmentHead = Guid.NewGuid();
        public readonly Guid TeamHead = Guid.NewGuid();
        public readonly Guid TeamDentist = Guid.NewGuid();
        public readonly Guid OtherTeamHead = Guid.NewGuid();
        public readonly Guid OtherTeamDentist = Guid.NewGuid();
        public readonly Guid Unassigned = Guid.NewGuid();

        public readonly Guid DepartmentId = Guid.NewGuid();
        public readonly Guid TeamId = Guid.NewGuid();
        public readonly Guid OtherTeamId = Guid.NewGuid();

        public List<OrgScopeUnit> Units =>
        [
            new(OrgUnit.RootId, null, OrgUnitKind.Root, Director),
            new(DepartmentId, OrgUnit.RootId, OrgUnitKind.Department, DepartmentHead),
            new(TeamId, DepartmentId, OrgUnitKind.DoctorTeam, TeamHead),
            new(OtherTeamId, OrgUnit.RootId, OrgUnitKind.DoctorTeam, OtherTeamHead),
        ];

        public List<(Guid, Guid)> Members =>
        [
            (OrgUnit.RootId, Director),
            (OrgUnit.RootId, RootDentist),
            (DepartmentId, DepartmentHead),
            (TeamId, TeamHead),
            (TeamId, TeamDentist),
            (OtherTeamId, OtherTeamHead),
            (OtherTeamId, OtherTeamDentist),
        ];

        public IReadOnlySet<Guid>? For(Guid viewer, bool isDentist = true) =>
            OrgChartScope.VisibleStaff(viewer, isDentist, Units, Members);
    }

    [Fact]
    public void Non_Dentists_Are_Not_Narrowed()
    {
        var chart = new Chart();

        Assert.Null(chart.For(chart.TeamDentist, isDentist: false));
        Assert.Null(chart.For(chart.Unassigned, isDentist: false));
        // Any staff member may head a team (BA, 2026-10-10); a non-dentist head keeps their permissions.
        Assert.Null(chart.For(chart.TeamHead, isDentist: false));
    }

    [Fact]
    public void The_General_Director_Sees_Everyone()
    {
        var chart = new Chart();

        Assert.Null(chart.For(chart.Director));
    }

    [Fact]
    public void A_Team_Head_Sees_Their_Team_Only()
    {
        var chart = new Chart();

        Assert.Equal(new HashSet<Guid> { chart.TeamHead, chart.TeamDentist }, chart.For(chart.TeamHead));
    }

    [Fact]
    public void A_Department_Head_Sees_Every_Team_Under_It()
    {
        var chart = new Chart();

        Assert.Equal(
            new HashSet<Guid> { chart.DepartmentHead, chart.TeamHead, chart.TeamDentist },
            chart.For(chart.DepartmentHead));
    }

    [Fact]
    public void A_Team_Dentist_Or_An_Unassigned_Dentist_Sees_Only_Themselves()
    {
        var chart = new Chart();

        Assert.Equal(new HashSet<Guid> { chart.TeamDentist }, chart.For(chart.TeamDentist));
        Assert.Equal(new HashSet<Guid> { chart.Unassigned }, chart.For(chart.Unassigned));
    }

    [Fact]
    public void A_Dentist_In_The_Directors_Own_Team_Sees_Only_Themselves()
    {
        // BA 2026-10-13: the Tổng giám đốc may run a team of their own; its member
        // dentists see neither the other dentists nor the branches below.
        var chart = new Chart();

        Assert.Equal(new HashSet<Guid> { chart.RootDentist }, chart.For(chart.RootDentist));
        Assert.Null(chart.For(chart.RootDentist, isDentist: false));
    }

    // ---- "Bác sĩ tư vấn" on "Thêm dịch vụ" (R-954) ---------------------------

    private static IReadOnlySet<Guid>? AdvisorsFor(Chart chart, Guid viewer, bool isDentist = true) =>
        OrgChartScope.VisibleAdvisors(viewer, isDentist, chart.Units, chart.Members);

    [Fact]
    public void Advisors_Non_Dentists_And_The_Director_See_Every_Dentist()
    {
        var chart = new Chart();

        Assert.Null(AdvisorsFor(chart, chart.TeamDentist, isDentist: false));
        Assert.Null(AdvisorsFor(chart, chart.TeamHead, isDentist: false));
        Assert.Null(AdvisorsFor(chart, chart.Director));
    }

    [Fact]
    public void Advisors_A_Head_Sees_Their_Whole_Subtree()
    {
        var chart = new Chart();

        Assert.Equal(new HashSet<Guid> { chart.TeamHead, chart.TeamDentist }, AdvisorsFor(chart, chart.TeamHead));
        Assert.Equal(
            new HashSet<Guid> { chart.DepartmentHead, chart.TeamHead, chart.TeamDentist },
            AdvisorsFor(chart, chart.DepartmentHead));
    }

    [Fact]
    public void Advisors_A_Member_Sees_Their_Own_Unit_But_Not_The_Units_Below()
    {
        var chart = new Chart();

        Assert.Equal(new HashSet<Guid> { chart.TeamHead, chart.TeamDentist }, AdvisorsFor(chart, chart.TeamDentist));
        // The root's direct members are one team; the units under the root stay hidden.
        Assert.Equal(new HashSet<Guid> { chart.Director, chart.RootDentist }, AdvisorsFor(chart, chart.RootDentist));
    }

    [Fact]
    public void Advisors_An_Unassigned_Dentist_Sees_Only_Themselves()
    {
        var chart = new Chart();

        Assert.Equal(new HashSet<Guid> { chart.Unassigned }, AdvisorsFor(chart, chart.Unassigned));
    }

    // ---- "Kế hoạch điều trị" slips: R-961 + BA P2010 "Chi phí › Xem" -----

    private static SlipScope? SlipsFor(
        Chart chart, Guid viewer, bool isAdmin = false, bool seesCosts = true, bool isDentist = true) =>
        OrgChartScope.VisibleSlips(viewer, isAdmin, seesCosts, isDentist, chart.Units, chart.Members);

    [Fact]
    public void Slips_An_Admin_Sees_Every_Slip_Without_The_Permission()
    {
        var chart = new Chart();

        Assert.Null(SlipsFor(chart, chart.Unassigned, isAdmin: true, seesCosts: false, isDentist: false));
        Assert.Null(SlipsFor(chart, chart.TeamDentist, isAdmin: true, seesCosts: false));
    }

    [Fact]
    public void Slips_Without_The_Permission_Only_The_Ones_Received_Even_As_A_Head()
    {
        var chart = new Chart();

        foreach (var viewer in new[] { chart.Director, chart.DepartmentHead, chart.TeamHead, chart.TeamDentist })
        {
            var scope = SlipsFor(chart, viewer, seesCosts: false)!;
            Assert.Equal(new HashSet<Guid> { viewer }, scope.Dentists);
            Assert.True(scope.ReceivedOnly);
        }

        Assert.True(SlipsFor(chart, chart.Unassigned, seesCosts: false, isDentist: false)!.ReceivedOnly);
    }

    [Fact]
    public void Slips_With_The_Permission_A_Non_Dentist_Sees_Every_Slip()
    {
        var chart = new Chart();

        Assert.Null(SlipsFor(chart, chart.Unassigned, isDentist: false));
        Assert.Null(SlipsFor(chart, chart.TeamHead, isDentist: false));
    }

    [Fact]
    public void Slips_With_The_Permission_A_Dentist_Follows_The_Chart()
    {
        var chart = new Chart();

        Assert.Null(SlipsFor(chart, chart.Director));
        Assert.Equal(
            new HashSet<Guid> { chart.DepartmentHead, chart.TeamHead, chart.TeamDentist },
            SlipsFor(chart, chart.DepartmentHead)!.Dentists);
        Assert.Equal(new HashSet<Guid> { chart.TeamHead, chart.TeamDentist }, SlipsFor(chart, chart.TeamHead)!.Dentists);
        Assert.Equal(new HashSet<Guid> { chart.TeamDentist }, SlipsFor(chart, chart.TeamDentist)!.Dentists);
        Assert.False(SlipsFor(chart, chart.TeamHead)!.ReceivedOnly);
    }

    [Fact]
    public void Slips_A_Line_Counts_Only_With_The_Permission()
    {
        var chart = new Chart();
        var other = Guid.NewGuid();

        Assert.True(SlipsFor(chart, chart.TeamDentist)!.Covers(other, [null, chart.TeamDentist]));
        Assert.False(SlipsFor(chart, chart.TeamDentist, seesCosts: false)!.Covers(other, [chart.TeamDentist]));
        Assert.True(SlipsFor(chart, chart.TeamDentist, seesCosts: false)!.Covers(chart.TeamDentist, []));
    }
}
