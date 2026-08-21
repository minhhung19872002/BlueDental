using Volo.Abp.Modularity;

namespace BlueDental.Domain.Tests;

[DependsOn(
    typeof(BlueDentalTestBaseModule),
    typeof(BlueDentalDomainModule)
)]
public class BlueDentalDomainTestModule : AbpModule;
