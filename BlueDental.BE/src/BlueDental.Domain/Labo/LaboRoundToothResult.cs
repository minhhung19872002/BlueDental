using System.Collections.Generic;
using Volo.Abp.Domain.Values;

namespace BlueDental.Labo;

/// <summary>
/// One tooth as the check found it: Đạt, or Lỗi with its note — since P3110
/// the tooth's "Mô tả gửi Labo" (REQ-D6). Both what the check form posts and
/// what a round keeps (jsonb on the round row), so each return keeps its own.
/// </summary>
public class LaboRoundToothResult : ValueObject
{
    public int ToothNumber { get; private set; }
    public LaboToothCheckResult Result { get; private set; }
    public string? Note { get; private set; }

    protected LaboRoundToothResult() { }

    public LaboRoundToothResult(int toothNumber, LaboToothCheckResult result, string? note = null)
    {
        ToothNumber = toothNumber;
        Result = result;
        Note = result == LaboToothCheckResult.Failed && !string.IsNullOrWhiteSpace(note)
            ? note.Trim()
            : null;
    }

    protected override IEnumerable<object> GetAtomicValues()
    {
        yield return ToothNumber;
        yield return Result;
        yield return Note ?? string.Empty;
    }
}
