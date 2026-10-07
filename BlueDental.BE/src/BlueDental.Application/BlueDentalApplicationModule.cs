using BlueDental.Appointments;
using BlueDental.CustomerCare;
using BlueDental.EInvoicing;
using BlueDental.Permissions;
using BlueDental.Promotions;
using BlueDental.Queue;
using BlueDental.Timekeeping;
using BlueDental.Zalo;
using Microsoft.Extensions.Configuration;
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

        // The partner system a branch syncs its catalog to. Bounded, so a
        // partner that hangs cannot hold a request past the 30-second budget.
        context.Services.AddHttpClient(
            ClinicIntegration.HttpClinicPartnerClient.ClientName,
            client => client.Timeout = TimeSpan.FromSeconds(30));

        // Zalo OA: app credentials and the OA secret come from the Zalo section
        // (environment on the server, the gitignored Development file locally).
        var configuration = context.Services.GetConfiguration();
        Configure<ZaloOptions>(configuration.GetSection(ZaloOptions.SectionName));
        context.Services.AddHttpClient(
            HttpZaloApiClient.ClientName,
            client => client.Timeout = TimeSpan.FromSeconds(30));

        // EasyInvoice e-invoicing: sandbox or production API.
        Configure<EasyInvoiceOptions>(configuration.GetSection(EasyInvoiceOptions.SectionName));
        context.Services.AddHttpClient(
            HttpEasyInvoiceClient.ClientName,
            client => client.Timeout = TimeSpan.FromSeconds(
                configuration.GetValue<int?>($"{EasyInvoiceOptions.SectionName}:TimeoutSeconds") ?? 30));

        // PHIẾU THU: the .docx template is filled here and rendered to PDF by
        // Gotenberg (LibreOffice in its own container).
        Configure<Printing.PaymentReceiptOptions>(configuration.GetSection(Printing.PaymentReceiptOptions.SectionName));
        context.Services.AddHttpClient(
            Printing.GotenbergPdfConverter.ClientName,
            client => client.Timeout = TimeSpan.FromSeconds(
                configuration.GetValue<int?>($"{Printing.PaymentReceiptOptions.SectionName}:TimeoutSeconds") ?? 60));

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
        await context.AddBackgroundWorkerAsync<ZaloTokenRefreshWorker>();
        await context.AddBackgroundWorkerAsync<MissedAppointmentWorker>();
    }
}
