namespace BlueDental.Account;

/// <summary>
/// The caller's address as the server sees it — what the branch dialog offers
/// to add to "IP được phép đăng nhập", so nobody has to look it up elsewhere.
/// </summary>
public class ClientIpDto
{
    public string? IpAddress { get; set; }
}
