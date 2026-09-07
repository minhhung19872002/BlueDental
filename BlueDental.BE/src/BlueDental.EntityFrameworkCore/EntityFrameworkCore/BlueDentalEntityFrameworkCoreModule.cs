using Microsoft.Extensions.DependencyInjection;
using Volo.Abp.AuditLogging.EntityFrameworkCore;
using Volo.Abp.BackgroundJobs.EntityFrameworkCore;
using Volo.Abp.EntityFrameworkCore;
using Volo.Abp.EntityFrameworkCore.PostgreSql;
using Volo.Abp.FeatureManagement.EntityFrameworkCore;
using Volo.Abp.Identity.EntityFrameworkCore;
using Volo.Abp.Modularity;
using Volo.Abp.OpenIddict.EntityFrameworkCore;
using Volo.Abp.PermissionManagement.EntityFrameworkCore;
using Volo.Abp.SettingManagement.EntityFrameworkCore;
using BlueDental.Catalogs;
using BlueDental.PatientManagement;
using Microsoft.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore;

[DependsOn(
    typeof(BlueDentalDomainModule),
    typeof(AbpIdentityEntityFrameworkCoreModule),
    typeof(AbpOpenIddictEntityFrameworkCoreModule),
    typeof(AbpPermissionManagementEntityFrameworkCoreModule),
    typeof(AbpSettingManagementEntityFrameworkCoreModule),
    typeof(AbpEntityFrameworkCorePostgreSqlModule),
    typeof(AbpBackgroundJobsEntityFrameworkCoreModule),
    typeof(AbpAuditLoggingEntityFrameworkCoreModule),
    typeof(AbpFeatureManagementEntityFrameworkCoreModule)
)]
public class BlueDentalEntityFrameworkCoreModule : AbpModule
{
    public override void PreConfigureServices(ServiceConfigurationContext context)
    {
        BlueDentalEfCoreEntityExtensionMappings.Configure();
    }

    public override void ConfigureServices(ServiceConfigurationContext context)
    {
        context.Services.AddAbpDbContext<BlueDentalDbContext>(options =>
        {
            options.AddDefaultRepositories(includeAllEntities: true);

            // A catalog entry is only half a record without the part its own
            // catalog carries — a service's price configuration, a medicine's
            // ingredients, the stage or medicine-line tables. Loading them by
            // default keeps every read path from having to remember, and keeps
            // the Application layer from needing a reference to EF Core just to
            // write an Include.
            options.Entity<CatalogEntry>(entity =>
                entity.DefaultWithDetailsFunc = query => query
                    .Include(x => x.ServiceConfig)
                    .Include(x => x.Medicine)
                    .Include(x => x.Stages)
                    .Include(x => x.PrescriptionLines));

            // Lý do đến khám is a child list the profile card always renders,
            // and the hồ sơ dialog rewrites its root line — a patient read
            // without it would save an empty list back over the record.
            options.Entity<Patient>(entity =>
                entity.DefaultWithDetailsFunc = query => query
                    .Include(x => x.ExaminationReasons));
        });

        Configure<AbpDbContextOptions>(options =>
        {
            options.UseNpgsql();
        });

    }
}
