using BlueDental.Localization;
using Volo.Abp.Application.Services;

namespace BlueDental;

/// <summary>
/// Base for application services that localize text themselves (Excel headers,
/// status labels). Binding the resource here is required: on this host,
/// <see cref="ApplicationService"/>'s default-resource lookup hands back the raw
/// key, so <c>L["BE:Field:RecordNo"]</c> came out as the key itself (R-521).
/// </summary>
public abstract class BlueDentalAppService : ApplicationService
{
    protected BlueDentalAppService()
    {
        LocalizationResource = typeof(BlueDentalResource);
    }
}
