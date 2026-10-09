namespace BlueDental.Queue;

/// <summary>The colour of a wait against its counter's "Ngưỡng cảnh báo chờ".</summary>
public enum QueueWaitLevel
{
    /// <summary>Under 70% of the threshold — green "Bình thường".</summary>
    Normal,

    /// <summary>From 70% of the threshold — amber "Sắp quá ngưỡng".</summary>
    Warning,

    /// <summary>Past the threshold — red "Quá ngưỡng".</summary>
    Danger,
}

public static class QueueWaitLevels
{
    public const double WarningShare = 0.7;

    public static QueueWaitLevel Of(double waitedMinutes, int thresholdMinutes) =>
        waitedMinutes > thresholdMinutes ? QueueWaitLevel.Danger
        : waitedMinutes >= thresholdMinutes * WarningShare ? QueueWaitLevel.Warning
        : QueueWaitLevel.Normal;
}
