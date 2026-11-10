using System;
using System.Threading.Tasks;
using Volo.Abp.Application.Services;

namespace BlueDental.ZaloInbox;

/// <summary>
/// "Nghe chuông tin nhắn Zalo" (R-1194): what a reception screen polls to know
/// a customer has just written to the current branch's OA. No conversation,
/// name, phone or text — only when.
/// </summary>
public interface IZaloInboxPulseAppService : IApplicationService
{
    Task<ZaloInboxPulseDto> GetAsync();
}

public class ZaloInboxPulseDto
{
    /// <summary>The newest customer message in any of the branch's conversations; null while there is none.</summary>
    public DateTime? LastCustomerMessageAt { get; set; }
}
