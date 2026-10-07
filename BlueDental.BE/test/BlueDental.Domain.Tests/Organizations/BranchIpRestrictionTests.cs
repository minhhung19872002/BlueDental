using System;
using System.Net;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Organizations;

/// <summary>
/// Cụm 11 mục 11 — Xác thực IP theo chi nhánh: parsing a branch's IP list and
/// deciding whether an account may sign in from an address.
/// </summary>
public class BranchIpRestrictionTests
{
    private static ClinicBranch Branch(string? ips = null) =>
        new ClinicBranch(Guid.NewGuid(), $"CN{Guid.NewGuid():N}"[..8], "Chi nhánh").SetAllowedIpRanges(ips);

    private static IPAddress Ip(string text) => IPAddress.Parse(text);

    [Theory]
    [InlineData("113.161.10.20", "113.161.10.20", true)]
    [InlineData("113.161.10.20", "113.161.10.21", false)]
    [InlineData("113.161.10.0/24", "113.161.10.254", true)]
    [InlineData("113.161.10.0/24", "113.161.11.1", false)]
    [InlineData("10.0.0.0/8", "10.200.3.4", true)]
    [InlineData("0.0.0.0/0", "8.8.8.8", true)]
    [InlineData("2001:db8::/32", "2001:db8:1::5", true)]
    [InlineData("2001:db8::/32", "2001:db9::5", false)]
    [InlineData("113.161.10.20", "::ffff:113.161.10.20", true)]
    [InlineData("113.161.10.20", "2001:db8::1", false)]
    public void A_Range_Contains_The_Addresses_Inside_It(string range, string address, bool expected)
    {
        IpAddressRange.TryParse(range, out var parsed).ShouldBeTrue();
        parsed!.Contains(Ip(address)).ShouldBe(expected);
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("113.161.10")]
    [InlineData("1")]
    [InlineData("113.161.10.0/33")]
    [InlineData("113.161.10.0/-1")]
    [InlineData("113.161.10.0/24/1")]
    [InlineData("113.161.10.300")]
    public void Garbage_Is_Not_A_Range(string text)
    {
        IpAddressRange.TryParse(text, out _).ShouldBeFalse();
    }

    [Fact]
    public void A_Block_With_Host_Bits_Is_Stored_As_Its_Network()
    {
        IpAddressRange.TryParse("192.168.1.77/24", out var parsed).ShouldBeTrue();
        parsed!.ToString().ShouldBe("192.168.1.0/24");
    }

    [Fact]
    public void The_List_Is_Normalized_One_Per_Line_Without_Duplicates()
    {
        var branch = Branch(" 113.161.10.20, 113.161.10.20\r\n192.168.1.77/24 ;2001:db8::/32 ");

        branch.AllowedIpRanges.ShouldBe("113.161.10.20\n192.168.1.0/24\n2001:db8::/32");
        branch.RestrictsLoginByIp.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  \n ")]
    public void An_Empty_List_Means_No_Restriction(string? ips)
    {
        var branch = Branch(ips);

        branch.AllowedIpRanges.ShouldBeNull();
        branch.RestrictsLoginByIp.ShouldBeFalse();
    }

    [Fact]
    public void A_Bad_Entry_Is_Refused_By_Name()
    {
        var ex = Should.Throw<BusinessException>(() => Branch("113.161.10.20\n113.161.10.x"));

        ex.Code.ShouldBe(BlueDentalDomainErrorCodes.Organizations.InvalidIpRange);
        ex.Data["value"].ShouldBe("113.161.10.x");
    }

    [Fact]
    public void Branches_Without_A_List_Restrict_Nobody()
    {
        LoginIpPolicy.IsAllowed(false, [Branch(), Branch()], Ip("8.8.8.8")).ShouldBeTrue();
        LoginIpPolicy.IsAllowed(false, [], Ip("8.8.8.8")).ShouldBeTrue();
    }

    [Fact]
    public void A_Restricted_Account_Signs_In_Only_From_A_Listed_Network()
    {
        var branches = new[] { Branch("113.161.10.0/24") };

        LoginIpPolicy.IsAllowed(false, branches, Ip("113.161.10.9")).ShouldBeTrue();
        LoginIpPolicy.IsAllowed(false, branches, Ip("8.8.8.8")).ShouldBeFalse();
        LoginIpPolicy.IsAllowed(false, branches, null).ShouldBeFalse();
    }

    [Fact]
    public void Any_Of_The_Accounts_Branches_Will_Do()
    {
        var branches = new[] { Branch("113.161.10.20"), Branch("14.225.83.0/24"), Branch() };

        LoginIpPolicy.IsAllowed(false, branches, Ip("14.225.83.93")).ShouldBeTrue();
        LoginIpPolicy.IsAllowed(false, branches, Ip("113.161.10.20")).ShouldBeTrue();
        LoginIpPolicy.IsAllowed(false, branches, Ip("1.1.1.1")).ShouldBeFalse();
    }

    [Fact]
    public void An_Exempt_Account_Signs_In_From_Anywhere()
    {
        LoginIpPolicy.IsAllowed(true, [Branch("113.161.10.20")], Ip("8.8.8.8")).ShouldBeTrue();
    }
}
