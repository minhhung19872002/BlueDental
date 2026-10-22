using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using BlueDental.Tools;
using BlueDental.TreatmentManagement;
using Volo.Abp.DependencyInjection;

namespace BlueDental.CustomerCare.Messaging;

/// <summary>
/// A real customer's values as the viewer may see them in a preview: the
/// phone under "Ẩn số điện thoại", the debt without "Chi phí › Xem". What is
/// sent is never masked — only what the screen shows.
/// </summary>
public class MessageValueMasker(PatientPhoneMasker phoneMasker, TreatmentCostAccess costAccess) : ITransientDependency
{
    /// <summary>Same mask as the patient list's hidden money.</summary>
    public const string MoneyMask = "*********";

    public async Task<IReadOnlyDictionary<string, string?>> MaskAsync(IReadOnlyDictionary<string, string?> values)
    {
        var masked = new Dictionary<string, string?>(values, StringComparer.Ordinal);
        if (await phoneMasker.ShouldMaskAsync())
        {
            masked[MessageVariables.Phone] = PatientPhoneMask.Mask(masked.GetValueOrDefault(MessageVariables.Phone));
        }

        if (!await costAccess.SeesCostsAsync())
        {
            masked[MessageVariables.Debt] = MoneyMask;
        }

        return masked;
    }
}
