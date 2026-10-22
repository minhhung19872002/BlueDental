using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.Appointments;
using BlueDental.PatientManagement;
using BlueDental.Tools;
using BlueDental.Zalo;
using Volo.Abp;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Identity;
using Volo.Abp.Linq;
using Volo.Abp.Timing;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// Who a send covers and what each of them would get (BA P2110, F-77): the
/// "Gửi tới" table, the batch "Gửi" books, and the job that sends it later
/// all read customers and fill the template through here, so the table shows
/// exactly who goes and who is left out, and why.
///
/// A customer is a patient record, or a "Lịch tạm" booking made for someone
/// with no record yet; a CSKH list holds each once however many rows it has.
/// </summary>
public class MessageRecipientBuilder(
    IRepository<CareRecord, Guid> careRecords,
    IRepository<Patient, Guid> patients,
    IRepository<Appointment, Guid> appointments,
    IIdentityUserRepository users,
    CareRecordWindow window,
    MessageVariableResolver variables,
    MessageTemplateUsageReader usage,
    IAsyncQueryableExecuter executer,
    IClock clock) : ITransientDependency
{
    private const string PatientKey = "p:";
    private const string GuestKey = "a:";

    private static readonly StringComparer ByName = StringComparer.Create(new CultureInfo("vi-VN"), ignoreCase: true);

    private static readonly IReadOnlyDictionary<string, string?> NoKnownValues = new Dictionary<string, string?>();

    /// <summary>
    /// The customers of the list or the pick, without those "Xóa" took off.
    /// Without a template the rows only say who has no way to be reached.
    /// <paramref name="znsParams"/> are the linked ZNS template's parameters,
    /// when Zalo could be asked: a required one left empty leaves the customer out.
    /// </summary>
    public async Task<IReadOnlyList<MessageRecipient>> BuildAsync(
        Guid branchId,
        MessageRecipientsInput input,
        MessageTemplate? template,
        IReadOnlyList<ZaloTemplateParam>? znsParams)
    {
        var people = input.Source == MessageRecipientSource.CareList
            ? await ReadCareListAsync(branchId, input)
            : await ReadPickedAsync(branchId, input.PatientIds, input.CareRecordId);
        if (input.Keys != null)
        {
            var kept = input.Keys.ToHashSet(StringComparer.Ordinal);
            people = [.. people.Where(p => kept.Contains(p.Key))];
        }

        var values = await ResolveAsync(branchId, people);
        var received = template == null
            ? []
            : await usage.LoadRecipientsAsync(
                branchId, template.Id,
                [.. people.Where(p => p.Patient != null).Select(p => p.Patient!.Id)],
                clock.Now - MessageTemplateUsageReader.RecentWindow);

        var channel = template?.Channel ?? input.Channel;
        return [.. people
            .Select(p => Describe(p, values[p.Key], channel, template, znsParams, input.SkipRecentDuplicates,
                p.Patient is { } patient ? received.GetValueOrDefault(patient.Id) : null))
            .OrderBy(r => r.Name, ByName)];
    }

    /// <summary>
    /// The values each message of a batch is filled with at send time, so a
    /// booking moved since "Hẹn gửi" goes out with its new time. Keyed by log.
    /// </summary>
    public async Task<IReadOnlyDictionary<Guid, IReadOnlyDictionary<string, string?>>> ResolveForLogsAsync(
        Guid branchId, IReadOnlyCollection<MessageLog> logs)
    {
        var recordIds = logs.Where(l => l.CareRecordId.HasValue).Select(l => l.CareRecordId!.Value).ToHashSet();
        var records = recordIds.Count == 0
            ? []
            : (await careRecords.GetListAsync(r => recordIds.Contains(r.Id))).ToDictionary(r => r.Id);
        var patientIds = logs.Where(l => l.PatientId.HasValue).Select(l => l.PatientId!.Value).ToHashSet();
        var found = patientIds.Count == 0
            ? []
            : (await patients.GetListAsync(p => patientIds.Contains(p.Id) && p.BranchId == branchId)).ToDictionary(p => p.Id);
        var bookingIds = records.Values.Where(r => r.AppointmentId.HasValue).Select(r => r.AppointmentId!.Value).ToHashSet();
        var bookings = bookingIds.Count == 0
            ? []
            : (await appointments.GetListAsync(a => bookingIds.Contains(a.Id) && a.BranchId == branchId)).ToDictionary(a => a.Id);

        var people = new Dictionary<Guid, Person>();
        foreach (var log in logs)
        {
            var record = log.CareRecordId is { } recordId ? records.GetValueOrDefault(recordId) : null;
            var booking = record?.AppointmentId is { } bookingId ? bookings.GetValueOrDefault(bookingId) : null;
            if (log.PatientId is { } patientId && found.TryGetValue(patientId, out var patient))
            {
                people[log.Id] = Person.Of(patient, record, booking?.Id);
            }
            else if (log.PatientId == null && booking != null)
            {
                people[log.Id] = Person.Guest(booking, record);
            }
        }

        var values = await ResolveAsync(branchId, people.Values.DistinctBy(p => p.Key).ToList());
        return people.ToDictionary(p => p.Key, p => values[p.Value.Key]);
    }

    /// <summary>
    /// The message for one customer and what stops it: a variable with no
    /// value, or a required ZNS parameter left empty. <see cref="MessageCheck.ZnsValues"/>
    /// are what Zalo is sent, clipped to each parameter's length. A parameter
    /// is named only when no variable explains the gap — {ngay_hen} missing
    /// already says why booking_date is empty.
    /// </summary>
    public static MessageCheck Check(
        MessageTemplate template, IReadOnlyList<ZaloTemplateParam>? znsParams, IReadOnlyDictionary<string, string?> values)
    {
        var message = MessageComposer.Compose(template, values);
        var missing = message.Missing.ToList();
        IReadOnlyDictionary<string, string>? zns = null;
        if (template.Channel == MessageChannelType.Zalo && znsParams != null)
        {
            var data = ZaloTemplateDataBuilder.Build(znsParams, NoKnownValues, message.ParamValues);
            if (missing.Count == 0)
            {
                missing.AddRange(data.MissingRequired);
            }

            zns = data.Values;
        }

        return new MessageCheck(message, missing, zns);
    }

    /// <summary>The number a Zalo / SMS message goes to, or null when there is none Zalo would take.</summary>
    public static string? NormalizePhone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        try
        {
            return ZaloPhoneNumber.Normalize(raw);
        }
        catch (BusinessException)
        {
            return null;
        }
    }

    private static MessageRecipient Describe(
        Person person,
        IReadOnlyDictionary<string, string?> values,
        MessageChannelType channel,
        MessageTemplate? template,
        IReadOnlyList<ZaloTemplateParam>? znsParams,
        bool skipRecent,
        MessageReceipt? received)
    {
        var phone = values.GetValueOrDefault(MessageVariables.Phone);
        var email = values.GetValueOrDefault(MessageVariables.Email);
        var check = template == null ? null : Check(template, znsParams, values);
        var reachable = channel == MessageChannelType.Email
            ? !string.IsNullOrWhiteSpace(email)
            : NormalizePhone(phone) != null;

        MessageSkipReason? skip = !reachable ? MessageSkipReason.NoContact
            : skipRecent && received != null ? MessageSkipReason.RecentlySent
            : check?.Missing.Count > 0 ? MessageSkipReason.MissingVariable
            : null;

        return new MessageRecipient(
            person.Key,
            person.Patient?.Id,
            person.Record?.Id,
            person.Name,
            person.Patient?.PatientCode,
            phone,
            email,
            person.DentistName ?? MessageVariableResolver.DentistNameOf(values),
            received,
            skip,
            check?.Missing ?? [],
            check);
    }

    private async Task<List<Person>> ReadCareListAsync(Guid branchId, MessageRecipientsInput input)
    {
        if (input.CareType is not { } type || !CareBoard.IsTab(type))
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendListRequired);
        }

        var query = (await careRecords.GetQueryableAsync()).Where(r => r.BranchId == branchId && r.Type == type);
        var windowed = await window.ApplyAsync(query, type, [branchId], input.FromDate, input.ToDate);
        var records = await executer.ToListAsync(windowed.Records.OrderBy(r => r.CreationTime).ThenBy(r => r.Id));

        var bookingIds = records
            .Where(r => r.PatientId == Guid.Empty && r.AppointmentId.HasValue)
            .Select(r => r.AppointmentId!.Value)
            .ToHashSet();
        var bookings = bookingIds.Count == 0
            ? []
            : (await appointments.GetListAsync(a => bookingIds.Contains(a.Id) && a.BranchId == branchId)).ToDictionary(a => a.Id);
        var patientIds = records.Select(r => r.PatientId)
            .Concat(bookings.Values.Select(a => a.PatientId))
            .Where(id => id != Guid.Empty)
            .ToHashSet();
        var found = patientIds.Count == 0
            ? []
            : (await patients.GetListAsync(p => patientIds.Contains(p.Id) && p.BranchId == branchId)).ToDictionary(p => p.Id);
        var staff = await StaffNamesAsync(records.Select(r => r.AssignedStaffId));

        var people = new Dictionary<string, Person>(StringComparer.Ordinal);
        foreach (var record in records)
        {
            var person = ToPerson(record, found, bookings, staff);
            if (person != null)
            {
                people.TryAdd(person.Key, person);
            }
        }

        if (people.Count > MessageSendLimits.MaxRecipients)
        {
            throw new BusinessException(BlueDentalDomainErrorCodes.Tools.SendTooManyRecipients)
                .WithData("max", MessageSendLimits.MaxRecipients);
        }

        return [.. people.Values];
    }

    /// <summary>
    /// A row of a patient, or of a "Lịch tạm" guest — who becomes that patient
    /// once the booking is tied to a record. A row whose customer is gone is skipped.
    /// </summary>
    private static Person? ToPerson(
        CareRecord record,
        Dictionary<Guid, Patient> found,
        Dictionary<Guid, Appointment> bookings,
        IReadOnlyDictionary<Guid, string> staff)
    {
        var dentist = record.AssignedStaffId is { } staffId ? staff.GetValueOrDefault(staffId) : null;
        if (record.PatientId != Guid.Empty)
        {
            return found.TryGetValue(record.PatientId, out var patient)
                ? Person.Of(patient, record, record.AppointmentId, dentist)
                : null;
        }

        if (record.AppointmentId is not { } bookingId || !bookings.TryGetValue(bookingId, out var booking))
        {
            return null;
        }

        if (booking.PatientId != Guid.Empty)
        {
            return found.TryGetValue(booking.PatientId, out var patient)
                ? Person.Of(patient, record, booking.Id, dentist)
                : null;
        }

        return Person.Guest(booking, record, dentist);
    }

    /// <summary>
    /// The customers picked; the CSKH row a row button came from rides along
    /// with its customer, booking included, as on the list. A row of another
    /// branch or customer is dropped without a word.
    /// </summary>
    private async Task<List<Person>> ReadPickedAsync(Guid branchId, IReadOnlyCollection<Guid> patientIds, Guid? careRecordId)
    {
        var ids = patientIds.ToHashSet();
        if (ids.Count == 0)
        {
            return [];
        }

        var picked = await patients.GetListAsync(p => ids.Contains(p.Id) && p.BranchId == branchId);
        var record = careRecordId is { } recordId ? await careRecords.FindAsync(recordId) : null;
        if (record != null && (record.BranchId != branchId || !ids.Contains(record.PatientId)))
        {
            record = null;
        }

        return [.. picked.Select(p => record?.PatientId == p.Id
            ? Person.Of(p, record, record.AppointmentId)
            : Person.Of(p, null, null))];
    }

    private async Task<Dictionary<string, IReadOnlyDictionary<string, string?>>> ResolveAsync(
        Guid branchId, IReadOnlyCollection<Person> people)
    {
        var withRecord = people.Where(p => p.Patient != null).ToList();
        var pinned = withRecord
            .Where(p => p.AppointmentId.HasValue)
            .ToDictionary(p => p.Patient!.Id, p => p.AppointmentId!.Value);
        var patientValues = await variables.ResolveAsync(
            branchId, [.. withRecord.Select(p => p.Patient!)], pinned);
        var guestValues = await variables.ResolveGuestsAsync(
            branchId, [.. people.Where(p => p.Booking != null).Select(p => p.Booking!)]);

        return people.ToDictionary(
            p => p.Key,
            p => p.Patient != null ? patientValues[p.Patient.Id] : guestValues[p.Booking!.Id],
            StringComparer.Ordinal);
    }

    private async Task<IReadOnlyDictionary<Guid, string>> StaffNamesAsync(IEnumerable<Guid?> staffIds)
    {
        var ids = staffIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        if (ids.Count == 0)
        {
            return new Dictionary<Guid, string>();
        }

        var found = await users.GetListByIdsAsync(ids);
        return found.ToDictionary(u => u.Id, u => u.Name ?? u.UserName);
    }

    private sealed record Person(
        string Key, string Name, Patient? Patient, Appointment? Booking,
        CareRecord? Record, Guid? AppointmentId, string? DentistName)
    {
        public static Person Of(Patient patient, CareRecord? record, Guid? appointmentId, string? dentist = null) =>
            new(PatientKey + patient.Id, patient.FullName, patient, null, record, appointmentId, dentist);

        public static Person Guest(Appointment booking, CareRecord? record, string? dentist = null) =>
            new(GuestKey + booking.Id, booking.PatientName ?? string.Empty, null, booking, record, booking.Id, dentist);
    }
}

/// <summary>One row of "Gửi tới". <see cref="SkipReason"/> null means the message goes.</summary>
public sealed record MessageRecipient(
    string Key,
    Guid? PatientId,
    Guid? CareRecordId,
    string Name,
    string? Code,
    string? Phone,
    string? Email,
    string? DentistName,
    MessageReceipt? Received,
    MessageSkipReason? SkipReason,
    IReadOnlyList<string> Missing,
    MessageCheck? Check);

public sealed record MessageCheck(
    ComposedMessage Message,
    IReadOnlyList<string> Missing,
    IReadOnlyDictionary<string, string>? ZnsValues);
