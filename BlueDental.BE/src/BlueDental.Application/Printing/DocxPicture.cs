using System.IO;
using System.Linq;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using A = DocumentFormat.OpenXml.Drawing;
using DW = DocumentFormat.OpenXml.Drawing.Wordprocessing;
using PIC = DocumentFormat.OpenXml.Drawing.Pictures;

namespace BlueDental.Printing;

/// <summary>
/// Puts a PNG on the first page of a .docx at a fixed place, measured from the
/// page's top-left corner, floating in front of the text so the template's
/// own layout does not move.
/// </summary>
public static class DocxPicture
{
    private const long EmuPerMillimetre = 36_000;

    public static byte[] Place(byte[] docx, byte[] png, double leftMm, double topMm, double sizeMm, string name)
    {
        using var stream = new MemoryStream();
        stream.Write(docx);

        using (var document = WordprocessingDocument.Open(stream, isEditable: true))
        {
            var main = document.MainDocumentPart
                ?? throw new InvalidDataException("The document has no body.");
            var imagePart = main.AddImagePart(ImagePartType.Png);
            using (var image = new MemoryStream(png))
            {
                imagePart.FeedData(image);
            }

            var body = main.Document.Body ?? throw new InvalidDataException("The document has no body.");
            var host = body.Elements<Paragraph>().FirstOrDefault()
                ?? body.PrependChild(new Paragraph());
            var pictureId = (uint)(main.Document.Descendants<DW.DocProperties>().Count() + 1000);
            host.AppendChild(new Run(Anchored(
                main.GetIdOfPart(imagePart), pictureId, name,
                Emu(leftMm), Emu(topMm), Emu(sizeMm))));
        }

        return stream.ToArray();
    }

    private static long Emu(double millimetres) => (long)(millimetres * EmuPerMillimetre);

    private static Drawing Anchored(string relationshipId, uint id, string name, long left, long top, long size) =>
        new(new DW.Anchor(
            new DW.SimplePosition { X = 0, Y = 0 },
            new DW.HorizontalPosition(new DW.PositionOffset(left.ToString()))
                { RelativeFrom = DW.HorizontalRelativePositionValues.Page },
            new DW.VerticalPosition(new DW.PositionOffset(top.ToString()))
                { RelativeFrom = DW.VerticalRelativePositionValues.Page },
            new DW.Extent { Cx = size, Cy = size },
            new DW.EffectExtent { LeftEdge = 0, TopEdge = 0, RightEdge = 0, BottomEdge = 0 },
            new DW.WrapNone(),
            new DW.DocProperties { Id = id, Name = name },
            new DW.NonVisualGraphicFrameDrawingProperties(new A.GraphicFrameLocks { NoChangeAspect = true }),
            new A.Graphic(new A.GraphicData(
                new PIC.Picture(
                    new PIC.NonVisualPictureProperties(
                        new PIC.NonVisualDrawingProperties { Id = 0, Name = name + ".png" },
                        new PIC.NonVisualPictureDrawingProperties()),
                    new PIC.BlipFill(
                        new A.Blip { Embed = relationshipId },
                        new A.Stretch(new A.FillRectangle())),
                    new PIC.ShapeProperties(
                        new A.Transform2D(
                            new A.Offset { X = 0, Y = 0 },
                            new A.Extents { Cx = size, Cy = size }),
                        new A.PresetGeometry(new A.AdjustValueList()) { Preset = A.ShapeTypeValues.Rectangle })))
                { Uri = "http://schemas.openxmlformats.org/drawingml/2006/picture" }))
        {
            DistanceFromTop = 0,
            DistanceFromBottom = 0,
            DistanceFromLeft = 0,
            DistanceFromRight = 0,
            SimplePos = false,
            RelativeHeight = 251_659_264,
            BehindDoc = false,
            Locked = false,
            LayoutInCell = true,
            AllowOverlap = true
        });
}
