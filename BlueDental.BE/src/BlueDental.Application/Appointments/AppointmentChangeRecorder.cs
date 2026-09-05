using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Guids;
using Volo.Abp.Users;

namespace BlueDental.Appointments;

/// <summary>
/// Writes one history row for a change to an appointment, in the same unit
/// of work as the change itself, so the two are committed or rolled back
/// together. Who and from where come from the current request; the change
/// itself is the pair of snapshots the caller hands over.
/// </summary>
public class AppointmentChangeRecorder(
    IRepository<AppointmentChangeLog, Guid> repository,
    ICurrentUser currentUser,
    IHttpContextAccessor httpContextAccessor,
    IGuidGenerator guidGenerator) : ITransientDependency
{
    public async Task<AppointmentChangeLog> RecordAsync(
        AppointmentChangeAction action,
        Appointment appointment,
        AppointmentSnapshot? before,
        AppointmentSnapshot? after)
    {
        var log = AppointmentChangeLog.Record(
            guidGenerator.Create(),
            action,
            appointment.Id,
            appointment.PatientId == Guid.Empty ? null : appointment.PatientId,
            appointment.BranchId,
            before,
            after,
            CurrentActor(),
            CurrentClient(),
            DateTime.UtcNow);

        await repository.InsertAsync(log, autoSave: true);
        return log;
    }

    private AppointmentChangeActor CurrentActor()
    {
        if (!currentUser.IsAuthenticated)
        {
            return new AppointmentChangeActor(null, null, null, null);
        }

        var fullName = string.Join(' ', new[] { currentUser.SurName, currentUser.Name }
            .Where(part => !string.IsNullOrWhiteSpace(part)));

        return new AppointmentChangeActor(
            currentUser.Id,
            string.IsNullOrWhiteSpace(fullName) ? currentUser.UserName : fullName,
            currentUser.UserName,
            currentUser.Roles.FirstOrDefault());
    }

    private AppointmentChangeClient CurrentClient()
    {
        var http = httpContextAccessor.HttpContext;
        var userAgent = http?.Request.Headers.UserAgent.ToString();
        var summary = UserAgentSummary.Parse(userAgent);
        var hasRequest = http is not null;

        var source = !hasRequest
            ? AppointmentChangeSource.System
            : summary.IsMobile
                ? AppointmentChangeSource.Mobile
                : AppointmentChangeSource.Web;

        return new AppointmentChangeClient(
            source,
            Truncate(ClientIp(http), 64),
            Truncate(summary.Browser, 100),
            Truncate(summary.OperatingSystem, 100),
            Truncate(userAgent, 512));
    }

    /// <summary>The caller's address, through a reverse proxy when there is one.</summary>
    private static string? ClientIp(HttpContext? http)
    {
        if (http is null) return null;
        var forwarded = http.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(forwarded))
        {
            return forwarded.Split(',')[0].Trim();
        }

        return http.Connection.RemoteIpAddress?.ToString();
    }

    private static string? Truncate(string? value, int max) =>
        value is null || value.Length <= max ? value : value[..max];
}
