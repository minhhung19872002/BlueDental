using BlueDental.Promotions;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp;
using Volo.Abp.Account;
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
    }

    public override async Task OnApplicationInitializationAsync(ApplicationInitializationContext context)
    {
        await context.AddBackgroundWorkerAsync<VoucherExpirationWorker>();
    }
}
