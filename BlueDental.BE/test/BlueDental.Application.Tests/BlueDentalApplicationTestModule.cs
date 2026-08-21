using Volo.Abp.Modularity;

namespace BlueDental.Application.Tests;

[DependsOn(
    typeof(BlueDentalTestBaseModule),
    typeof(BlueDentalApplicationModule)
)]
public class BlueDentalApplicationTestModule : AbpModule;
