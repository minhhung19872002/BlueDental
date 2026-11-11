using System.Diagnostics;
using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent;

internal sealed class ProcessLauncher : IProcessLauncher
{
    public void Start(string fileName, string arguments, string workingDirectory)
    {
        using var _ = Process.Start(new ProcessStartInfo(fileName, arguments)
        {
            WorkingDirectory = workingDirectory,
            UseShellExecute = true,
        });
    }
}
