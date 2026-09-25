using System;
using System.Linq;
using BlueDental.Catalogs;
using Xunit;

namespace BlueDental.ClinicIntegration;

public class ServiceCatalogSyncReportTests
{
    private static PartnerServiceItem Item(string code, decimal price = 100_000m) =>
        ServiceCatalogPayload.From(
            CatalogEntry.Create(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), TaxonomyGroups.CareService,
                "Dịch vụ " + code, code, price),
            "Nhóm");

    private static PartnerServiceResult Answer(PartnerServiceItem item, PartnerServiceStatus status,
        string? reason = null, string? systemName = null, bool relinked = false) =>
        new(item.ExternalId, status, "sys-" + item.Code, systemName, reason, relinked);

    [Fact]
    public void Every_Accepted_Service_Counts_As_Sent_Updates_And_Warnings_Included()
    {
        var report = new ServiceCatalogSyncReport();
        var created = Item("A0001");
        var updated = Item("A0002");
        var warned = Item("A0003");

        Assert.True(report.Record(created, Answer(created, PartnerServiceStatus.Created), "none"));
        Assert.True(report.Record(updated, Answer(updated, PartnerServiceStatus.Updated, relinked: true), "none"));
        Assert.True(report.Record(warned, Answer(warned, PartnerServiceStatus.Warned, reason: "Thiếu đơn vị"), "none"));

        Assert.Equal(3, report.Total);
        Assert.Equal(3, report.Sent);
        Assert.Equal(1, report.Updated);
        Assert.True(report.UpdatedItems.Single().Relinked);
        Assert.Equal("Thiếu đơn vị", report.Warned.Single().Reason);
        Assert.Equal(0, report.Failed);
    }

    [Fact]
    public void A_Duplicate_Is_Neither_Sent_Nor_Failed_And_Names_The_Partner_Record()
    {
        var report = new ServiceCatalogSyncReport();
        var item = Item("DUP01");

        Assert.False(report.Record(item, Answer(item, PartnerServiceStatus.Duplicated, systemName: "Cạo vôi"), "none"));

        var duplicate = report.Duplicated.Single();
        Assert.Equal("DUP01", duplicate.Code);
        Assert.Equal(item.Name, duplicate.DentalName);
        Assert.Equal("Cạo vôi", duplicate.SystemName);
        Assert.Equal(0, report.Sent);
        Assert.Equal(0, report.Failed);
        Assert.Equal(1, report.Total);
    }

    [Fact]
    public void A_Refusal_Or_A_Missing_Answer_Fails_That_Service_With_A_Listed_Error()
    {
        var report = new ServiceCatalogSyncReport();
        var refused = Item("F0001");
        var unanswered = Item("F0002");

        report.Record(refused, Answer(refused, PartnerServiceStatus.Failed, reason: "Giá âm"), "none");
        report.Record(unanswered, null, "Không có kết quả");

        Assert.Equal(2, report.Failed);
        Assert.Equal(["F0001", "F0002"], report.BatchErrors.Select(e => e.Reason));
        Assert.Equal(["Giá âm", "Không có kết quả"], report.BatchErrors.Select(e => e.Message));
    }

    [Fact]
    public void A_Batch_That_Never_Answered_Fails_Every_Service_In_It_Once()
    {
        var report = new ServiceCatalogSyncReport();

        report.FailBatch([Item("B0001"), Item("B0002"), Item("B0003")], "Lô 1/1", "timeout");

        Assert.Equal(3, report.Total);
        Assert.Equal(3, report.Failed);
        Assert.Single(report.BatchErrors);
    }

    [Fact]
    public void Unchanged_Skips_Carry_No_Reason_But_Codeless_Ones_Do()
    {
        var report = new ServiceCatalogSyncReport();

        report.SkipUnchanged(Guid.NewGuid(), "S0001");
        report.SkipWithReason(Guid.NewGuid(), null, "Chưa có mã");

        Assert.Equal(2, report.Skipped);
        Assert.Null(report.SkippedItems[0].Reason);
        Assert.Equal("Chưa có mã", report.SkippedItems[1].Reason);
    }

    [Fact]
    public void The_Buckets_Always_Add_Up_To_The_Total()
    {
        var report = new ServiceCatalogSyncReport();
        var sent = Item("T0001");
        var duplicate = Item("T0002");
        report.Record(sent, Answer(sent, PartnerServiceStatus.Created), "none");
        report.Record(duplicate, Answer(duplicate, PartnerServiceStatus.Duplicated), "none");
        report.SkipUnchanged(Guid.NewGuid(), "T0003");
        report.FailBatch([Item("T0004")], "Lô 2/2", null);

        Assert.Equal(report.Total, report.Sent + report.Failed + report.Skipped + report.Duplicated.Count);
    }

    [Fact]
    public void Index_Keeps_The_Last_Answer_For_A_Repeated_Id()
    {
        var item = Item("I0001");
        var index = ServiceCatalogSyncReport.Index(
        [
            Answer(item, PartnerServiceStatus.Failed),
            Answer(item, PartnerServiceStatus.Created)
        ]);

        Assert.Equal(PartnerServiceStatus.Created, index[item.ExternalId].Status);
    }
}
