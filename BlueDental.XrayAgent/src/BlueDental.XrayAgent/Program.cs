using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent;

internal static class Program
{
    [STAThread]
    private static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var first = args.FirstOrDefault();

        switch (first)
        {
            case "--install":
                ProtocolRegistration.Install(Application.ExecutablePath);
                MessageBox.Show(Strings.Installed, Strings.AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
            case "--uninstall":
                ProtocolRegistration.Uninstall();
                MessageBox.Show(Strings.Uninstalled, Strings.AppName, MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 0;
        }

        string? code = null;
        if (first is not null && !AgentLink.TryParse(first, out code))
        {
            MessageBox.Show(Strings.BadLink, Strings.AppName, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 1;
        }

        using var instance = SingleInstance.Acquire();
        if (!instance.IsFirst)
        {
            if (code is not null && !SingleInstance.Forward(AgentLink.Build(code)))
                MessageBox.Show(Strings.AgentBusy, Strings.AppName, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return 0;
        }

        using var tray = new TrayContext(instance, code);
        Application.Run(tray);
        return 0;
    }
}
