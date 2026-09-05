using System;
using System.Collections.Generic;

namespace BlueDental.Appointments;

/// <summary>
/// A flat copy of an appointment as it looked at one moment. Two of these,
/// one taken before and one after a change, are all the history needs to say
/// what happened. Names are carried alongside the ids so the history still
/// reads well after a doctor or patient is renamed.
/// </summary>
public sealed record AppointmentSnapshot(
    Guid Id,
    DateTimeOffset StartTime,
    DateTimeOffset ToTime,
    int Duration,
    AppointmentStatus Status,
    string? Note,
    string? Content,
    string? Color,
    Guid? StaffId,
    string? StaffName,
    Guid BranchId,
    Guid? PatientId,
    string? PatientName,
    string? PatientPhone,
    CancellationReason? CancelReason,
    string? CancelNote,
    bool IsTemporary)
{
    public static AppointmentSnapshot From(
        Appointment appointment,
        string? staffName,
        string? patientName,
        string? patientPhone)
    {
        var start = appointment.Slot.Start;
        var end = appointment.Slot.End;

        return new AppointmentSnapshot(
            appointment.Id,
            start,
            end,
            (int)Math.Round((end - start).TotalMinutes),
            appointment.Status,
            appointment.Notes,
            appointment.ChiefComplaint,
            appointment.Color,
            appointment.DentistId == Guid.Empty ? null : appointment.DentistId,
            staffName,
            appointment.BranchId,
            appointment.PatientId == Guid.Empty ? null : appointment.PatientId,
            patientName ?? appointment.PatientName,
            patientPhone ?? appointment.PatientPhone,
            appointment.CancellationReason,
            appointment.CancellationNote,
            appointment.IsTemporary);
    }

    /// <summary>
    /// The fields the history compares, in display order, with their value
    /// rendered as text. Ids are shown through their names when a name exists.
    /// </summary>
    public IReadOnlyList<KeyValuePair<string, string?>> Fields() =>
    [
        new("id", Id.ToString()),
        new("startTime", StartTime.ToString("O")),
        new("toTime", ToTime.ToString("O")),
        new("duration", Duration.ToString()),
        new("status", Status.ToString()),
        new("content", Content),
        new("note", Note),
        new("color", Color),
        new("staffId", StaffName ?? StaffId?.ToString()),
        new("patientName", PatientName),
        new("patientPhone", PatientPhone),
        new("cancelReason", CancelReason?.ToString()),
        new("cancelNote", CancelNote),
    ];
}
