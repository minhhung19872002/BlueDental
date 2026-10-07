using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Volo.Abp.DependencyInjection;

namespace BlueDental.Security;

/// <summary>
/// Masks patient phones in every JSON response for an account holding
/// "Ẩn số điện thoại" (Cụm 11 mục 9). Runs on the result, after the service
/// has finished, so nothing the service stores — an appointment's history
/// snapshot — ever sees a masked number. Files (Excel) are masked by the
/// export itself.
/// </summary>
public class PatientPhoneMaskingFilter(PatientPhoneMasker masker) : IAsyncResultFilter, ITransientDependency
{
    public async Task OnResultExecutionAsync(ResultExecutingContext context, ResultExecutionDelegate next)
    {
        if (context.Result is ObjectResult { Value: { } value })
        {
            await masker.MaskIfRequiredAsync(value);
        }

        await next();
    }
}
