using Volo.Abp.Threading;

namespace BlueDental.EntityFrameworkCore;

public static class BlueDentalEfCoreEntityExtensionMappings
{
    private static readonly OneTimeRunner OneTimeRunner = new();

    public static void Configure()
    {
        OneTimeRunner.Run(() =>
        {
            /* Configure ABP entity extra property EF Core mappings here. */
        });
    }
}
