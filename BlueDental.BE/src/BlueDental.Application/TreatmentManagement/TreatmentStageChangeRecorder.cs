using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Users;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Writes one change-log row for a công đoạn (BA 2026-11-02), in the same unit
/// of work as the change, so the two are committed or rolled back together.
/// Who and from where come from the current request.
/// </summary>
public class TreatmentStageChangeRecorder(
    IRepository<TreatmentStageChangeLog, Guid> repository,
    ICurrentUser currentUser,
    IHttpContextAccessor httpContextAccessor,
    IGuidGenerator guidGenerator) : ITransientDependency
{
    /// <summary>Logs a change of one text; nothing when it did not change.</summary>
    public async Task RecordAsync(
        TreatmentStage stage,
        TreatmentStageChangeAction action,
        string? before = null,
        string? after = null)
    {
        if (action is TreatmentStageChangeAction.NoteChanged or TreatmentStageChangeAction.RemarkChanged
            && string.Equals(before ?? "", after ?? "", StringComparison.Ordinal))
        {
            return;
        }

        var log = TreatmentStageChangeLog.Record(
            guidGenerator.Create(),
            stage,
            action,
            before,
            after,
            currentUser.Id,
            ActorName(),
            currentUser.UserName,
            ClientIp(),
            DateTime.UtcNow);

        await repository.InsertAsync(log);
    }

    /// <summary>The row as a full edit or a delete leaves it, for <see cref="RecordAsync"/>.</summary>
    public static string Snapshot(TreatmentStage stage) => JsonSerializer.Serialize(new
    {
        stage.Name,
        stage.Note,
        stage.Remark,
        stage.StaffId,
        stage.SecondStaffId,
        stage.SubStaffId,
        stage.ScheduledDate,
        stage.TreatmentDate,
        Status = stage.Status.ToString(),
        Teeth = stage.Teeth.Select(t => t.ToothCode).Order().ToList(),
    });

    private string? ActorName()
    {
        if (!currentUser.IsAuthenticated)
        {
            return null;
        }

        var fullName = string.Join(' ', new[] { currentUser.SurName, currentUser.Name }
            .Where(part => !string.IsNullOrWhiteSpace(part)));
        return string.IsNullOrWhiteSpace(fullName) ? currentUser.UserName : fullName;
    }

    /// <summary>The caller's address, through a reverse proxy when there is one.</summary>
    private string? ClientIp()
    {
        var http = httpContextAccessor.HttpContext;
        if (http is null) return null;
        var forwarded = http.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        var ip = !string.IsNullOrWhiteSpace(forwarded)
            ? forwarded.Split(',')[0].Trim()
            : http.Connection.RemoteIpAddress?.ToString();
        return ip is { Length: > 64 } ? ip[..64] : ip;
    }
}
