using System;
using Volo.Abp.Domain.Entities.Auditing;

namespace BlueDental.ClinicIntegration;

/// <summary>
/// One request BlueDental made to the partner system. Only the shape of the
/// call is kept — never bodies or headers, which carry the API key.
/// </summary>
public class IntegrationCallLog : CreationAuditedEntity<Guid>
{
    public const int MaxOperationLength = 50;
    public const int MaxPathLength = 500;
    public const int MaxErrorLength = 1000;

    public Guid ClinicBranchId { get; private set; }

    /// <summary><c>handshake</c> or <c>service-catalog</c>.</summary>
    public string Operation { get; private set; } = string.Empty;

    public string RequestPath { get; private set; } = string.Empty;

    /// <summary>Null when no response came back at all.</summary>
    public int? StatusCode { get; private set; }

    public bool Succeeded { get; private set; }

    public long DurationMs { get; private set; }

    public int ItemCount { get; private set; }

    public string? Error { get; private set; }

    protected IntegrationCallLog() { }

    public IntegrationCallLog(
        Guid id,
        Guid clinicBranchId,
        string operation,
        string requestPath,
        int? statusCode,
        bool succeeded,
        long durationMs,
        int itemCount,
        string? error)
        : base(id)
    {
        ClinicBranchId = clinicBranchId;
        Operation = Clip(operation, MaxOperationLength)!;
        RequestPath = Clip(requestPath, MaxPathLength)!;
        StatusCode = statusCode;
        Succeeded = succeeded;
        DurationMs = durationMs;
        ItemCount = itemCount;
        Error = Clip(error, MaxErrorLength);
    }

    private static string? Clip(string? value, int max) =>
        value == null || value.Length <= max ? value : value[..max];
}
