using System;
using System.Collections;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using BlueDental.Data;
using BlueDental.Permissions;
using Volo.Abp.Authorization.Permissions;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Users;

namespace BlueDental.PatientManagement;

/// <summary>
/// Cụm 11 mục 9 — makes the "Ẩn số điện thoại" tick (<c>patient.hidePhone</c>)
/// real: for an account holding it, every DTO property marked
/// <see cref="PatientPhoneAttribute"/> is masked on its way out — API responses
/// (through the HttpApi result filter) and Excel exports alike.
///
/// Masking happens only at that edge, never on the entities or on what is
/// stored: an appointment's history snapshot keeps the real number. The admin
/// role always sees the full number — the seed used to grant it every
/// permission, this one included.
/// </summary>
public class PatientPhoneMasker(ICurrentUser currentUser, IPermissionChecker permissionChecker) : IScopedDependency
{
    private static readonly ConcurrentDictionary<Type, TypeShape> Shapes = new();

    private bool? _shouldMask;

    public async Task<bool> ShouldMaskAsync()
    {
        _shouldMask ??= currentUser.IsAuthenticated
            && !currentUser.IsInRole(BlueDentalAbilitySeedContributor.AdminRoleName)
            && await permissionChecker.IsGrantedAsync(BlueDentalAbilityPermissions.Patient.HidePhone);
        return _shouldMask.Value;
    }

    /// <summary>Masks the phones in <paramref name="graph"/> in place when the caller holds the tick.</summary>
    public async Task MaskIfRequiredAsync(object? graph)
    {
        if (graph is null || !await ShouldMaskAsync()) return;
        Mask(graph);
    }

    /// <summary>Masks unconditionally — the walk itself, for callers that have already decided.</summary>
    public static void Mask(object graph) =>
        Walk(graph, new HashSet<object>(ReferenceEqualityComparer.Instance));

    private static void Walk(object? node, HashSet<object> seen)
    {
        if (node is null || node is string || node.GetType().IsValueType || !seen.Add(node)) return;

        if (node is IEnumerable items)
        {
            foreach (var item in items) Walk(item, seen);
            return;
        }

        var shape = Shapes.GetOrAdd(node.GetType(), TypeShape.Of);
        if (!shape.IsDto) return;

        if (node is IPatientPhoneMaskable self) self.MaskPatientPhones(PatientPhoneMask.Mask);

        foreach (var property in shape.Phones)
            property.SetValue(node, PatientPhoneMask.Mask((string?)property.GetValue(node)));

        foreach (var property in shape.EmbeddedPhones)
            property.SetValue(node, PatientPhoneMask.MaskEmbedded((string?)property.GetValue(node)));

        foreach (var property in shape.Nested)
            Walk(property.GetValue(node), seen);
    }

    private sealed record TypeShape(bool IsDto, PropertyInfo[] Phones, PropertyInfo[] EmbeddedPhones, PropertyInfo[] Nested)
    {
        public static TypeShape Of(Type type)
        {
            // Our DTOs and ABP's paged/list wrappers; nothing else is walked.
            var ns = type.Namespace ?? string.Empty;
            var isDto = ns.StartsWith("BlueDental", StringComparison.Ordinal)
                || ns.StartsWith("Volo.Abp.Application.Dtos", StringComparison.Ordinal);
            if (!isDto) return new TypeShape(false, [], [], []);

            var properties = type.GetProperties(BindingFlags.Instance | BindingFlags.Public)
                .Where(p => p.CanRead && p.GetIndexParameters().Length == 0)
                .ToList();

            PropertyInfo[] Marked(bool embedded) => properties
                .Where(p => p.PropertyType == typeof(string) && p.CanWrite
                    && p.GetCustomAttribute<PatientPhoneAttribute>() is { } a && a.Embedded == embedded)
                .ToArray();

            var nested = properties
                .Where(p => p.PropertyType != typeof(string) && !p.PropertyType.IsValueType)
                .ToArray();

            return new TypeShape(true, Marked(false), Marked(true), nested);
        }
    }
}
