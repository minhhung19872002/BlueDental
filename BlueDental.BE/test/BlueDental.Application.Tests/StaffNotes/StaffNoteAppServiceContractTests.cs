using System.Linq;
using System.Reflection;
using BlueDental.Organizations;
using BlueDental.StaffNotes;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.StaffNotes;

/// <summary>
/// Ghi chú in the header (F-74): open to every signed-in account — no
/// permission leaf of its own — and scoped by branch through the checker, not
/// by trusting the branch header.
/// </summary>
public class StaffNoteAppServiceContractTests
{
    [Fact]
    public void Service_Implements_Its_Interface()
    {
        typeof(IStaffNoteAppService).IsAssignableFrom(typeof(StaffNoteAppService)).ShouldBeTrue();
        typeof(BlueDentalAppService).IsAssignableFrom(typeof(StaffNoteAppService)).ShouldBeTrue();
    }

    [Fact]
    public void Any_Signed_In_Account_May_Use_It()
    {
        var authorize = typeof(StaffNoteAppService).GetCustomAttribute<AuthorizeAttribute>();
        authorize.ShouldNotBeNull();
        authorize.Policy.ShouldBeNull();

        typeof(StaffNoteAppService).GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttribute<AuthorizeAttribute>() is not null)
            .ShouldBeEmpty();
    }

    [Fact]
    public void Branch_Scope_Goes_Through_The_Access_Checker()
    {
        typeof(StaffNoteAppService).GetConstructors()[0].GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(BranchAccessChecker));
    }
}
