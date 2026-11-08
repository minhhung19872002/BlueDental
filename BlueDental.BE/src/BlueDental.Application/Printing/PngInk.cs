using System;
using System.Buffers.Binary;
using System.IO;
using System.IO.Compression;

namespace BlueDental.Printing;

/// <summary>
/// Where the strokes are on a signature PNG. A signature pad hands back its
/// whole canvas, mostly empty, with the name drawn wherever the hand landed;
/// centred as it is, the strokes sit off to one side of the name below them
/// (R-1101). Reads the 8-bit, non-interlaced PNGs a browser canvas writes;
/// anything else — or a picture with no strokes — gives null and is used whole.
/// </summary>
public static class PngInk
{
    /// <summary>A pixel area, right and bottom exclusive.</summary>
    public readonly record struct Area(int Left, int Top, int Right, int Bottom)
    {
        public int Width => Right - Left;

        public int Height => Bottom - Top;
    }

    /// <summary>Bigger than any signature pad; past it the picture is used whole rather than decoded.</summary>
    private const long MaxPixels = 16_000_000;

    /// <summary>Fainter than this is background: transparent canvas, white or scanned paper.</summary>
    private const int MinAlpha = 64;
    private const int MaxInkChannel = 200;

    /// <summary>Around the strokes so their soft edges are not cut.</summary>
    private const int Margin = 4;

    /// <summary>What a signature's strokes measure: where they are and how thick, in pixels.</summary>
    public readonly record struct Strokes(Area Bounds, double Width);

    /// <summary>The strokes' area plus a small margin, or null when it cannot tell.</summary>
    public static Area? Bounds(byte[] png) => Measure(png)?.Bounds;

    /// <summary>
    /// Where the strokes are (plus a small margin) and how thick they are, or
    /// null when it cannot tell. The thickness is the ink there is — each pixel
    /// counted by how much of it is covered, so soft edges add what they show —
    /// over half the strokes' outline: a stroke w wide and L long holds w·L of
    /// ink and has 2·L of edge.
    /// </summary>
    public static Strokes? Measure(byte[] png)
    {
        var image = Decode(png);
        if (image == null)
        {
            return null;
        }

        var (width, height, channels, pixels) = image.Value;
        int left = width, top = height, right = -1, bottom = -1;
        double ink = 0;
        long edge = 0;
        var stride = width * channels;
        bool InkAt(int x, int y) =>
            x >= 0 && y >= 0 && x < width && y < height && IsInk(pixels, y * stride + x * channels, channels);

        for (var y = 0; y < height; y++)
        {
            var row = y * stride;
            for (var x = 0; x < width; x++)
            {
                if (!IsInk(pixels, row + x * channels, channels))
                {
                    continue;
                }

                ink += Coverage(pixels, row + x * channels, channels);
                if (!InkAt(x - 1, y) || !InkAt(x + 1, y) || !InkAt(x, y - 1) || !InkAt(x, y + 1))
                {
                    edge++;
                }

                left = Math.Min(left, x);
                right = Math.Max(right, x);
                top = Math.Min(top, y);
                bottom = Math.Max(bottom, y);
            }
        }

        if (right < 0)
        {
            return null;
        }

        var bounds = new Area(
            Math.Max(0, left - Margin),
            Math.Max(0, top - Margin),
            Math.Min(width, right + 1 + Margin),
            Math.Min(height, bottom + 1 + Margin));
        return new Strokes(bounds, Math.Max(1, 2 * ink / Math.Max(1, edge)));
    }

    /// <summary>How much of an ink pixel the stroke covers, 0..1: its opacity on a transparent canvas, its darkness on paper.</summary>
    private static double Coverage(byte[] pixels, int at, int channels) => channels switch
    {
        1 => (255 - pixels[at]) / 255.0,
        2 => pixels[at + 1] / 255.0,
        3 => (255 - Darkest(pixels, at)) / 255.0,
        _ => pixels[at + 3] / 255.0
    };

