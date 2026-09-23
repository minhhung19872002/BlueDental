using BlueDental.CustomerCare;
using BlueDental.Permissions;
using BlueDental.Promotions;
using BlueDental.Queue;
using BlueDental.Timekeeping;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp;
using Volo.Abp.Account;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.AutoMapper;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.BlobStoring;
using Volo.Abp.FeatureManagement;
using Volo.Abp.Identity;
using Volo.Abp.Modularity;
using Volo.Abp.PermissionManagement;
using Volo.Abp.SettingManagement;
using Volo.Abp.VirtualFileSystem;

namespace BlueDental;

[DependsOn(
    typeof(BlueDentalDomainModule),
    typeof(BlueDentalApplicationContractsModule),
    typeof(AbpAccountApplicationModule),
    typeof(AbpIdentityApplicationModule),
    typeof(AbpPermissionManagementApplicationModule),
    typeof(AbpFeatureManagementApplicationModule),
    typeof(AbpSettingManagementApplicationModule),
    typeof(AbpBlobStoringModule)
)]
public class BlueDentalApplicationModule : AbpModule
{
    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        // QuestPDF refuses to render until a licence is declared; BlueDental uses
        // the Community one.
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

        Configure<AbpAutoMapperOptions>(options =>
        {
            options.AddMaps<BlueDentalApplicationModule>();
        });

        Configure<AbpVirtualFileSystemOptions>(options =>
        {
            options.FileSets.AddEmbedded<BlueDentalApplicationModule>();
        });

        // Legacy module permissions are satisfied by the ability leaves the
        // Phân quyền screen grants. Registered last so it only decides names
        // the user/role/client providers left undefined.
        Configure<AbpPermissionOptions>(options =>
        {
            options.ValueProviders.Add<AbilityBridgePermissionValueProvider>();
        });
    }

    public override async Task OnApplicationInitializationAsync(ApplicationInitializationContext context)
    {
        await context.AddBackgroundWorkerAsync<VoucherExpirationWorker>();
        await context.AddBackgroundWorkerAsync<TimekeepingEndOfDayWorker>();
        await context.AddBackgroundWorkerAsync<QueueWaitingTimeWorker>();
        await context.AddBackgroundWorkerAsync<NoServiceCareWorker>();
    }
}
