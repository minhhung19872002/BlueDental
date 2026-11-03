using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Domain.Services;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Where a service line stands, read off its công đoạn: done once every live
/// one is ticked and every tooth of the line has had one; otherwise in
/// progress. The plan closes or reopens with it.
///
/// Stateless: the caller loads the plan (with its lines) and the line's công đoạn.
/// </summary>
public class ServiceLineProgress(StageTeethPolicy teethPolicy) : IDomainService
{
    /// <returns>False when the line's status is not the công đoạn's to decide.</returns>
    public bool Move(TreatmentPlan plan, TreatmentService line, IEnumerable<TreatmentStage> lineStages)
    {
        // Cancelled and replaced lines are closed by a decision about the line,
        // which its stages do not get to overturn.
        if (line.Status is TreatmentServiceStatus.Cancelled or TreatmentServiceStatus.Replaced)
        {
            return false;
        }

        // A Labo warranty is the lab's, not the clinic's: open or finished, it
        // leaves the line where it is (BA 2026-11-02).
        var siblings = lineStages.Where(x => !x.IsLaboWarranty).ToList();

        // Nothing of the clinic's own on the line — say a line finished by hand
        // that only has a Labo warranty: there is nothing to read it off.
        if (siblings.Count == 0)
        {
            return false;
        }

        // A superseded công đoạn stays at its old status for ever — its
        // successor carries the work — so only the live ones are asked. And a
        // line is only done once every tooth it treats has had a công đoạn: the
        // first công đoạn may take some of its teeth and leave the rest waiting
        // under "Thêm công đoạn".
        var live = siblings.Where(x => !x.IsSuperseded).ToList();
        var covered = teethPolicy.CoveredTeeth(line.Teeth, siblings);
        var allDone = live.Count > 0
            && live.TrueForAll(x => x.Status == TreatmentStageStatus.Completed)
            && line.Teeth.All(t => covered.Contains(t.ToothCode));

        if (allDone)
        {
            if (!line.IsCompleted)
            {
                line.Complete();
            }

            plan.CloseIfAllServicesDone();
        }
        else if (line.IsCompleted)
        {
            line.Reopen();
            plan.ReopenIfAnyServiceActive();
        }
        else
        {
            line.Start();
        }

        return true;
    }
}
