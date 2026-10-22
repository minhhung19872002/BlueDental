using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using BlueDental.PatientManagement;
using BlueDental.Tools;
using Volo.Abp.Application.Dtos;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>The templates "Mẫu tin nhắn" offers and what each channel card says.</summary>
public class MessageSendTemplatesDto
{
    /// <summary>Sẵn sàng, Chờ duyệt and Nháp of every channel, what can be sent first.</summary>
    public List<MessageTemplateDto> Items { get; set; } = [];

    public List<MessageSendChannelDto> Channels { get; set; } = [];
}

public class MessageSendChannelDto
{
    public MessageChannelType Channel { get; set; }

    /// <summary>False shows "Chưa kết nối gửi": only Zalo sends, once the branch's OA is linked.</summary>
    public bool Connected { get; set; }

    /// <summary>"N mẫu sẵn sàng".</summary>
    public int ReadyCount { get; set; }
}

public class GetMessageSendListsInput
{
    public DateTimeOffset? FromDate { get; set; }
    public DateTimeOffset? ToDate { get; set; }
}

/// <summary>One CSKH tab as a list chip: its customers over the period.</summary>
public class MessageSendListDto
{
    public CareType Type { get; set; }
    public int Count { get; set; }
}

/// <summary>Who a send would reach: a CSKH tab over a period, or customers picked one by one.</summary>
public class MessageRecipientsInput
{
    public MessageChannelType Channel { get; set; }

    /// <summary>Without a template the rows carry no "Đã nhận" and no missing variables.</summary>
    public Guid? TemplateId { get; set; }

    public MessageRecipientSource Source { get; set; }

    public CareType? CareType { get; set; }
    public DateTimeOffset? FromDate { get; set; }
    public DateTimeOffset? ToDate { get; set; }

    /// <summary>"Khách lẻ": the customers picked.</summary>
    [MaxLength(MessageSendLimits.MaxRecipients)]
    public List<Guid> PatientIds { get; set; } = [];

    /// <summary>
    /// A CSKH row's SMS / Zalo button: the row the one customer picked came
    /// from, so a Zalo sent this way marks it like a send of the whole list.
    /// Ignored unless it is that customer's row in the branch.
    /// </summary>
    public Guid? CareRecordId { get; set; }

    /// <summary>"Danh sách CSKH": the rows still on screen after "Xóa"; null keeps the whole list.</summary>
    [MaxLength(MessageSendLimits.MaxRecipients)]
    public List<string>? Keys { get; set; }

    /// <summary>"Bỏ qua khách đã nhận mẫu này trong 30 ngày".</summary>
    public bool SkipRecentDuplicates { get; set; } = true;
}

public class CreateMessageSendInput : MessageRecipientsInput
{
    /// <summary>"Hẹn giờ gửi"; null sends now.</summary>
    public DateTimeOffset? ScheduledAt { get; set; }
}

public class MessageRecipientListDto
{
    public List<MessageRecipientDto> Items { get; set; } = [];

    /// <summary>"Chi phí dự kiến": what Zalo charges per message, when it says.</summary>
    public decimal? PricePerMessage { get; set; }
}

public class MessageRecipientDto
{
    /// <summary>What "Xóa" sends back: <c>p:</c> + patient id, or <c>a:</c> + booking id for a "Lịch tạm" guest.</summary>
    public string Key { get; set; } = string.Empty;

    public Guid? PatientId { get; set; }
    public Guid? CareRecordId { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }

    [PatientPhone]
    public string? Phone { get; set; }

    public string? Email { get; set; }

    /// <summary>"Bác sĩ": the doctor on the CSKH row, or for a picked customer the next visit's.</summary>
    public string? DentistName { get; set; }

    /// <summary>
    /// "Đã nhận dd/MM": the last time this template reached them within 30
    /// days — or, with <see cref="ReceivedPending"/>, when a batch not sent
    /// yet will reach them ("Chờ gửi dd/MM").
    /// </summary>
    public DateTime? ReceivedAt { get; set; }

    public bool ReceivedPending { get; set; }

    /// <summary>Null when the customer will get the message.</summary>
    public MessageSkipReason? SkipReason { get; set; }

    /// <summary>The variables or ZNS parameters the customer has no value for.</summary>
    public List<string> Missing { get; set; } = [];
}

public class PreviewMessageSendInput
{
    [Required]
    public Guid TemplateId { get; set; }

    /// <summary>Whose data fills the preview; none shows the library's examples.</summary>
    public Guid? PatientId { get; set; }

    /// <summary>A "Lịch tạm" guest instead of a patient.</summary>
    public Guid? AppointmentId { get; set; }
}

public class FindMessageSendCustomersInput
{
    /// <summary>Name, code or phone; accents are ignored.</summary>
    [StringLength(200)]
    public string? Filter { get; set; }
}

public class MessageSendCustomerDto
{
    public Guid PatientId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;

    [PatientPhone]
    public string? Phone { get; set; }
}

public class SendTestMessageInput
{
    [Required]
    public Guid TemplateId { get; set; }

    /// <summary>The customer being previewed fills the variables; none uses the examples.</summary>
    public Guid? PatientId { get; set; }

    public Guid? AppointmentId { get; set; }
}

public class MessageTestSendDto
{
    /// <summary>The staff member's own number the test went to.</summary>
    public string Phone { get; set; } = string.Empty;
}

public class GetMessageSendBatchListInput
{
    public MessageSendBatchStatus? Status { get; set; }

    /// <summary>
    /// "Lịch gửi đã hẹn": only the sends booked for a time. A send made for
    /// now also waits as Queued until the job picks it up a few seconds later.
    /// </summary>
    public bool Scheduled { get; set; }
}

public class MessageSendBatchDto : EntityDto<Guid>
{
    public MessageChannelType Channel { get; set; }
    public Guid TemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
    public MessageRecipientSource Source { get; set; }
    public CareType? CareType { get; set; }
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public bool SkipRecentDuplicates { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public MessageSendBatchStatus Status { get; set; }
    public int RecipientCount { get; set; }
    public int SkippedCount { get; set; }
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
    public int PendingCount { get; set; }
    public DateTime CreationTime { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public static class MessageSendLimits
{
    /// <summary>The longest CSKH list a send takes in one go.</summary>
    public const int MaxRecipients = 5000;

    /// <summary>"Khách lẻ" search results.</summary>
    public const int MaxCustomerResults = 20;
}
