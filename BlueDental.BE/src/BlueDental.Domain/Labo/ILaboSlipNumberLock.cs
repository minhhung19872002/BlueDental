using System;
using System.Threading.Tasks;

namespace BlueDental.Labo;

/// <summary>
/// Lines up the saves that hand a patient their next Labo Mã số (R-1288).
///
/// Two people saving a slip for the same patient at once would both read the
/// same highest number and both take the next one; the later save would then
/// fail on the branch's unique index. Held until the request's transaction
/// ends, so the second save reads the number the first one committed.
/// </summary>
public interface ILaboSlipNumberLock
{
    Task WaitForPatientAsync(Guid patientId);
}
