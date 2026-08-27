using System.Linq;
using BlueDental.Permissions;
using Xunit;

namespace BlueDental.Domain.Tests.Permissions;

/// <summary>
/// Locks the ability catalog to what was observed on the reference application
/// (docs/clone/permissions.md, role clinicAdmin).
/// </summary>
public class BlueDentalAbilitiesTests
{
    [Fact]
    public void Catalog_Should_Cover_Every_Observed_Subject()
    {
        // 83 subjects observed on the reference + branchManager and
        // chatbotKnowledge, which BlueDental adds.
        Assert.Equal(85, BlueDentalAbilities.Catalog.Count);
        Assert.True(BlueDentalAbilities.Catalog.ContainsKey(BlueDentalAbilities.Subjects.BranchManager));
    }

    [Fact]
    public void Every_Subject_Should_Support_Read()
    {
        var withoutRead = BlueDentalAbilities.Catalog
            .Where(pair => !pair.Value.Contains(BlueDentalAbilities.Actions.Read))
            .Select(pair => pair.Key)
            .ToList();

        Assert.Empty(withoutRead);
    }

    [Fact]
    public void Permission_Names_Should_Follow_The_Convention()
    {
        Assert.Equal(
            "BlueDental.patient.export",
            BlueDentalAbilities.Permission(
                BlueDentalAbilities.Subjects.Patient,
                BlueDentalAbilities.Actions.Export));

        Assert.Equal("BlueDental.patient", BlueDentalAbilities.SubjectPermission("patient"));
    }

    [Theory]
    // Actions unique to a single subject in the reference matrix.
    [InlineData("payment", "finalize")]
    [InlineData("patient", "hidePhone")]
    [InlineData("workSchedule", "attendanceOthers")]
    [InlineData("chatbot", "manage")]
    [InlineData("treatmentStage", "continue")]
    [InlineData("treatmentStage", "complete")]
    [InlineData("reportTransfer", "deposit")]
    [InlineData("reportTransfer", "withdraw")]
    [InlineData("reportTransfer", "transfer")]
    [InlineData("reportCost", "approve")]
    [InlineData("materials", "approve")]
    [InlineData("treatmentConsultation", "print")]
    public void Should_Support_The_Observed_Special_Actions(string subject, string action)
    {
        Assert.True(BlueDentalAbilities.Supports(subject, action));
    }

    [Theory]
    // Read-only sections: report/access style subjects never allow writes.
    [InlineData("reportResult")]
    [InlineData("reportSales")]
    [InlineData("operationsOverviewReport")]
    [InlineData("operationsTreatmentAccess")]
    [InlineData("operationsFinanceInvoice")]
    [InlineData("helpSupport")]
    public void Read_Only_Subjects_Should_Not_Allow_Writes(string subject)
    {
        var actions = BlueDentalAbilities.Catalog[subject];

        Assert.DoesNotContain(BlueDentalAbilities.Actions.Create, actions);
        Assert.DoesNotContain(BlueDentalAbilities.Actions.Update, actions);
        Assert.DoesNotContain(BlueDentalAbilities.Actions.Delete, actions);
    }

    [Fact]
    public void Should_Not_Invent_Abilities_That_Were_Not_Observed()
    {
        Assert.False(BlueDentalAbilities.Supports("patient", BlueDentalAbilities.Actions.Delete));
        Assert.False(BlueDentalAbilities.Supports("account", BlueDentalAbilities.Actions.Create));
        Assert.False(BlueDentalAbilities.Supports("cskhCare", BlueDentalAbilities.Actions.Delete));
    }

    [Fact]
    public void All_Should_Flatten_Every_Pair()
    {
        var expected = BlueDentalAbilities.Catalog.Sum(pair => pair.Value.Count);

        Assert.Equal(expected, BlueDentalAbilities.All().Count());
    }

    [Fact]
    public void Subject_Constants_Should_Match_Catalog_Keys()
    {
        var constants = typeof(BlueDentalAbilities.Subjects)
            .GetFields()
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!)
            .ToList();

        Assert.Equal(BlueDentalAbilities.Catalog.Count, constants.Count);
        Assert.All(constants, subject => Assert.True(BlueDentalAbilities.Catalog.ContainsKey(subject)));
    }
}
