using BlueDental.TreatmentManagement.Values;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

public class ToothSelectionTests
{
    [Theory]
    [InlineData(11)]
    [InlineData(18)]
    [InlineData(48)]
    [InlineData(55)]
    [InlineData(85)]
    public void Should_Accept_Valid_Fdi_Tooth_Codes(int code)
    {
        var tooth = new ToothSelection(code, selected: true);

        Assert.Equal(code, tooth.ToothCode);
        Assert.True(tooth.Selected);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(9)]
    [InlineData(19)]   // position 9 does not exist
    [InlineData(49)]   // quadrant 4, position 9
    [InlineData(56)]   // deciduous quadrant only goes to position 5
    [InlineData(91)]   // quadrant 9 does not exist
    public void Should_Reject_Invalid_Fdi_Tooth_Codes(int code)
    {
        Assert.Throws<BusinessException>(() => new ToothSelection(code, selected: true));
    }

    [Fact]
    public void Should_Reject_Selection_Without_Tooth_Or_Surface()
    {
        Assert.Throws<BusinessException>(() => new ToothSelection(11));
    }

    [Fact]
    public void Should_Count_Marked_Surfaces()
    {
        var tooth = new ToothSelection(36, top: true, center: true, left: true);

        Assert.Equal(3, tooth.SurfaceCount);
        Assert.False(tooth.Selected);
    }

    [Theory]
    [InlineData(11, false)]
    [InlineData(48, false)]
    [InlineData(51, true)]
    [InlineData(85, true)]
    public void Should_Identify_Deciduous_Teeth(int code, bool expected)
    {
        var tooth = new ToothSelection(code, selected: true);

        Assert.Equal(expected, tooth.IsDeciduous);
    }

    [Fact]
    public void Should_Compare_By_Value()
    {
        var a = new ToothSelection(21, top: true);
        var b = new ToothSelection(21, top: true);
        var c = new ToothSelection(21, bottom: true);

        Assert.Equal(a, b);
        Assert.NotEqual(a, c);
    }
}
