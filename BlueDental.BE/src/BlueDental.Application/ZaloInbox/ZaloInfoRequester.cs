using System;
using System.Threading.Tasks;
using BlueDental.Localization;
using BlueDental.Zalo;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Volo.Abp.Data;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Localization;
using Volo.Abp.Timing;
using Volo.Abp.Uow;

namespace BlueDental.ZaloInbox;

/// <summary>
/// R-1028: Zalo's <c>request_user_info</c> card — the customer taps it and
/// sends the OA their phone (<c>user_submit_info</c>), which links the
/// conversation to their record (R-1026). It goes by itself once, the first
/// time an unknown customer turns up, and again whenever staff press "Xin SĐT".
/// It is a "tin tư vấn": Zalo takes it only within 48 hours of the customer's
/// last interaction. The customer reads it in Vietnamese whoever sent it.
/// </summary>
public class ZaloInfoRequester(
    IRepository<ZaloConversation, Guid> conversations,
    ZaloInboxIngestor ingestor,
    ZaloOaGateway gateway,
    IZaloApiClient zalo,
    IStringLocalizer<BlueDentalResource> localizer,
    IOptions<ZaloOptions> options,
    IConfiguration configuration,
    IUnitOfWorkManager unitOfWorkManager,
    IGuidGenerator guids,
    IClock clock,
    ILogger<ZaloInfoRequester> logger) : ITransientDependency
{
    public const string TemplateType = "request_user_info";

    /// <summary>
    /// The one automatic card of a conversation whose customer is not known
    /// yet. Two arrivals at once send it once; a send Zalo refused leaves it
    /// to the next arrival. Never throws: the arrival itself is already stored.
    /// </summary>
    public async Task RequestOnceAsync(ZaloOaConnection connection, Guid conversationId)
    {
        if (!connection.CanSend)
        {
            return;
        }

        try
        {
            if (!await ClaimAsync(conversationId))
            {
                return;
            }
        }
        catch (AbpDbConcurrencyException)
        {
            // Another arrival changed the conversation first; it tries the claim itself.
            return;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Zalo info request card could not be claimed");
            return;
        }

        ZaloChatMessage card;
        ZaloConversation conversation;
        try
        {
            using var uow = unitOfWorkManager.Begin(requiresNew: true);
            conversation = await conversations.GetAsync(conversationId);
            card = await SendAsync(connection, conversation, null);
            await uow.CompleteAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Zalo info request card could not be sent");
            await ReleaseAsync(conversationId);
            return;
        }

        try
        {
            using var uow = unitOfWorkManager.Begin(requiresNew: true);
            await ingestor.StoreInfoRequestAsync(await conversations.GetAsync(conversation.Id), card);
            await uow.CompleteAsync();
        }
        catch (Exception ex)
        {
            // The card went and the claim stays, so it is not sent twice; the sync brings it in.
            logger.LogWarning(ex, "Zalo info request card was sent but could not be stored");
        }
    }

    /// <summary>Sends the card; Zalo refusing it throws. The message is not stored yet.</summary>
    public async Task<ZaloChatMessage> SendAsync(ZaloOaConnection connection, ZaloConversation conversation, Guid? senderUserId)
    {
        string title, subtitle;
        using (CultureHelper.Use("vi"))
        {
            title = localizer["ZaloInbox:InfoRequest:Title"];
            subtitle = localizer["ZaloInbox:InfoRequest:Subtitle"];
        }

        var outcome = await gateway.CallWithTokenAsync(connection,
            token => zalo.SendRequestUserInfoAsync(token, conversation.ZaloUserId, title, subtitle, ImageUrlOf(connection)),
            o => o.Call);
        using (var uow = unitOfWorkManager.Begin(requiresNew: true))
        {
            await gateway.LogAsync(connection.ClinicBranchId, "cs-request-info", outcome.Call, outcome.Call.Succeeded ? 1 : 0);
            await uow.CompleteAsync();
        }

        if (!outcome.Call.Succeeded)
        {
            throw ZaloOaGateway.Refused(outcome.Call);
        }

        return new ZaloChatMessage(
            guids.Create(), conversation, outcome.MessageId, ZaloChatDirection.Outbound,
            ZaloChatKind.InfoRequest, title, null, clock.Now, senderUserId);
    }

    /// <summary>Zalo requires the card's picture: the configured one, else the OA's avatar, else our logo.</summary>
    private string ImageUrlOf(ZaloOaConnection connection) =>
        Blank(options.Value.InfoRequestImageUrl)
        ?? Blank(connection.AvatarUrl)
        ?? $"{configuration["App:SelfUrl"]?.TrimEnd('/')}/logo.png";

    private async Task<bool> ClaimAsync(Guid conversationId)
    {
        using var uow = unitOfWorkManager.Begin(requiresNew: true);
        var conversation = await conversations.GetAsync(conversationId);
        if (!conversation.TryClaimInfoRequest(clock.Now))
        {
            return false;
        }

        // The concurrency stamp makes a second claim made meanwhile fail here.
        await conversations.UpdateAsync(conversation);
        await uow.CompleteAsync();
        return true;
    }

    private async Task ReleaseAsync(Guid conversationId)
    {
        try
        {
            using var uow = unitOfWorkManager.Begin(requiresNew: true);
            var conversation = await conversations.GetAsync(conversationId);
            conversation.ReleaseInfoRequest();
            await conversations.UpdateAsync(conversation);
            await uow.CompleteAsync();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Zalo info request claim could not be released");
        }
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
