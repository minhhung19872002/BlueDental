using System.Text.Json;

namespace BlueDental.XrayAgent.Core;

/// <summary>Where the agent keeps its own files.</summary>
public static class AgentPaths
{
    public static string DataFolder { get; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BlueDental", "XrayAgent");

    public static string SettingsFile => Path.Combine(DataFolder, "settings.json");
    public static string LedgerFile => Path.Combine(DataFolder, "state.json");
    public static string LogFolder => Path.Combine(DataFolder, "logs");
}

/// <summary>Reads and writes <see cref="AgentSettings"/> as JSON, atomically.</summary>
public sealed class SettingsStore(string path)
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    /// <summary>
    /// The saved settings, or defaults when there are none. A file that no
    /// longer parses is moved aside as <c>.bad</c> (and reported through
    /// <see cref="LastLoadWasDamaged"/>) instead of being overwritten unseen.
    /// </summary>
    public AgentSettings Load()
    {
        LastLoadWasDamaged = false;
        if (!File.Exists(path))
            return new AgentSettings();

        try
        {
            return JsonSerializer.Deserialize<AgentSettings>(File.ReadAllText(path), Json) ?? new AgentSettings();
        }
        catch (JsonException)
        {
            LastLoadWasDamaged = true;
            File.Move(path, path + ".bad", overwrite: true);
            return new AgentSettings();
        }
    }

    public bool LastLoadWasDamaged { get; private set; }

    public void Save(AgentSettings settings)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(path))!);
        var temp = path + ".tmp";
        File.WriteAllText(temp, JsonSerializer.Serialize(settings, Json));
        File.Move(temp, path, overwrite: true);
    }
}
