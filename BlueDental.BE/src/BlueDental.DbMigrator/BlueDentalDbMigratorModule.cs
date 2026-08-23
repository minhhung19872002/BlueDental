using BlueDental.EntityFrameworkCore;
using Volo.Abp.Autofac;
using Volo.Abp.Modularity;

namespace BlueDental.DbMigrator;

// The seed contributors live in BlueDental.Application, so the migrator must
// depend on that module — depending only on the contracts loaded the DTOs and
// silently skipped every contributor, which is why the default clinic branch
// never existed.
[DependsOn(
    typeof(AbpAutofacModule),
    typeof(BlueDentalEntityFrameworkCoreModule),
    typeof(BlueDentalApplicationModule)
)]
public class BlueDentalDbMigratorModule : AbpModule;
