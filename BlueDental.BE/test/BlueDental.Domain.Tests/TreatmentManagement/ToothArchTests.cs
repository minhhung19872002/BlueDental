using System.Linq;
using BlueDental.TreatmentManagement.Values;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

public class ToothArchTests
{
    private static readonly int[] Upper = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
    private static readonly int[] Lower = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

    private static ToothSelection[] Whole(params int[] codes) =>
        codes.Select(code => new ToothSelection(code, selected: true)).ToArray();

    [Fact]
    public void Every_Upper_Tooth_Is_The_Upper_Jaw()
    {
        Assert.Equal(WholeJaw.Upper, ToothArch.WholeJawOf(Whole(Upper)));
    }

    [Fact]
    public void Every_Lower_Tooth_Is_The_Lower_Jaw()
    {
        Assert.Equal(WholeJaw.Lower, ToothArch.WholeJawOf(Whole(Lower)));
    }

    [Fact]
    public void Both_Jaws_In_Any_Order_Are_The_Full_Jaw()
    {
        Assert.Equal(WholeJaw.Full, ToothArch.WholeJawOf(Whole([.. Lower, .. Upper])));
    }

    [Fact]
    public void Teeth_Picked_One_By_One_Are_No_Jaw()
    {
        Assert.Null(ToothArch.WholeJawOf(Whole(16, 26)));
        Assert.Null(ToothArch.WholeJawOf(Whole(Upper.Skip(1).ToArray())));
        Assert.Null(ToothArch.WholeJawOf(Whole([.. Upper, 31])));
        Assert.Null(ToothArch.WholeJawOf([]));
    }

    [Fact]
    public void A_Jaw_With_A_Surface_Picked_Is_Listed_Tooth_By_Tooth()
    {
        var teeth = Whole(Upper.Skip(1).ToArray()).Append(new ToothSelection(18, top: true)).ToArray();
        Assert.Null(ToothArch.WholeJawOf(teeth));
    }
}
