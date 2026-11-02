using System;
using System.Collections.Generic;
using System.Linq;

namespace BlueDental.TreatmentManagement;

/// <summary>
/// Only the công đoạn of a service line's newest "Ngày điều trị" move it on
/// (BA 2026-11-02): an older-dated row keeps its pictures, content and note,
/// but its Hoàn thành and its Tạo Labo are frozen. A row back-filled to an
/// earlier day is written all the same — it is merely frozen at once if the
/// line already has a newer one. The way on from a frozen, unfinished row is
/// "Tiếp tục công đoạn" to the newest day, so the line's history reads in order.
///
/// Measured within one service line, never per tooth. Labo warranties are the
/// lab's and stand apart: they neither freeze nor are frozen. A row replaced by
/// "Tiếp tục" still counts towards the newest day — its date is history.
/// Rows sharing the newest day are all open.
/// </summary>
public static class StageDateLock
{
    /// <summary>The newest "Ngày điều trị" of the line's own work; null with none.</summary>
    public static DateOnly? NewestDay(IEnumerable<TreatmentStage> lineStages) =>
        lineStages.Where(s => !s.IsLaboWarranty).Select(s => (DateOnly?)s.TreatmentDate).Max();

    public static bool IsLocked(TreatmentStage stage, DateOnly? newestDay) =>
        !stage.IsLaboWarranty && newestDay is { } newest && stage.TreatmentDate < newest;

    public static bool IsLocked(TreatmentStage stage, IEnumerable<TreatmentStage> lineStages) =>
        IsLocked(stage, NewestDay(lineStages));
}
