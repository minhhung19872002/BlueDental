using System.Globalization;

namespace BlueDental.XrayAgent.Core;

/// <summary>
/// The agent's log. Lines must never hold a patient's name — file names and
/// paths can, so callers write the customer code and a hash prefix instead,
/// and exceptions through <see cref="LogSafe.Describe"/> (IO messages quote
/// the path).
/// </summary>
public interface IAgentLog
{
    void Info(string message);
    void Warn(string message);
    void Error(string message);
}

public static class LogSafe
{
    public static string Describe(Exception e) =>
        string.Create(CultureInfo.InvariantCulture, $"{e.GetType().Name} (0x{e.HResult:X8})");
}

public sealed class NullAgentLog : IAgentLog
{
    public static readonly NullAgentLog Instance = new();

    public void Info(string message) { }
    public void Warn(string message) { }
    public void Error(string message) { }
}

/// <summary>One file a day under the log folder; the newest 30 are kept.</summary>
public sealed class FileAgentLog : IAgentLog
{
    private const int KeepFiles = 30;
    private readonly string _folder;
    private readonly TimeProvider _time;
    private readonly Lock _gate = new();

    public FileAgentLog(string folder, TimeProvider time)
    {
        _folder = folder;
        _time = time;
        Directory.CreateDirectory(folder);
        foreach (var old in Directory.GetFiles(folder, "agent-*.log").OrderDescending().Skip(KeepFiles))
            File.Delete(old);
    }

    public void Info(string message) => Write("INFO", message);
    public void Warn(string message) => Write("WARN", message);
    public void Error(string message) => Write("ERROR", message);

    private void Write(string level, string message)
    {
        var now = _time.GetLocalNow();
        var file = Path.Combine(_folder, $"agent-{now:yyyyMMdd}.log");
        var line = string.Create(CultureInfo.InvariantCulture, $"{now:yyyy-MM-dd HH:mm:ss.fff zzz} {level} {message}{Environment.NewLine}");
        lock (_gate)
        {
            try
            {
                File.AppendAllText(file, line);
            }
            catch (IOException)
            {
                // Nowhere left to report a log that cannot be written; the agent keeps working.
            }
        }
    }
}
