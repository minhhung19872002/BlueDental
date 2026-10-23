using System.Globalization;
using Microsoft.Extensions.Localization;

namespace BlueDental.Application.Tests.CustomerCare;

/// <summary>The texts a test gives; any other key comes back as the key, the way ABP does.</summary>
internal sealed class StubLocalizer(Dictionary<string, string> texts) : IStringLocalizer
{
    public LocalizedString this[string name] =>
        new(name, texts.GetValueOrDefault(name, name), !texts.ContainsKey(name));

    public LocalizedString this[string name, params object[] arguments] =>
        new(name, string.Format(CultureInfo.InvariantCulture, this[name].Value, arguments), !texts.ContainsKey(name));

    public IEnumerable<LocalizedString> GetAllStrings(bool includeParentCultures) =>
        texts.Select(t => new LocalizedString(t.Key, t.Value));
}
