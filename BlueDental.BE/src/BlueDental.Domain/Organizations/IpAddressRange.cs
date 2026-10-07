using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using Volo.Abp;
using Volo.Abp.Domain.Values;

namespace BlueDental.Organizations;

/// <summary>
/// One entry of a branch's "IP được phép đăng nhập" list: a single address
/// (<c>113.161.10.20</c>) or a CIDR block (<c>113.161.10.0/24</c>), IPv4 or IPv6.
///
/// A block written with host bits set (<c>192.168.1.5/24</c>) is accepted and
/// stored as its network (<c>192.168.1.0/24</c>) — the person typing it means
/// "this office network", not a parse error.
/// </summary>
public sealed class IpAddressRange : ValueObject
{
    public IPAddress Network { get; }
    public int PrefixLength { get; }

    private IpAddressRange(IPAddress network, int prefixLength)
    {
        Network = network;
        PrefixLength = prefixLength;
    }

    public static bool TryParse(string? text, out IpAddressRange? range)
    {
        range = null;
        if (string.IsNullOrWhiteSpace(text)) return false;

        var parts = text.Trim().Split('/');
        if (parts.Length > 2 || !IPAddress.TryParse(parts[0], out var address)) return false;

        // IPAddress.TryParse also accepts "1" or "1.2" as shorthand for
        // 0.0.0.1 / 1.0.0.2; nobody types those meaning an office network.
        if (address.AddressFamily == AddressFamily.InterNetwork && parts[0].Count(c => c == '.') != 3)
            return false;

        address = Normalize(address);
        var maxPrefix = address.GetAddressBytes().Length * 8;
        var prefix = maxPrefix;

        if (parts.Length == 2
            && (!int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out prefix)
                || prefix < 0 || prefix > maxPrefix))
        {
            return false;
        }

        range = new IpAddressRange(Mask(address, prefix), prefix);
        return true;
    }

    /// <summary>
    /// Parses a whole list — one entry per line, or separated by commas,
    /// semicolons or spaces — and throws naming the first entry that is not an
    /// address or CIDR block.
    /// </summary>
    public static IReadOnlyList<IpAddressRange> ParseList(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return [];

        var ranges = new List<IpAddressRange>();
        foreach (var entry in text.Split([',', ';', ' ', '\t', '\r', '\n'], StringSplitOptions.RemoveEmptyEntries))
        {
            if (!TryParse(entry, out var range))
            {
                throw new BusinessException(BlueDentalDomainErrorCodes.Organizations.InvalidIpRange)
                    .WithData("value", entry);
            }

            if (!ranges.Any(r => r.ValueEquals(range!))) ranges.Add(range!);
        }

        return ranges;
    }

    public bool Contains(IPAddress? address)
    {
        if (address is null) return false;

        address = Normalize(address);
        if (address.AddressFamily != Network.AddressFamily) return false;

        return Mask(address, PrefixLength).Equals(Network);
    }

    /// <summary>
    /// Kestrel reports an IPv4 client on a dual-stack socket as
    /// <c>::ffff:1.2.3.4</c>; compare it as the IPv4 address it is.
    /// </summary>
    public static IPAddress Normalize(IPAddress address) =>
        address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;

    private static IPAddress Mask(IPAddress address, int prefix)
    {
        var bytes = address.GetAddressBytes();
        for (var i = 0; i < bytes.Length; i++)
        {
            var bitsInByte = Math.Clamp(prefix - i * 8, 0, 8);
            bytes[i] &= (byte)(0xFF << (8 - bitsInByte));
        }

        return new IPAddress(bytes);
    }

    public override string ToString()
    {
        var full = Network.GetAddressBytes().Length * 8;
        return PrefixLength == full ? Network.ToString() : $"{Network}/{PrefixLength}";
    }

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return Network;
        yield return PrefixLength;
    }
}
