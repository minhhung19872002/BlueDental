using System.Linq;
using System.Reflection;
using BlueDental.ClinicIntegration;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Volo.Abp.Application.Services;
using Xunit;

namespace BlueDental.Application.Tests.ClinicIntegration;

public class ClinicIntegrationAppServiceContractTests
{
    [Fact]
    public void SyncAppService_Implements_Its_Interface_And_Requires_A_Signed_In_User()
    {
        typeof(IClinicIntegrationSyncAppService).IsAssignableFrom(typeof(ClinicIntegrationSyncAppService)).ShouldBeTrue();
        typeof(ApplicationService).IsAssignableFrom(typeof(ClinicIntegrationSyncAppService)).ShouldBeTrue();
        typeof(ClinicIntegrationSyncAppService).GetCustomAttribute<AuthorizeAttribute>().ShouldNotBeNull();
    }

    [Fact]
    public void Connections_Are_Managed_Only_With_The_Dedicated_Permission()
    {
        typeof(IClinicConnectionAppService).IsAssignableFrom(typeof(ClinicConnectionAppService)).ShouldBeTrue();

        var attribute = typeof(ClinicConnectionAppService).GetCustomAttribute<AuthorizeAttribute>();
        attribute.ShouldNotBeNull();
        attribute!.Policy.ShouldBe(BlueDentalPermissions.ClinicIntegration.ManageConnections);
    }

    [Fact]
    public void The_Api_Key_Never_Travels_Back_To_A_Client()
    {
        var properties = typeof(ClinicConnectionDto).GetProperties().Select(p => p.Name).ToList();

        properties.ShouldNotContain("ApiKey");
        properties.ShouldNotContain("ApiKeyCipher");
        properties.ShouldContain(nameof(ClinicConnectionDto.HasApiKey));
    }

    [Fact]
    public void The_Sync_Result_Carries_Every_List_The_Result_Dialog_Reads()
    {
        var properties = typeof(ServiceCatalogSyncResultDto).GetProperties().Select(p => p.Name).ToList();

        properties.ShouldBe(
            ["Summary", "Duplicated", "Warned", "Skipped", "Updated", "BatchErrors"],
            ignoreOrder: true);
    }
}
