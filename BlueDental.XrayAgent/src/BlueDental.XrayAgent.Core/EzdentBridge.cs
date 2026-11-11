using System.ComponentModel;
using System.Text;

namespace BlueDental.XrayAgent.Core;

public enum BridgeOutcome
{
    Opened,
    LoaderMissing,
    PatientNotFound,
    Unauthorized,
    ServerUnavailable,
    WriteFailed,
    LaunchFailed,
}

public interface IProcessLauncher
{
    void Start(string fileName, string arguments, string workingDirectory);
}

/// <summary>
/// "Mở EzDent-i": asks BlueDental for the record behind a code (scoped to the
/// device's branch on the server), writes the linkage file and starts the
/// loader. The loader's arguments come only from settings and the linkage
/// path — nothing from the link or the server reaches the command line.
/// </summary>
public sealed class EzdentBridge(
    AgentSettings settings,
    IStationApi station,
    IProcessLauncher launcher,
    IAgentLog log,
    string dataFolder)
{
    public string LoaderPath => Path.Combine(settings.EzdentBinFolder, settings.LoaderName);

    public string LinkagePath => Path.Combine(
        string.IsNullOrWhiteSpace(settings.LinkageFolder) ? dataFolder : settings.LinkageFolder,
        settings.LinkageFileName);

    /// <summary>The loader must be a bare .exe name inside the Bin folder.</summary>
    public static bool IsValidLoaderName(string? name) =>
        !string.IsNullOrWhiteSpace(name)
        && Path.GetFileName(name) == name
        && name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase);

    public async Task<BridgeOutcome> OpenAsync(string code, CancellationToken ct)
    {
        if (!AgentLink.IsValidCode(code))
            return BridgeOutcome.PatientNotFound;
        if (!IsValidLoaderName(settings.LoaderName) || !File.Exists(LoaderPath))
        {
            log.Warn($"open code={code}: loader not found");
            return BridgeOutcome.LoaderMissing;
        }

        var answer = await station.GetPatientByCodeAsync(code, ct);
        if (answer.Value is not { } patient)
        {
            log.Warn($"open code={code}: {answer.Detail}");
            return answer.Failure switch
            {
                StationFailure.Unauthorized => BridgeOutcome.Unauthorized,
                StationFailure.NotFound or StationFailure.Rejected => BridgeOutcome.PatientNotFound,
                _ => BridgeOutcome.ServerUnavailable,
            };
        }

        var linkage = LinkagePath;
        try
        {
            var xml = LinkageXml.Render(ReadTemplate(), patient, settings.UnaccentNames);
            Directory.CreateDirectory(Path.GetDirectoryName(linkage)!);
            File.WriteAllText(linkage, xml, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        }
        catch (Exception e) when (e is IOException or UnauthorizedAccessException)
        {
            log.Warn($"open code={code}: linkage not written: {LogSafe.Describe(e)}");
            return BridgeOutcome.WriteFailed;
        }

        var arguments = settings.LoaderArguments.Replace("{linkage}", linkage, StringComparison.OrdinalIgnoreCase);
        try
        {
            launcher.Start(LoaderPath, arguments, settings.EzdentBinFolder);
        }
        catch (Exception e) when (e is Win32Exception or InvalidOperationException or IOException)
        {
            log.Warn($"open code={code}: loader did not start: {LogSafe.Describe(e)}");
            return BridgeOutcome.LaunchFailed;
        }

        log.Info($"open code={code}: loader started");
        return BridgeOutcome.Opened;
    }

    private string ReadTemplate()
    {
        var path = settings.LinkageTemplatePath;
        if (string.IsNullOrWhiteSpace(path))
            return LinkageXml.DefaultTemplate;
        if (File.Exists(path))
            return File.ReadAllText(path);

        log.Warn("linkage template not found; using the built-in one");
        return LinkageXml.DefaultTemplate;
    }
}
