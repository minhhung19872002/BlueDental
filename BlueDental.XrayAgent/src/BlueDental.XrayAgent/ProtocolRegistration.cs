using BlueDental.XrayAgent.Core;
using Microsoft.Win32;

namespace BlueDental.XrayAgent;

/// <summary>
/// Per-user registration (HKCU, no admin): the <c>bluedental-xray:</c> link
/// opens this exe, and the agent starts when the user signs in.
/// </summary>
internal static class ProtocolRegistration
{
    private const string ClassKey = @"Software\Classes\" + AgentLink.Scheme;
    private const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    private const string RunValue = "BlueDentalXrayAgent";

    public static void Install(string exePath)
    {
        using (var key = Registry.CurrentUser.CreateSubKey(ClassKey))
        {
            key.SetValue(string.Empty, "URL:BlueDental X-quang");
            key.SetValue("URL Protocol", string.Empty);
            using var icon = key.CreateSubKey("DefaultIcon");
            icon.SetValue(string.Empty, $"\"{exePath}\",0");
            using var command = key.CreateSubKey(@"shell\open\command");
            command.SetValue(string.Empty, $"\"{exePath}\" \"%1\"");
        }

        using var run = Registry.CurrentUser.CreateSubKey(RunKey);
        run.SetValue(RunValue, $"\"{exePath}\"");
    }

    public static void Uninstall()
    {
        Registry.CurrentUser.DeleteSubKeyTree(ClassKey, throwOnMissingSubKey: false);
        using var run = Registry.CurrentUser.OpenSubKey(RunKey, writable: true);
        run?.DeleteValue(RunValue, throwOnMissingValue: false);
    }
}
