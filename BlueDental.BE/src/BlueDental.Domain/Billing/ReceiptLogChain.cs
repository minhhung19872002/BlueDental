using System;
using System.Collections.Generic;

namespace BlueDental.Billing;

/// <summary>
/// What reading a receipt's log back found (R-1082). <see cref="Intact"/>:
/// numbered 1, 2, 3… without a gap, and every sealed line still matches its
/// seal and the line before it. <see cref="UnsealedCount"/>: lines written
/// before seals existed — only ever ahead of the first sealed line.
/// </summary>
public record ReceiptLogCheck(bool Intact, int UnsealedCount, IReadOnlySet<Guid> Verified);

public static class ReceiptLogChain
{
    /// <param name="lines">One receipt's lines in <see cref="PaymentReceiptLog.Sequence"/> order.</param>
    public static ReceiptLogCheck Check(IReadOnlyList<PaymentReceiptLog> lines, IReceiptCipher cipher)
    {
        var verified = new HashSet<Guid>();
        var intact = true;
        var unsealed = 0;
        string? previousSeal = null;
        for (var i = 0; i < lines.Count; i++)
        {
            var line = lines[i];
            // A line dropped from the middle or the start leaves a gap.
            if (line.Sequence != i + 1)
            {
                intact = false;
            }

            if (line.Seal == null)
            {
                unsealed++;
                // Nothing unsealed may follow a sealed line: that one was slipped in.
                if (previousSeal != null)
                {
                    intact = false;
                }
            }
            else if (line.IsSealedAfter(previousSeal, cipher))
            {
                verified.Add(line.Id);
            }
            else
            {
                intact = false;
            }

            previousSeal = line.Seal;
        }

        return new ReceiptLogCheck(intact, unsealed, verified);
    }
}
