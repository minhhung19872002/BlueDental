using Volo.Abp;
using Volo.Abp.Autofac;
using Volo.Abp.Modularity;

namespace BlueDental;

[DependsOn(
    typeof(AbpAutofacModule),
    typeof(AbpTestBaseModule)
)]
public class BlueDentalTestBaseModule : AbpModule;
