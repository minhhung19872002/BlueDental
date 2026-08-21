using Volo.Abp.Http.Client.IdentityModel;
using Volo.Abp.Modularity;

namespace BlueDental.HttpApi.Client.ConsumerTests;

[DependsOn(
    typeof(BlueDentalTestBaseModule),
    typeof(BlueDentalHttpApiClientModule),
    typeof(AbpHttpClientIdentityModelModule)
)]
public class BlueDentalHttpApiClientConsumerTestModule : AbpModule;
