using System;
using Xunit;

namespace BlueDental.EInvoicing;

/// <summary>
/// BA 2026-11-18: the YC-HD follows the e-invoice — Đã xuất HĐ with its number
/// once the accountant signs it on the portal, open again if it is cancelled there.
/// </summary>
public class InvoiceRequestProviderTests
{
    private static readonly DateTimeOffset At = new(2026, 11, 18, 9, 0, 0, TimeSpan.FromHours(7));

    private static InvoiceRequest Request() => InvoiceRequest.Create(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, "YC0001",
        InvoiceRequestSource.Staff,
        new InvoiceRequestDetails(false, "Nguyễn Văn Test", 1990, "0900000000", "001090000000", null, null, null, null, null, null),
        "Trám răng", 500_000m, At);

    [Fact]
    public void Signed_On_The_Portal_Completes_An_Open_Request_With_Its_Number()
    {
        var request = Request();

        Assert.True(request.CompleteFromProvider(" 17 ", At.AddHours(1)));

        Assert.Equal(InvoiceRequestStatus.Issued, request.Status);
        Assert.Equal("17", request.InvoiceNo);
        Assert.Equal(At.AddHours(1), request.CompletedAt);
    }

    [Fact]
    public void A_Closed_Request_Or_A_Missing_Number_Is_Left_Alone()
    {
        var cancelled = Request();
        cancelled.Cancel("Khách không cần");
        Assert.False(cancelled.CompleteFromProvider("17", At));
        Assert.Equal(InvoiceRequestStatus.Cancelled, cancelled.Status);

        var open = Request();
        Assert.False(open.CompleteFromProvider(" ", At));
        Assert.Equal(InvoiceRequestStatus.Pending, open.Status);
    }

    [Fact]
    public void Cancelled_On_The_Portal_Reopens_The_Request_With_Why()
    {
        var request = Request();
        request.CompleteFromProvider("17", At);

        Assert.True(request.ReopenAfterProviderCancel("Hóa đơn 17 đã bị hủy trên EasyInvoice"));

        Assert.Equal(InvoiceRequestStatus.Processing, request.Status);
        Assert.Null(request.InvoiceNo);
        Assert.Null(request.CompletedAt);
        Assert.Equal("Hóa đơn 17 đã bị hủy trên EasyInvoice", request.Reason);
        Assert.True(request.CompleteFromProvider("18", At.AddDays(1)));
        Assert.Equal("18", request.InvoiceNo);
    }

    [Fact]
    public void Only_An_Issued_Request_Reopens()
    {
        var request = Request();

        Assert.False(request.ReopenAfterProviderCancel("x"));
        Assert.Equal(InvoiceRequestStatus.Pending, request.Status);
    }
}
