using System.Reflection;
using BlueDental.CustomerCare;
using BlueDental.Organizations;
using BlueDental.Permissions;
using BlueDental.ZaloInbox;
using Microsoft.AspNetCore.Authorization;
using Shouldly;
using Xunit;

namespace BlueDental.Application.Tests.ZaloInbox;

/// <summary>
/// CSKH ▸ Hộp thư Zalo and the record's Lịch sử chăm sóc (F-80): opening the
/// inbox, a conversation or a ZNS preview needs cskhInbox.read and every step
/// that changes a conversation cskhInbox.update; the history reads with
/// treatmentCskh.read; care notes take the leaf of the screen they are written
/// on; the branch comes through the access checker everywhere.
/// </summary>
public class ZaloInboxAppServiceContractTests
{
    [Theory]
    [InlineData(typeof(ZaloInboxAppService), typeof(IZaloInboxAppService), BlueDentalAbilityPermissions.CskhInbox.Read)]
    [InlineData(typeof(ZaloInboxZnsAppService), typeof(IZaloInboxZnsAppService), BlueDentalAbilityPermissions.CskhInbox.Read)]
    [InlineData(typeof(PatientCareHistoryAppService), typeof(IPatientCareHistoryAppService), BlueDentalAbilityPermissions.TreatmentCskh.Read)]
    public void Services_Read_With_Their_Read_Permission_In_The_Branch(System.Type service, System.Type contract, string policy)
    {
        contract.IsAssignableFrom(service).ShouldBeTrue();
        service.GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(policy);
        service.GetConstructors()[0].GetParameters()
            .ShouldContain(p => p.ParameterType == typeof(BranchAccessChecker));
    }

    [Theory]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.ClaimAsync), BlueDentalAbilityPermissions.CskhInbox.Update)]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.ReleaseAsync), BlueDentalAbilityPermissions.CskhInbox.Update)]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.TransferAsync), BlueDentalAbilityPermissions.CskhInbox.Update)]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.SendMessageAsync), BlueDentalAbilityPermissions.CskhInbox.Update)]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.SetTagsAsync), BlueDentalAbilityPermissions.CskhInbox.Update)]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.LinkPatientAsync), BlueDentalAbilityPermissions.CskhInbox.Update)]
    [InlineData(typeof(ZaloInboxZnsAppService), nameof(ZaloInboxZnsAppService.SendAsync), BlueDentalAbilityPermissions.CskhInbox.Update)]
    [InlineData(typeof(CareNoteAppService), nameof(CareNoteAppService.GetForConversationAsync), BlueDentalAbilityPermissions.CskhInbox.Read)]
    [InlineData(typeof(CareNoteAppService), nameof(CareNoteAppService.CreateForConversationAsync), BlueDentalAbilityPermissions.CskhInbox.Update)]
    [InlineData(typeof(CareNoteAppService), nameof(CareNoteAppService.GetForPatientAsync), BlueDentalAbilityPermissions.TreatmentCskh.Read)]
    [InlineData(typeof(CareNoteAppService), nameof(CareNoteAppService.CreateForPatientAsync), BlueDentalAbilityPermissions.TreatmentCskh.Create)]
    public void Methods_Need_Their_Leaf(System.Type service, string method, string policy)
    {
        service.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBe(policy);
    }

    [Theory]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.GetListAsync))]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.GetCountsAsync))]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.GetAsync))]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.GetMessagesAsync))]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.SyncRecentAsync))]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.SyncConversationAsync))]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.GetAssigneesAsync))]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.GetTagSuggestionsAsync))]
    [InlineData(typeof(ZaloInboxAppService), nameof(ZaloInboxAppService.FindPatientsAsync))]
    [InlineData(typeof(ZaloInboxZnsAppService), nameof(ZaloInboxZnsAppService.GetTemplatesAsync))]
    [InlineData(typeof(ZaloInboxZnsAppService), nameof(ZaloInboxZnsAppService.PreviewAsync))]
    [InlineData(typeof(PatientCareHistoryAppService), nameof(PatientCareHistoryAppService.GetListAsync))]
    [InlineData(typeof(PatientCareHistoryAppService), nameof(PatientCareHistoryAppService.GetOverviewAsync))]
    public void The_Rest_Only_Reads(System.Type service, string method)
    {
        service.GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>().ShouldBeNull();
    }

    /// <summary>Changing or striking a note is checked in the method: either screen's handling leaf will do.</summary>
    [Theory]
    [InlineData(nameof(CareNoteAppService.UpdateAsync))]
    [InlineData(nameof(CareNoteAppService.DeleteAsync))]
    public void Changing_A_Note_Is_Checked_Inside(string method)
    {
        typeof(CareNoteAppService).GetMethod(method)!.GetCustomAttribute<AuthorizeAttribute>().ShouldBeNull();
        typeof(CareNoteAppService).GetCustomAttribute<AuthorizeAttribute>()!.Policy.ShouldBeNull();
    }
}
