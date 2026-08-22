using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.Tools;

public class MessageTemplate : FullAuditedEntity<Guid>
{
    public string Name { get; private set; } = string.Empty;
    public string Content { get; private set; } = string.Empty;
    public MessageChannelType Channel { get; private set; }
    public string? Category { get; private set; }
    public bool IsActive { get; private set; }

    private MessageTemplate() { }

    public MessageTemplate(
        Guid id, string name, string content,
        MessageChannelType channel, string? category)
        : base(id)
    {
        Name = name;
        Content = content;
        Channel = channel;
        Category = category;
        IsActive = true;
    }

    public void Update(string name, string content, string? category)
    {
        Name = name;
        Content = content;
        Category = category;
    }

    public void SetActive(bool active) => IsActive = active;
}

public enum MessageChannelType
{
    Sms = 0,
    Zalo = 1,
}
