using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments.Values;
using BlueDental.Organizations;
using BlueDental.PatientManagement;
using BlueDental.Permissions;
using Microsoft.AspNetCore.Authorization;
using Volo.Abp;
using Volo.Abp.Domain.Entities;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;

namespace BlueDental.Appointments;

/// <summary>
/// "Lặp lại lịch hẹn" on the Tạo lịch hẹn dialog: lays the rule out as
/// sessions, books them all at once and shows how each one stands later.
/// The dates always come from the rule here, never from the client.
/// </summary>
[Authorize]
public class AppointmentSeriesAppService : BlueDentalAppService, IAppointmentSeriesAppService
{
    private readonly IRepository<Appointment, Guid> _appointmentRepository;
    private readonly IRepository<AppointmentSeries, Guid> _seriesRepository;
    private readonly IRepository<Patient, Guid> _patientRepository;
    private readonly IIdentityUserRepository _userRepository;
    private readonly AppointmentSeriesPlanner _planner;
    private readonly ICurrentClinicBranchResolver _branchResolver;
    private readonly AppointmentChangeRecorder _changeRecorder;

    public AppointmentSeriesAppService(
        IRepository<Appointment, Guid> appointmentRepository,
        IRepository<AppointmentSeries, Guid> seriesRepository,
        IRepository<Patient, Guid> patientRepository,
        IIdentityUserRepository userRepository,
        AppointmentSeriesPlanner planner,
        ICurrentClinicBranchResolver branchResolver,
        AppointmentChangeRecorder changeRecorder)
    {
        _appointmentRepository = appointmentRepository;
        _seriesRepository = seriesRepository;
        _patientRepository = patientRepository;
        _userRepository = userRepository;
        _planner = planner;
        _branchResolver = branchResolver;
        _changeRecorder = changeRecorder;
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Create)]
    public async Task<AppointmentSeriesDto> PreviewAsync(PreviewAppointmentSeriesInput input)
    {
        if (input.SlotEnd <= input.SlotStart)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.InvalidRecurrence);
        }

        var sessions = await _planner.PlanAsync(
            _branchResolver.GetRequiredClinicBranchId(),
            input.PatientId,
            input.DentistId,
            input.SlotStart,
            input.SlotEnd,
            ToRule(input.Recurrence));

        return new AppointmentSeriesDto
        {
            Recurrence = input.Recurrence,
            Sessions = sessions.Select(s => new AppointmentSeriesSessionDto
            {
                Index = s.Index,
                Start = s.Start,
                End = s.End,
                State = s.Conflict is null ? SeriesOccurrenceState.Free : SeriesOccurrenceState.Conflict,
                ConflictReason = s.Conflict,
            }).ToList(),
        };
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Create)]
    public async Task<AppointmentSeriesDto> CreateAsync(CreateAppointmentSeriesDto input)
    {
        var branchId = _branchResolver.GetRequiredClinicBranchId();
        var rule = ToRule(input.Recurrence);
        // Refuses a first slot in the past or longer than a day's 8 hours.
        _ = new AppointmentSlot(input.SlotStart, input.SlotEnd);

        var sessions = await _planner.PlanAsync(
            branchId, input.PatientId, input.DentistId, input.SlotStart, input.SlotEnd, rule);
        var clashes = sessions.Where(s => s.Conflict is not null).ToList();
        if (clashes.Count > 0)
        {
            // BA: one clash and nothing is booked — no case-by-case resolution.
            throw new BusinessException(BlueDentalDomainErrorCodes.Appointments.SeriesConflict)
                .WithData("Dates", string.Join(", ", clashes.Select(s => $"{ClinicCalendar.DateOf(s.Start):dd/MM/yyyy}")));
        }

        var series = new AppointmentSeries(GuidGenerator.Create(), branchId, input.PatientId, input.DentistId, rule);
        await _seriesRepository.InsertAsync(series);

        var appointments = sessions.Select(s => new Appointment(
                GuidGenerator.Create(),
                input.PatientId,
                input.DentistId,
                branchId,
                new AppointmentSlot(s.Start, s.End),
                input.Type,
                input.ProcedureId,
                input.ChiefComplaint,
                input.Color,
                input.Notes)
            .JoinSeries(series.Id))
            .ToList();
        await _appointmentRepository.InsertManyAsync(appointments, autoSave: true);

        var (patientName, patientPhone) = await PatientOfAsync(input.PatientId);
        var dentistName = await DentistNameAsync(input.DentistId);
        foreach (var appointment in appointments)
        {
            await _changeRecorder.RecordAsync(
                AppointmentChangeAction.Created,
                appointment,
                null,
                AppointmentSnapshot.From(appointment, dentistName, patientName, patientPhone));
        }

        return ToDto(series, appointments);
    }

    [Authorize(BlueDentalAbilityPermissions.Appointment.Read)]
    public async Task<AppointmentSeriesDto> GetByAppointmentAsync(Guid appointmentId)
    {
        var appointment = await _appointmentRepository.GetAsync(appointmentId);
        if (appointment.BranchId != _branchResolver.GetRequiredClinicBranchId() || appointment.SeriesId is null)
        {
            throw new EntityNotFoundException(typeof(AppointmentSeries), appointmentId);
        }

        var series = await _seriesRepository.GetAsync(appointment.SeriesId.Value);
        var sessions = await _appointmentRepository.GetListAsync(a => a.SeriesId == series.Id);
        return ToDto(series, sessions);
    }

    private static AppointmentSeriesDto ToDto(AppointmentSeries series, IEnumerable<Appointment> sessions) => new()
    {
        Id = series.Id,
        Recurrence = new AppointmentRecurrenceDto
        {
            Frequency = series.Frequency,
            Interval = series.Interval,
            WeekDays = series.Rule.WeekDays.ToList(),
            End = series.End,
            Count = series.Count,
            Until = series.Until,
        },
        Sessions = sessions
            .OrderBy(a => a.Slot.Start)
            .Select((a, i) => new AppointmentSeriesSessionDto
            {
                Index = i + 1,
                Start = a.Slot.Start,
                End = a.Slot.End,
                State = a.SeriesState(),
                AppointmentId = a.Id,
            })
            .ToList(),
    };

    private static AppointmentRecurrence ToRule(AppointmentRecurrenceDto dto) =>
        new(dto.Frequency, dto.Interval, dto.WeekDays, dto.End, dto.Count, dto.Until);

    private async Task<(string? Name, string? Phone)> PatientOfAsync(Guid patientId)
    {
        var patient = await _patientRepository.FindAsync(patientId);
        return patient is null
            ? (null, null)
            : ((patient.LastName + " " + patient.FirstName).Trim(), patient.Contact.PhoneNumber);
    }

    private async Task<string?> DentistNameAsync(Guid dentistId)
    {
        var dentist = await _userRepository.FindAsync(dentistId);
        return dentist?.Name ?? dentist?.UserName;
    }
}
