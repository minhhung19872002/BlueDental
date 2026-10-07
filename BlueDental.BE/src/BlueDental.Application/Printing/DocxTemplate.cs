using System.Collections.Generic;
using System.IO;
using System.Linq;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace BlueDental.Printing;

/// <summary>
/// Fills <c>{{Key}}</c> placeholders in a .docx. Each placeholder must sit in
/// one run (one <c>w:t</c>) — the template is authored that way — so the run
/// keeps its font and the value inherits it. Header, footer and body are all
/// filled; a key without a value becomes empty rather than leaking braces.
/// <para>
/// The blanks after a placeholder ("Họ tên: {{Name}} ......") are tabs with a
/// dot leader. Once a placeholder gets a value the dots of the tab right after
/// it are dropped — the tab stays, so a column such as "Viết bằng chữ" keeps
/// its place. An empty value keeps its dots, to be written by hand.
/// </para>
/// </summary>
public static class DocxTemplate
{
    public static byte[] Fill(byte[] template, IReadOnlyDictionary<string, string> values)
    {
        using var stream = new MemoryStream();
        stream.Write(template);

        using (var document = WordprocessingDocument.Open(stream, isEditable: true))
        {
            var main = document.MainDocumentPart
                ?? throw new InvalidDataException("The template has no document body.");

            var roots = new List<OpenXmlPartRootElement?> { main.Document };
            roots.AddRange(main.HeaderParts.Select(p => p.Header));
            roots.AddRange(main.FooterParts.Select(p => p.Footer));

            foreach (var paragraph in roots.Where(r => r != null).SelectMany(r => r!.Descendants<Paragraph>()).ToList())
            {
                FillParagraph(paragraph, values);
            }
        }

        return stream.ToArray();
    }

    private static void FillParagraph(Paragraph paragraph, IReadOnlyDictionary<string, string> values)
    {
        var filledTabs = new List<int>();
        var tabIndex = 0;
        var afterFilledPlaceholder = false;

        // Text and tabs in reading order; a text box's own paragraphs are filled on their own.
        var content = paragraph.Descendants()
            .Where(e => e is Text or TabChar)
            .Where(e => e.Ancestors<Paragraph>().First() == paragraph);

        foreach (var element in content.ToList())
        {
            if (element is TabChar)
            {
                if (afterFilledPlaceholder)
                {
                    filledTabs.Add(tabIndex);
                }

                tabIndex++;
                afterFilledPlaceholder = false;
                continue;
            }

            var text = (Text)element;
            if (text.Text.Contains("{{"))
            {
                afterFilledPlaceholder = Replace(text, values);
            }
            else if (!string.IsNullOrWhiteSpace(text.Text))
            {
                afterFilledPlaceholder = false;
            }
        }

        DropLeaders(paragraph, filledTabs);
    }

    /// <summary>Replaces every placeholder in the run; true when one of them got a non-blank value.</summary>
    private static bool Replace(Text text, IReadOnlyDictionary<string, string> values)
    {
        var filled = false;
        foreach (var (key, value) in values)
        {
            var placeholder = "{{" + key + "}}";
            if (!text.Text.Contains(placeholder))
            {
                continue;
            }

            text.Text = text.Text.Replace(placeholder, value);
            filled |= !string.IsNullOrWhiteSpace(value);
        }

        // Values with leading or trailing spaces must survive Word's whitespace folding.
        text.Space = SpaceProcessingModeValues.Preserve;
        return filled;
    }

    /// <summary>
    /// The n-th tab of a line lands on the n-th tab stop: every value sits well
    /// short of the next stop on this template's lines.
    /// </summary>
    private static void DropLeaders(Paragraph paragraph, List<int> tabIndexes)
    {
        if (tabIndexes.Count == 0)
        {
            return;
        }

        var stops = paragraph.ParagraphProperties?.Tabs?.Elements<TabStop>()
            .Where(s => s.Val?.Value != TabStopValues.Clear)
            .OrderBy(s => s.Position?.Value ?? 0)
            .ToList() ?? [];

        foreach (var index in tabIndexes.Where(i => i < stops.Count))
        {
            stops[index].Leader = TabStopLeaderCharValues.None;
        }
    }
}
