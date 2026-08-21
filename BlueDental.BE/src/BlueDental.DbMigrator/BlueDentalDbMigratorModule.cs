using BlueDental.EntityFrameworkCore;
using Volo.Abp.Autofac;
using Volo.Abp.Modularity;

namespace BlueDental.DbMigrator;

[DependsOn(
    typeof(AbpAutofacModule),
    typeof(BlueDentalEntityFrameworkCoreModule),
    typeof(BlueDentalApplicationContractsModule)
)]
public class BlueDentalDbMigratorModule : AbpModule;
