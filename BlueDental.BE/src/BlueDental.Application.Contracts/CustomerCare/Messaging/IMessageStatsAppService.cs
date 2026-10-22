using System.Collections.Generic;
using System.Threading.Tasks;
using Volo.Abp.Application.Dtos;
using Volo.Abp.Application.Services;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// Tổng quan ▸ Thống kê CSKH (BA P2110, F-78): what the branch's CSKH
/// messages did over a period — per day, channel, template, send and
/// customer. Nothing on who read or answered: no provider reports it yet.
/// </summary>
public interface IMessageStatsAppService : IApplicationService
{
    /// <summary>The cards, the day chart, "Theo kênh" and "Hiệu suất theo mẫu".</summary>
    Task<MessageStatsOverviewDto> GetOverviewAsync(MessageStatsOverviewInput input);

    /// <summary>The branch's templates for the "Mẫu" select, deleted ones that sent included.</summary>
    Task<List<MessageStatsTemplateOptionDto>> GetTemplateOptionsAsync();

    /// <summary>"Lịch sử gửi": sends made or set to go within the period, newest first.</summary>
    Task<PagedResultDto<MessageStatsBatchDto>> GetBatchesAsync(MessageStatsPagedInput input);

    /// <summary>"Người nhận".</summary>
    Task<PagedResultDto<MessageStatsRecipientDto>> GetRecipientsAsync(GetMessageStatsRecipientsInput input);

    /// <summary>"Xuất báo cáo Excel": one sheet per table.</summary>
    Task<byte[]> ExportAsync(MessageStatsExportInput input);
}
