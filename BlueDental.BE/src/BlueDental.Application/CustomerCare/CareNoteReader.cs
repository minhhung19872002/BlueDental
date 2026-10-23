using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using BlueDental.ZaloInbox;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Linq;

namespace BlueDental.CustomerCare;

/// <summary>Care notes as the chat and the record's history show them: with their log and every name in it.</summary>
public class CareNoteReader(
    IRepository<CareNote, Guid> notes,
    ZaloInboxReader names,
    IAsyncQueryableExecuter asyncExecuter) : ITransientDependency
{
    /// <summary>The branch's notes matching <paramref name="belongs"/>, newest first.</summary>
    public async Task<List<CareNoteDto>> ListAsync(Guid branchId, Expression<Func<CareNote, bool>> belongs)
    {
        var list = await asyncExecuter.ToListAsync((await notes.WithDetailsAsync(n => n.Revisions))
            .Where(n => n.ClinicBranchId == branchId)
            .Where(belongs)
            .OrderByDescending(n => n.CreatedAt));
        return await ToDtosAsync(list);
    }

    public async Task<List<CareNoteDto>> ToDtosAsync(IReadOnlyList<CareNote> list)
    {
        var people = await names.UserNamesAsync(list.SelectMany(n => n.Revisions.Select(r => (Guid?)r.ActorId)
            .Append(n.AuthorId).Append(n.LastEditorId).Append(n.RemoverId)));
        return [.. list.Select(n => new CareNoteDto
        {
            Id = n.Id,
            ConversationId = n.ConversationId,
            PatientId = n.PatientId,
            Content = n.Content,
            Outcome = n.Outcome,
            AuthorId = n.AuthorId,
            AuthorName = people.GetValueOrDefault(n.AuthorId),
            CreatedAt = n.CreatedAt,
            LastEditorName = n.LastEditorId is { } editor ? people.GetValueOrDefault(editor) : null,
            LastEditedAt = n.LastEditedAt,
            IsRemoved = n.IsRemoved,
            RemoverName = n.RemoverId is { } remover ? people.GetValueOrDefault(remover) : null,
            RemovedAt = n.RemovedAt,
            Revisions = [.. n.Revisions.OrderBy(r => r.At).Select(r => new CareNoteRevisionDto
            {
                Action = r.Action,
                Before = r.Before,
                After = r.After,
                ActorName = people.GetValueOrDefault(r.ActorId),
                At = r.At,
            })],
        })];
    }

    /// <summary>The record's notes and those of the conversations linked to it.</summary>
    public static Expression<Func<CareNote, bool>> OfPatient(Guid patientId, IReadOnlyCollection<Guid> conversationIds) =>
        n => n.PatientId == patientId || (n.ConversationId != null && conversationIds.Contains(n.ConversationId.Value));
}