    /// <summary>Colour types 0 grey, 2 RGB, 4 grey + alpha, 6 RGBA.</summary>
    private static bool IsInk(byte[] pixels, int at, int channels) => channels switch
    {
        1 => pixels[at] <= MaxInkChannel,
        2 => pixels[at + 1] >= MinAlpha && pixels[at] <= MaxInkChannel,
        3 => Darkest(pixels, at) <= MaxInkChannel,
        _ => pixels[at + 3] >= MinAlpha && Darkest(pixels, at) <= MaxInkChannel
    };

    private static int Darkest(byte[] pixels, int at) => Math.Min(pixels[at], Math.Min(pixels[at + 1], pixels[at + 2]));

    private static (int Width, int Height, int Channels, byte[] Pixels)? Decode(byte[] png)
    {
        if (png.Length < 33 || png[0] != 0x89 || png[1] != 0x50 || png[2] != 0x4E || png[3] != 0x47)
        {
            return null;
        }

        var span = png.AsSpan();
        var width = BinaryPrimitives.ReadInt32BigEndian(span[16..]);
        var height = BinaryPrimitives.ReadInt32BigEndian(span[20..]);
        int bitDepth = png[24], colourType = png[25], interlace = png[28];
        int channels = colourType switch { 0 => 1, 2 => 3, 4 => 2, 6 => 4, _ => 0 };
        if (width <= 0 || height <= 0 || (long)width * height > MaxPixels
            || bitDepth != 8 || interlace != 0 || channels == 0)
        {
            return null;
        }

        using var deflated = new MemoryStream();
        for (var at = 8; at + 12 <= png.Length;)
        {
            var length = BinaryPrimitives.ReadInt32BigEndian(span[at..]);
            if (length < 0 || at + 12 + (long)length > png.Length)
            {
                return null;
            }

            var type = System.Text.Encoding.ASCII.GetString(png, at + 4, 4);
            if (type == "IDAT")
            {
                deflated.Write(png, at + 8, length);
            }
            else if (type == "IEND")
            {
                break;
            }

            at += 12 + length;
        }

        var stride = width * channels;
        var raw = new byte[height * (stride + 1)];
        try
        {
            deflated.Position = 0;
            using var zlib = new ZLibStream(deflated, CompressionMode.Decompress);
            zlib.ReadExactly(raw);
        }
        catch (Exception ex) when (ex is InvalidDataException or EndOfStreamException)
        {
            return null;
        }

        var pixels = Unfilter(raw, width, height, channels);
        return pixels == null ? null : (width, height, channels, pixels);
    }

    /// <summary>Undoes the per-row filters (PNG spec §9): None, Sub, Up, Average, Paeth.</summary>
    private static byte[]? Unfilter(byte[] raw, int width, int height, int channels)
    {
        var stride = width * channels;
        var pixels = new byte[height * stride];
        for (var y = 0; y < height; y++)
        {
            var filter = raw[y * (stride + 1)];
            var source = y * (stride + 1) + 1;
            var row = y * stride;
            for (var x = 0; x < stride; x++)
            {
                int a = x >= channels ? pixels[row + x - channels] : 0;
                int b = y > 0 ? pixels[row - stride + x] : 0;
                int c = x >= channels && y > 0 ? pixels[row - stride + x - channels] : 0;
                int predicted;
                switch (filter)
                {
                    case 0: predicted = 0; break;
                    case 1: predicted = a; break;
                    case 2: predicted = b; break;
                    case 3: predicted = (a + b) / 2; break;
                    case 4: predicted = Paeth(a, b, c); break;
                    default: return null;
                }

                pixels[row + x] = (byte)(raw[source + x] + predicted);
            }
        }

        return pixels;
    }

    private static int Paeth(int a, int b, int c)
    {
        var p = a + b - c;
        int pa = Math.Abs(p - a), pb = Math.Abs(p - b), pc = Math.Abs(p - c);
        if (pa <= pb && pa <= pc)
        {
            return a;
        }

        return pb <= pc ? b : c;
    }
}
