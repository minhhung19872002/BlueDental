using System;
using System.IO;
using System.IO.Compression;

namespace BlueDental.Data;

/// <summary>
/// Writes a small PNG for the demo clinic's patient photos.
///
/// The Hình ảnh tab reads real blobs, so seeding rows alone would leave every
/// thumbnail broken. Rather than ship binary fixtures, each demo image is
/// generated here: a plain vertical gradient in a given hue, which looks like a
/// photograph placeholder without pretending to be clinical imagery.
/// </summary>
internal static class DemoPngWriter
{
    private static readonly byte[] Signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

    private static readonly uint[] CrcTable = BuildCrcTable();

    /// <summary>A gradient in <paramref name="hue"/>, as PNG bytes.</summary>
    public static byte[] Gradient(int width, int height, (byte R, byte G, byte B) hue)
    {
        var raw = new byte[height * (width * 3 + 1)];
        var at = 0;

        for (var y = 0; y < height; y++)
        {
            raw[at++] = 0; // filter: none

            // Darkest at the top, lightest at the bottom.
            var mix = 0.45 + 0.55 * (y / (double)Math.Max(1, height - 1));

            for (var x = 0; x < width; x++)
            {
                raw[at++] = (byte)(hue.R * mix);
                raw[at++] = (byte)(hue.G * mix);
                raw[at++] = (byte)(hue.B * mix);
            }
        }

        using var png = new MemoryStream();
        png.Write(Signature);

        var ihdr = new byte[13];
        WriteBigEndian(ihdr, 0, width);
        WriteBigEndian(ihdr, 4, height);
        ihdr[8] = 8;  // bit depth
        ihdr[9] = 2;  // colour type: truecolour
        ihdr[10] = 0; // compression: deflate
        ihdr[11] = 0; // filter method
        ihdr[12] = 0; // no interlace
        WriteChunk(png, "IHDR", ihdr);

        using (var deflated = new MemoryStream())
        {
            using (var zlib = new ZLibStream(deflated, CompressionLevel.Optimal, leaveOpen: true))
            {
                zlib.Write(raw);
            }

            WriteChunk(png, "IDAT", deflated.ToArray());
        }

        WriteChunk(png, "IEND", []);
        return png.ToArray();
    }

    private static void WriteChunk(Stream target, string type, byte[] data)
    {
        var header = new byte[4];
        WriteBigEndian(header, 0, data.Length);
        target.Write(header);

        var typed = new byte[4 + data.Length];
        for (var i = 0; i < 4; i++)
        {
            typed[i] = (byte)type[i];
        }

        data.CopyTo(typed, 4);
        target.Write(typed);

        var crc = new byte[4];
        WriteBigEndian(crc, 0, unchecked((int)Crc32(typed)));
        target.Write(crc);
    }

    private static void WriteBigEndian(byte[] target, int offset, int value)
    {
        target[offset] = (byte)(value >> 24);
        target[offset + 1] = (byte)(value >> 16);
        target[offset + 2] = (byte)(value >> 8);
        target[offset + 3] = (byte)value;
    }

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];

        for (uint n = 0; n < 256; n++)
        {
            var c = n;

            for (var k = 0; k < 8; k++)
            {
                c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            }

            table[n] = c;
        }

        return table;
    }

    private static uint Crc32(byte[] data)
    {
        var c = 0xFFFFFFFFu;

        foreach (var b in data)
        {
            c = CrcTable[(c ^ b) & 0xFF] ^ (c >> 8);
        }

        return c ^ 0xFFFFFFFFu;
    }
}
