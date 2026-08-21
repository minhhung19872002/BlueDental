using Volo.Abp.Threading;

namespace BlueDental;

public static class BlueDentalGlobalFeatureConfigurator
{
    private static readonly OneTimeRunner OneTimeRunner = new();

    public static void Configure()
    {
        OneTimeRunner.Run(() =>
        {
            /* Configure global features of the ABP Framework used in this application. */
        });
    }
}
