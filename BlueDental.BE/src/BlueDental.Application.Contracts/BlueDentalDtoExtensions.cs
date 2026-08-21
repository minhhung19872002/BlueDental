using Volo.Abp.Threading;

namespace BlueDental;

public static class BlueDentalDtoExtensions
{
    private static readonly OneTimeRunner OneTimeRunner = new();

    public static void Configure()
    {
        OneTimeRunner.Run(() =>
        {
            /* Configure extra DTO properties for ABP entities here. */
        });
    }
}
