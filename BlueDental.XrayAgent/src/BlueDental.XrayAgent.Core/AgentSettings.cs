using System.Text.Json;

namespace BlueDental.XrayAgent.Core;

/// <summary>
/// What the X-ray PC's agent is set to. Saved as JSON under the Windows
/// user's local app data; the device token is never written in clear — only
/// its DPAPI-protected form (see <see cref="ITokenProtector"/>).
/// </summary>
public sealed class AgentSettings
{
    /// <summary>
    /// The default reads a BlueDental customer code at the start of the file
    /// name: "DH" plus at least six digits, or a bare 3–7 digit chart number.
    /// UNVERIFIED: EzDent-i's real file naming has not been seen yet, which is
    /// why the pattern is a setting.
    /// </summary>
    public const string DefaultFileNamePattern = @"^(?<code>DH\d{6,}|\d{3,7})";

    public const string DefaultLoaderName = "VTE2Loader32.exe";
    public const string DefaultLoaderArguments = "\"{linkage}\"";
    public const string DefaultLinkageFileName = "linkage.xml";
    public const string DefaultEzdentBinFolder = @"C:\Program Files (x86)\VATECH\EzDent-i\Bin";

    /// <summary>The clinic's BlueDental address, e.g. https://duchanhpremium.vn.</summary>
    public string ServerUrl { get; set; } = string.Empty;

    /// <summary>The device token as DPAPI protected it, base64.</summary>
    public string? ProtectedToken { get; set; }

    /// <summary>Where EzDent-i leaves the pictures it saves or exports.</summary>
    public string WatchFolder { get; set; } = string.Empty;

    public bool IncludeSubfolders { get; set; } = true;

    /// <summary>Regex with optional groups <c>code</c>, <c>name</c>, <c>year</c>.</summary>
    public string FileNamePattern { get; set; } = DefaultFileNamePattern;

    /// <summary>When the file name carries no code, read the folder holding it.</summary>
    public bool CodeFromParentFolder { get; set; }

    /// <summary>
    /// Read the information file EzDent-i writes beside an exported picture
    /// ("Thêm Tệp Thông tin Hình ảnh"): its Chart No, name, birthday and
    /// acquisition time win over what the file name says. See <see cref="EzdentInfoFile"/>.
    /// </summary>
    public bool ReadEzdentInfoFile { get; set; } = true;

    public string EzdentBinFolder { get; set; } = DefaultEzdentBinFolder;

    /// <summary><c>VTE2Loader32.exe</c> or <c>VTEzBridge32.exe</c> — a bare file name inside the Bin folder.</summary>
    public string LoaderName { get; set; } = DefaultLoaderName;

    /// <summary>Arguments for the loader; <c>{linkage}</c> becomes the linkage file's full path.</summary>
    public string LoaderArguments { get; set; } = DefaultLoaderArguments;

    /// <summary>
    /// Folder the linkage file is written to. Empty = the agent's own data
    /// folder, since Program Files is not writable without admin rights.
    /// </summary>
    public string LinkageFolder { get; set; } = string.Empty;

    public string LinkageFileName { get; set; } = DefaultLinkageFileName;

    /// <summary>Optional own template for the linkage file; empty = <see cref="LinkageXml.DefaultTemplate"/>.</summary>
    public string LinkageTemplatePath { get; set; } = string.Empty;

    /// <summary>Write names without Vietnamese marks, for viewers that read the file as ANSI.</summary>
    public bool UnaccentNames { get; set; } = true;

    /// <summary>
    /// Pictures last written before this moment are never sent, so pairing
    /// the agent does not push the whole old archive. Null = send everything.
    /// </summary>
    public DateTimeOffset? StartFrom { get; set; }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(ServerUrl) && !string.IsNullOrEmpty(ProtectedToken);

    public string? ReadToken(ITokenProtector protector) =>
        string.IsNullOrEmpty(ProtectedToken) ? null : protector.Unprotect(ProtectedToken);

    public void WriteToken(ITokenProtector protector, string token) =>
        ProtectedToken = protector.Protect(token.Trim());

    public AgentSettings Clone() =>
        JsonSerializer.Deserialize<AgentSettings>(JsonSerializer.Serialize(this)) ?? new AgentSettings();
}

/// <summary>Keeps the device token unreadable at rest (DPAPI on Windows).</summary>
public interface ITokenProtector
{
    string Protect(string token);

    /// <summary>Null when the value cannot be read back (another user, damaged file).</summary>
    string? Unprotect(string protectedToken);
}
