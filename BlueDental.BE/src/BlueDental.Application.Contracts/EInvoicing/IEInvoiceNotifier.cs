using System;
using System.Threading.Tasks;

namespace BlueDental.EInvoicing;

/// <summary>
/// Tells open screens that a branch's e-invoices changed — signed or
/// cancelled on the provider's portal, read back by the sync — so the Hóa đơn
/// dialog and the receipt lists refetch instead of waiting for ↻. Carries only
/// the branch id: each screen reads the invoices back through the API, which
/// applies its own branch and permission checks.
/// </summary>
public interface IEInvoiceNotifier
{
    Task NotifyChangedAsync(Guid branchId);
}
