using System;
using System.Collections.Generic;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace BlueDental.Exporting;

/// <summary>One line of a printed document's body table.</summary>
public sealed record ClinicDocumentRow(IReadOnlyList<string> Cells, bool IsTotal = false);

/// <summary>A label/value pair printed above the table.</summary>
public sealed record ClinicDocumentField(string Label, string Value);

/// <summary>
/// The printable clinic document: đơn thuốc, phiếu điều trị, biên lai.
///
/// They share one layout — clinic header, title and code, a few fields, a table
/// and a signature block — so the layout lives here and each caller supplies the
/// content.
/// </summary>
public sealed class ClinicDocument : IDocument
{
    /// <summary>
    /// Vietnamese needs Latin Extended Additional; Lato ships with QuestPDF and
    /// covers it, so diacritics survive without shipping a font file.
    /// </summary>
    private const string FontFamily = "Lato";

    public required string ClinicName { get; init; }
    public required string Title { get; init; }
    public required string Code { get; init; }
    public required IReadOnlyList<ClinicDocumentField> Fields { get; init; }
    public required IReadOnlyList<string> Headers { get; init; }
    public required IReadOnlyList<ClinicDocumentRow> Rows { get; init; }

    public string? Note { get; init; }
    public string? SignatureLabel { get; init; }
    public DateTimeOffset PrintedAt { get; init; }

    public DocumentMetadata GetMetadata() => new() { Title = $"{Title} {Code}" };

    public void Compose(IDocumentContainer container)
    {
        container.Page(page =>
        {
            page.Size(PageSizes.A4);
            page.Margin(1.5f, Unit.Centimetre);
            page.DefaultTextStyle(style => style.FontFamily(FontFamily).FontSize(10));

            page.Header().Element(ComposeHeader);
            page.Content().Element(ComposeContent);
            page.Footer().Element(ComposeFooter);
        });
    }

    private void ComposeHeader(IContainer container)
    {
        container.Column(column =>
        {
            column.Item().Text(ClinicName).FontSize(13).SemiBold();
            column.Item().PaddingTop(10).AlignCenter().Text(Title.ToUpperInvariant())
                .FontSize(16).Bold();
            column.Item().AlignCenter().Text($"Số: {Code}").FontSize(10);
            column.Item().PaddingTop(10).LineHorizontal(1);
        });
    }

    private void ComposeContent(IContainer container)
    {
        container.PaddingVertical(12).Column(column =>
        {
            column.Spacing(6);

            foreach (var field in Fields)
            {
                column.Item().Row(row =>
                {
                    row.ConstantItem(140).Text($"{field.Label}:").SemiBold();
                    row.RelativeItem().Text(field.Value);
                });
            }

            if (Headers.Count > 0)
            {
                column.Item().PaddingTop(10).Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        // The first column carries names, the rest are short values.
                        columns.RelativeColumn(3);
                        for (var i = 1; i < Headers.Count; i++)
                        {
                            columns.RelativeColumn();
                        }
                    });

                    table.Header(header =>
                    {
                        foreach (var title in Headers)
                        {
                            header.Cell().Element(HeaderCell).Text(title).SemiBold();
                        }
                    });

                    foreach (var row in Rows)
                    {
                        foreach (var cell in row.Cells)
                        {
                            table.Cell().Element(BodyCell).Text(text =>
                            {
                                if (row.IsTotal)
                                {
                                    text.Span(cell).SemiBold();
                                }
                                else
                                {
                                    text.Span(cell);
                                }
                            });
                        }
                    }
                });
            }

            if (!string.IsNullOrWhiteSpace(Note))
            {
                column.Item().PaddingTop(10).Text(text =>
                {
                    text.Span("Ghi chú: ").SemiBold();
                    text.Span(Note);
                });
            }
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.Column(column =>
        {
            column.Item().AlignRight().Text($"Ngày in: {PrintedAt:dd/MM/yyyy HH:mm}").FontSize(9);

            if (!string.IsNullOrWhiteSpace(SignatureLabel))
            {
                column.Item().PaddingTop(20).AlignRight().Width(200).Column(signature =>
                {
                    signature.Item().AlignCenter().Text(SignatureLabel).SemiBold();
                    signature.Item().AlignCenter().Text("(Ký và ghi rõ họ tên)").FontSize(9).Italic();
                    signature.Item().Height(50);
                });
            }
        });
    }

    private static IContainer HeaderCell(IContainer container) =>
        container.Background(Colors.Blue.Lighten5).BorderBottom(1).Padding(5);

    private static IContainer BodyCell(IContainer container) =>
        container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).Padding(5);

    public byte[] ToBytes() => this.GeneratePdf();
}
