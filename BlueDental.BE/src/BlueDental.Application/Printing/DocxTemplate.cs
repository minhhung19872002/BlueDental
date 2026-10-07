using System.Collections.Generic;
using System.IO;
using System.Linq;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;

namespace BlueDental.Printing;

/// <summary>
/// Fills <c>{{Key}}</c> placeholders in a .docx. Each placeholder must sit in
/// one run (one <c>w:t</c>) — the template is authored that way — so the run
/// keeps its font and the value inherits it. Header, footer and body are all
/// filled; a key without a value becomes empty rather than leaking braces.
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

            var roots = new List<DocumentFormat.OpenXml.OpenXmlPartRootElement?> { main.Document };
            roots.AddRange(main.HeaderParts.Select(p => p.Header));
            roots.AddRange(main.FooterParts.Select(p => p.Footer));

            foreach (var text in roots.Where(r => r != null).SelectMany(r => r!.Descendants<Text>()))
            {
                if (!text.Text.Contains("{{"))
                {
                    continue;
                }

                foreach (var (key, value) in values)
                {
                    text.Text = text.Text.Replace("{{" + key + "}}", value);
                }

                // Values with leading or trailing spaces must survive Word's whitespace folding.
                text.Space = DocumentFormat.OpenXml.SpaceProcessingModeValues.Preserve;
            }
        }

        return stream.ToArray();
    }
}
