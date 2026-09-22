using System.Linq;
using System.Reflection;
using BlueDental.Operations;
using BlueDental.Operations.Reports;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.Operations;

/// <summary>
/// The Vận hành reports used to hide behind the Catalogs module permission,
/// which no custom role could hold. They now require only a signed-in user at
/// class level and check the exact reference ability inside each method.
/// </summary>
public class OperationsReportAuthorizationTests
{
    [Fact]
    public void Class_Should_Require_Only_A_Signed_In_User()
    {
        var attribute = typeof(OperationsReportAppService).GetCustomAttribute<AuthorizeAttribute>();
        attribute.ShouldNotBeNull();
        attribute.Policy.ShouldBeNull();
    }

    [Fact]
    public void No_Method_Should_Name_A_Legacy_Policy()
    {
        var legacy = typeof(OperationsReportAppService)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .SelectMany(m => m.GetCustomAttributes<AuthorizeAttribute>())
            .Where(a => a.Policy is not null && !a.Policy.Contains("operations"))
            .ToList();

        legacy.ShouldBeEmpty();
    }

    [Fact]
    public void Report_Subjects_Should_Exist_Only_For_Divisions_With_A_Bao_Cao_Tab()
    {
        OperationsAbilities.DepartmentsWithReport().ShouldBe(
        [
            OperationsDepartment.Overview,
            OperationsDepartment.Reception,
            OperationsDepartment.Cskh,
            OperationsDepartment.Marketing,
            OperationsDepartment.Treatment,
        ]);

        OperationsAbilities.HasReportSubject(OperationsDepartment.Finance).ShouldBeFalse();
        OperationsAbilities.ReportPermissionFor(OperationsDepartment.Reception, BlueDentalAbilities.Actions.Read)
            .ShouldBe("BlueDental.operationsReceptionReport.read");
    }
}
