using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.Tools;

/// <summary>
/// One customer's message out of a template: the SMS / e-mail text, or for
/// Zalo the value of each ZNS parameter. Shared by "Xem trước" on the
/// template editor and by the send itself, so what was previewed is what goes.
/// </summary>
public static class MessageComposer
{
    private static readonly IReadOnlyDictionary<string, string> NoParams = new Dictionary<string, string>();

    public static ComposedMessage Compose(MessageTemplate template, IReadOnlyDictionary<string, string?> values) =>
        Compose(template.Channel, template.Content, template.Subject, template.GetParamMap(), template.RemoveDiacritics, values);

    public static ComposedMessage Compose(
        MessageChannelType channel,
        string? content,
        string? subject,
        IReadOnlyDictionary<string, string>? paramMap,
        bool removeDiacritics,
        IReadOnlyDictionary<string, string?> values)
    {
        var results = new List<MessageRenderResult>();

        if (channel == MessageChannelType.Zalo)
        {
            var parameters = new List<ComposedParam>();
            foreach (var (name, expression) in paramMap ?? NoParams)
            {
                var result = MessageTemplateRenderer.Render(expression, values);
                results.Add(result);
                parameters.Add(new ComposedParam(name, result.Text));
            }

            var lines = string.Join("\n", parameters.Select(p => $"{p.Name}: {p.Value}"));
            return Build(lines, null, parameters, results);
        }

        var body = MessageTemplateRenderer.Render(
            content ?? string.Empty, values, channel == MessageChannelType.Sms && removeDiacritics);
        results.Add(body);

        string? renderedSubject = null;
        if (channel == MessageChannelType.Email)
        {
            var title = MessageTemplateRenderer.Render(subject ?? string.Empty, values);
            results.Add(title);
            renderedSubject = title.Text;
        }

        return Build(body.Text, renderedSubject, [], results);
    }

    private static ComposedMessage Build(
        string text, string? subject, IReadOnlyList<ComposedParam> parameters, List<MessageRenderResult> results) =>
        new(text, subject, parameters,
            [.. results.SelectMany(r => r.Missing).Distinct(StringComparer.Ordinal)],
            [.. results.SelectMany(r => r.Unknown).Distinct(StringComparer.Ordinal)]);
}

public sealed record ComposedParam(string Name, string Value);

/// <param name="Text">The SMS / e-mail body; for Zalo, one <c>param: value</c> line per parameter.</param>
/// <param name="Missing">Variables with no value and no fallback — the customer is left out of a send.</param>
public sealed record ComposedMessage(
    string Text,
    string? Subject,
    IReadOnlyList<ComposedParam> Params,
    IReadOnlyList<string> Missing,
    IReadOnlyList<string> Unknown)
{
    public IReadOnlyDictionary<string, string> ParamValues =>
        Params.ToDictionary(p => p.Name, p => p.Value, StringComparer.Ordinal);
}
