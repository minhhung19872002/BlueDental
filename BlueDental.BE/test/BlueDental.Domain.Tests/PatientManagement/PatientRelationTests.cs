using System;
using System.Linq;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.PatientManagement;

/// <summary>
/// Mối quan hệ (4.8) and Hồ sơ nhóm (4.10): a relation is written once and
/// read from both records; a group has members, one head at most.
/// </summary>
public class PatientRelationTests
{
    private static readonly Guid Branch = Guid.NewGuid();
    private static readonly Guid Child = Guid.NewGuid();
    private static readonly Guid Father = Guid.NewGuid();
    private static readonly Guid Mother = Guid.NewGuid();

    private static void ShouldFail(Action action, string code) =>
        Should.Throw<BusinessException>(action).Code.ShouldBe(code);

    [Fact]
    public void A_Relation_Reads_Its_Inverse_From_The_Other_Record()
    {
        var r = new PatientRelationship(Guid.NewGuid(), Branch, Child, Father, PatientRelationType.Parent, " Bố ruột ");

        r.TypeSeenFrom(Child).ShouldBe(PatientRelationType.Parent);
        r.TypeSeenFrom(Father).ShouldBe(PatientRelationType.Child);
        r.OtherOf(Child).ShouldBe(Father);
        r.OtherOf(Father).ShouldBe(Child);
        r.Note.ShouldBe("Bố ruột");
    }

    [Fact]
    public void Either_Side_May_Rewrite_The_Relation()
    {
        var r = new PatientRelationship(Guid.NewGuid(), Branch, Child, Father, PatientRelationType.Parent, null);

        r.Change(Father, PatientRelationType.Grandchild, null);

        r.TypeSeenFrom(Father).ShouldBe(PatientRelationType.Grandchild);
        r.TypeSeenFrom(Child).ShouldBe(PatientRelationType.Grandparent);
        ShouldFail(() => r.Change(Mother, PatientRelationType.Spouse, null),
            BlueDentalDomainErrorCodes.PatientRelation.InvalidType);
    }

    [Fact]
    public void A_Record_Cannot_Be_Related_To_Itself_Or_By_An_Unknown_Type()
    {
        ShouldFail(() => new PatientRelationship(Guid.NewGuid(), Branch, Child, Child, PatientRelationType.Sibling, null),
            BlueDentalDomainErrorCodes.PatientRelation.SelfRelation);
        ShouldFail(() => new PatientRelationship(Guid.NewGuid(), Branch, Child, Father, (PatientRelationType)99, null),
            BlueDentalDomainErrorCodes.PatientRelation.InvalidType);
    }

    [Theory]
    [InlineData(PatientRelationType.Spouse, true)]
    [InlineData(PatientRelationType.Parent, true)]
    [InlineData(PatientRelationType.Sibling, true)]
    [InlineData(PatientRelationType.Relative, true)]
    [InlineData(PatientRelationType.Friend, false)]
    [InlineData(PatientRelationType.Colleague, false)]
    [InlineData(PatientRelationType.Other, false)]
    public void Family_Is_Blood_And_Marriage_Not_Friends_Or_Colleagues(PatientRelationType type, bool family)
    {
        PatientRelationTypes.IsFamily(type).ShouldBe(family);
        PatientRelationTypes.Inverse(PatientRelationTypes.Inverse(type)).ShouldBe(type);
    }

    [Fact]
    public void A_Group_Keeps_Its_Members_In_Order_With_One_Head()
    {
        var group = new PatientGroup(Guid.NewGuid(), Branch)
            .Update(PatientGroupKind.Family, " Gia đình Nguyễn ", null, "Tiền sử tiểu đường bên nội");
        group.SetMembers([(Father, PatientGroupRole.Head), (Mother, PatientGroupRole.Member), (Child, PatientGroupRole.Member)],
            Guid.NewGuid);

        group.Name.ShouldBe("Gia đình Nguyễn");
        group.Head!.PatientId.ShouldBe(Father);
        group.Members.Select(m => m.SortOrder).ShouldBe(new[] { 1, 2, 3 });
        group.Has(Child).ShouldBeTrue();
    }

    [Fact]
    public void A_Group_Refuses_No_Member_Repeats_Two_Heads_And_Too_Many()
    {
        var group = new PatientGroup(Guid.NewGuid(), Branch).Update(PatientGroupKind.Other, "Lớp 5A", null, null);

        ShouldFail(() => group.SetMembers([], Guid.NewGuid), BlueDentalDomainErrorCodes.PatientRelation.GroupNeedsMember);
        ShouldFail(() => group.SetMembers([(Child, PatientGroupRole.Member), (Child, PatientGroupRole.Member)], Guid.NewGuid),
            BlueDentalDomainErrorCodes.PatientRelation.DuplicateMember);
        ShouldFail(() => group.SetMembers([(Father, PatientGroupRole.Head), (Mother, PatientGroupRole.Head)], Guid.NewGuid),
            BlueDentalDomainErrorCodes.PatientRelation.OneHead);
        ShouldFail(() => group.SetMembers(
                Enumerable.Range(0, PatientRelationConsts.MaxGroupMembers + 1)
                    .Select(_ => (Guid.NewGuid(), PatientGroupRole.Member)).ToList(),
                Guid.NewGuid),
            BlueDentalDomainErrorCodes.PatientRelation.TooManyMembers);
        ShouldFail(() => group.Update((PatientGroupKind)9, "X", null, null),
            BlueDentalDomainErrorCodes.PatientRelation.InvalidType);
    }
}
