using System;
using Volo.Abp;
using Xunit;

namespace BlueDental.EInvoicing;

/// <summary>
/// P1811 (BA 2026-11-18): a request is Mới until Xử lý sends it, Chờ xử lý
/// while the accountant signs it on EasyInvoice's portal, then follows the
/// e-invoice — Đã xuất HĐ with its number, or Đã hủy if it is cancelled there,
/// from where Xử lý lại sends it again or Hủy yêu cầu closes it for good.
/// </summary>
public class InvoiceRequestProviderTests
{
    private static readonly DateTimeOffset At = new(2026, 11, 18, 9, 0, 0, TimeSpan.FromHours(7));

    private static InvoiceRequest Request() => InvoiceRequest.Create(
        Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), null, "YC0001",
        InvoiceRequestSource.Staff,
        new InvoiceRequestDetails(false, "Nguyễn Văn Test", 1990, null, "001090000000", "1 Đường Thử, Hà Nội", null, null, null, null, null),
        "Trám răng", 500_000m, At);

    private static InvoiceRequest Processing()
    {
        var request = Request();
        request.Process(Guid.NewGuid(), At);
        return request;
    }

    [Fact]
    public void A_New_Request_Is_Moi_And_Needs_Action()
    {
        var request = Request();

        Assert.Equal(InvoiceRequestStatus.Pending, request.Status);
        Assert.True(request.NeedsAction);
    }

    [Fact]
    public void Xu_Ly_Records_Who_And_When_And_Waits_On_The_Portal()
    {
        var request = Request();
        var accountant = Guid.NewGuid();

        request.Process(accountant, At.AddHours(2));

        Assert.Equal(InvoiceRequestStatus.Processing, request.Status);
        Assert.Equal(accountant, request.AssigneeId);
        Assert.Equal(At.AddHours(2), request.ProcessedAt);
        Assert.False(request.NeedsAction);
        Assert.Throws<BusinessException>(() => request.Process(accountant, At));
    }

    [Fact]
    public void Signed_On_The_Portal_Completes_The_Request_With_Its_Number()
    {
        var request = Processing();

        Assert.True(request.CompleteFromProvider(" 17 ", At.AddHours(1)));

        Assert.Equal(InvoiceRequestStatus.Issued, request.Status);
        Assert.Equal("17", request.InvoiceNo);
        Assert.Equal(At.AddHours(1), request.CompletedAt);
    }

    [Fact]
    public void A_Withdrawn_Request_Or_A_Missing_Number_Is_Left_Alone()
    {
        var withdrawn = Request();
        withdrawn.Withdraw("Khách không cần");
        Assert.False(withdrawn.CompleteFromProvider("17", At));
        Assert.Equal(InvoiceRequestStatus.Withdrawn, withdrawn.Status);

        var open = Processing();
        Assert.False(open.CompleteFromProvider(" ", At));
        Assert.Equal(InvoiceRequestStatus.Processing, open.Status);
    }

    [Fact]
    public void Cancelled_On_The_Portal_Is_Da_Huy_With_Why_And_Can_Be_Sent_Again()
    {
        var request = Processing();
        request.CompleteFromProvider("17", At);

        Assert.True(request.CancelFromProvider("Hóa đơn 17 đã bị hủy trên EasyInvoice"));

        Assert.Equal(InvoiceRequestStatus.Cancelled, request.Status);
        Assert.Null(request.InvoiceNo);
        Assert.Null(request.CompletedAt);
        Assert.Equal("Hóa đơn 17 đã bị hủy trên EasyInvoice", request.Reason);
        Assert.True(request.NeedsAction);

        request.Process(Guid.NewGuid(), At.AddDays(1));
        Assert.True(request.CompleteFromProvider("18", At.AddDays(1)));
        Assert.Equal("18", request.InvoiceNo);
    }

    [Fact]
    public void Only_A_Sent_Request_Is_Cancelled_From_The_Portal()
    {
        var request = Request();

        Assert.False(request.CancelFromProvider("x"));
        Assert.Equal(InvoiceRequestStatus.Pending, request.Status);
    }

    [Fact]
    public void Huy_Yeu_Cau_Only_While_It_Needs_Action()
    {
        Assert.Throws<BusinessException>(() => Processing().Withdraw("x"));

        var cancelled = Processing();
        cancelled.CancelFromProvider("Hủy trên EasyInvoice");
        cancelled.Withdraw("Khách không lấy hóa đơn nữa");

        Assert.Equal(InvoiceRequestStatus.Withdrawn, cancelled.Status);
        Assert.Equal("Khách không lấy hóa đơn nữa", cancelled.Reason);
    }

    [Fact]
    public void Cancelling_The_Receipt_Closes_Any_Request_But_An_Issued_One()
    {
        var sent = Processing();
        Assert.True(sent.WithdrawWithReceipt("Hủy phiếu thu"));
        Assert.Equal(InvoiceRequestStatus.Withdrawn, sent.Status);

        var issued = Processing();
        issued.CompleteFromProvider("17", At);
        Assert.False(issued.WithdrawWithReceipt("Hủy phiếu thu"));
        Assert.Equal(InvoiceRequestStatus.Issued, issued.Status);
    }

    [Fact]
    public void A_Request_Needs_No_Phone_But_An_Address_Of_Either_Kind()
    {
        var personal = new InvoiceRequestDetails(false, "A", null, null, "001090000000", "Hà Nội", null, null, null, null, null);
        Assert.Null(personal.Validated().Phone);

        // The CCCD is its Mã số thuế, and EasyInvoice wants an address with one.
        var homeless = Assert.Throws<BusinessException>(() => (personal with { PersonalAddress = "  " }).Validated());
        Assert.Equal(BlueDentalDomainErrorCodes.InvoiceRequest.AddressRequired, homeless.Code);

        var company = new InvoiceRequestDetails(true, "A", null, null, null, null, "Công ty A", "0100109106", null, null, null);
        var error = Assert.Throws<BusinessException>(() => company.Validated());
        Assert.Equal(BlueDentalDomainErrorCodes.InvoiceRequest.AddressRequired, error.Code);

        Assert.Null((company with { CompanyAddress = "Hà Nội" }).Validated().Email);
    }
}
