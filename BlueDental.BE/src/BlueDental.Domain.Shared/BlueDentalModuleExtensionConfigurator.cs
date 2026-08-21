using Volo.Abp.Threading;

namespace BlueDental;

public static class BlueDentalModuleExtensionConfigurator
{
    private static readonly OneTimeRunner OneTimeRunner = new();

    public static void Configure()
    {
        OneTimeRunner.Run(() =>
        {
            ConfigureExistingProperties();
            ConfigureExtraProperties();
        });
    }

    private static void ConfigureExistingProperties()
    {
        /* Configure ABP-provided entity properties. */
    }

    private static void ConfigureExtraProperties()
    {
        /* Configure extra (custom) properties of ABP entities. */
    }
}
