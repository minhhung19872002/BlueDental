using BlueDental.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.Autofac;
using Volo.Abp.BlobStoring;
using Volo.Abp.BlobStoring.Minio;
using Volo.Abp.Modularity;

namespace BlueDental.DbMigrator;

// The seed contributors live in BlueDental.Application, so the migrator must
// depend on that module — depending only on the contracts loaded the DTOs and
// silently skipped every contributor, which is why the default clinic branch
// never existed.
[DependsOn(
    typeof(AbpAutofacModule),
    typeof(BlueDentalEntityFrameworkCoreModule),
    typeof(BlueDentalApplicationModule),
    typeof(AbpBlobStoringMinioModule)
)]
public class BlueDentalDbMigratorModule : AbpModule
{
    /// <summary>
    /// The demo seed writes real image bytes, not just rows — a patient photo
    /// without its blob renders as a broken thumbnail. So the migrator needs
    /// the same container the host configures, or resolving IBlobContainer
    /// fails with "No BLOB Storage provider was registered".
    /// </summary>
    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        var configuration = context.Services.GetConfiguration();

        Configure<AbpBlobStoringOptions>(options =>
        {
            options.Containers.ConfigureDefault(container =>
            {
                container.UseMinio(minio =>
                {
                    minio.EndPoint = configuration["BlobStorage:Endpoint"]!;
                    minio.AccessKey = configuration["BlobStorage:AccessKey"]!;
                    minio.SecretKey = configuration["BlobStorage:SecretKey"]!;
                    minio.BucketName = configuration["BlobStorage:BucketName"]!;
                    minio.WithSSL = configuration.GetValue("BlobStorage:WithSsl", false);
                    minio.CreateBucketIfNotExists = true;
                });
            });
        });
    }
}
