using System.Linq;
using System.Text.Json;

namespace BlueDental.Zalo;

/// <summary>
/// The field names of a Zalo JSON object, nested ones in brackets, never its
/// values: what a log may say about a message the inbox could not read
/// (R-1023) without carrying the customer's words.
/// </summary>
public static class ZaloJsonShape
{
    private const int MaxDepth = 3;

    /// <summary>e.g. <c>src, type, links[title, url, thumb, description]</c>.</summary>
    public static string Describe(JsonElement element) => Describe(element, 0);

    private static string Describe(JsonElement element, int depth)
    {
        if (element.ValueKind != JsonValueKind.Object || depth >= MaxDepth)
        {
            return string.Empty;
        }

        return string.Join(", ", element.EnumerateObject().Select(property =>
        {
            var inner = Describe(FirstObjectOf(property.Value), depth + 1);
            return inner.Length > 0 ? $"{property.Name}[{inner}]" : property.Name;
        }));
    }

    /// <summary>The object itself, or the first object of an array; anything else has no names to show.</summary>
    private static JsonElement FirstObjectOf(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Object => value,
        JsonValueKind.Array => value.EnumerateArray().FirstOrDefault(item => item.ValueKind == JsonValueKind.Object),
        _ => default,
    };
}
