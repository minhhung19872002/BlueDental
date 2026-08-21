using Volo.Abp.Testing;

namespace BlueDental;

public abstract class BlueDentalTestBase<TStartupModule>
    : AbpIntegratedTest<TStartupModule>
    where TStartupModule : class;
