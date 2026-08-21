using BlueDental.Application.Tests;
using Volo.Abp.Modularity;

namespace BlueDental.HttpApi.Host.Tests;

[DependsOn(
    typeof(BlueDentalApplicationTestModule),
    typeof(BlueDentalHttpApiModule)
)]
public class BlueDentalHttpApiHostTestModule : AbpModule;
