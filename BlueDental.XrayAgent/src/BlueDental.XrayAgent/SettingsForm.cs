using BlueDental.XrayAgent.Core;

namespace BlueDental.XrayAgent;

/// <summary>
/// The agent's settings, laid out in code (no designer file). Saving checks
/// the address, the file-name pattern and the loader name; the token box is
/// write-only — empty keeps the saved token.
/// </summary>
internal sealed class SettingsForm : Form
{
    private readonly AgentSettings _settings;
    private readonly ITokenProtector _protector;
    private readonly TableLayoutPanel _grid = new()
    {
        ColumnCount = 3,
        AutoSize = true,
        AutoSizeMode = AutoSizeMode.GrowAndShrink,
        Dock = DockStyle.Fill,
        Padding = new Padding(12),
    };

    private readonly TextBox _serverUrl = NewText();
    private readonly TextBox _token = NewText();
    private readonly Label _testResult = new() { AutoSize = true, MaximumSize = new Size(460, 0) };
    private readonly TextBox _watchFolder = NewText();
    private readonly CheckBox _subfolders = NewCheck(Strings.CheckSubfolders);
    private readonly TextBox _pattern = NewText();
    private readonly CheckBox _parentFolder = NewCheck(Strings.CheckParentFolder);
    private readonly CheckBox _infoFile = NewCheck(Strings.CheckInfoFile);
    private readonly CheckBox _sendOld = NewCheck(Strings.CheckSendOld);
    private readonly TextBox _binFolder = NewText();
    private readonly ComboBox _loader = new() { Width = 360, DropDownStyle = ComboBoxStyle.DropDown };
    private readonly TextBox _loaderArgs = NewText();
    private readonly TextBox _linkageFolder = NewText();
    private readonly TextBox _template = NewText();
    private readonly CheckBox _unaccent = NewCheck(Strings.CheckUnaccent);

    public SettingsForm(AgentSettings settings, ITokenProtector protector)
    {
        _settings = settings.Clone();
        _protector = protector;

        Text = Strings.SettingsTitle;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        MinimizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        AutoSize = true;
        AutoSizeMode = AutoSizeMode.GrowAndShrink;
        Font = new Font("Segoe UI", 9F);

        BuildLayout();
        LoadValues();
        Controls.Add(_grid);
    }

    /// <summary>The edited settings; read after <see cref="DialogResult.OK"/>.</summary>
    public AgentSettings Result => _settings;

    private void BuildLayout()
    {
        _token.UseSystemPasswordChar = true;
        _token.PlaceholderText = _settings.IsConfigured ? Strings.TokenKeepHint : string.Empty;
        _loader.Items.AddRange(["VTE2Loader32.exe", "VTEzBridge32.exe"]);

        var test = new Button { Text = Strings.ButtonTest, AutoSize = true };
        test.Click += HandleTestClick;

        AddHeader(Strings.GroupServer);
        AddRow(Strings.LabelServerUrl, _serverUrl);
        AddRow(Strings.LabelToken, _token, test);
        AddRow(string.Empty, _testResult);

        AddHeader(Strings.GroupPictures);
        AddRow(Strings.LabelWatchFolder, _watchFolder, BrowseFolderButton(_watchFolder));
        AddRow(string.Empty, _subfolders);
        AddRow(string.Empty, _infoFile);
        AddRow(Strings.LabelPattern, _pattern);
        AddRow(string.Empty, _parentFolder);
        AddRow(string.Empty, _sendOld);

        AddHeader(Strings.GroupEzdent);
        AddRow(Strings.LabelBinFolder, _binFolder, BrowseFolderButton(_binFolder));
        AddRow(Strings.LabelLoader, _loader);
        AddRow(Strings.LabelLoaderArgs, _loaderArgs);
        AddRow(Strings.LabelLinkageFolder, _linkageFolder, BrowseFolderButton(_linkageFolder));
        AddRow(Strings.LabelTemplate, _template, BrowseFileButton(_template));
        AddRow(string.Empty, _unaccent);

        var save = new Button { Text = Strings.ButtonSave, AutoSize = true };
        var cancel = new Button { Text = Strings.ButtonCancel, AutoSize = true, DialogResult = DialogResult.Cancel };
        save.Click += HandleSaveClick;
        AcceptButton = save;
        CancelButton = cancel;
        var buttons = new FlowLayoutPanel { FlowDirection = FlowDirection.RightToLeft, AutoSize = true, Dock = DockStyle.Fill };
        buttons.Controls.AddRange([cancel, save]);
        _grid.Controls.Add(buttons);
        _grid.SetColumnSpan(buttons, 3);
    }

    private void LoadValues()
    {
        _serverUrl.Text = _settings.ServerUrl;
        _watchFolder.Text = _settings.WatchFolder;
        _subfolders.Checked = _settings.IncludeSubfolders;
        _infoFile.Checked = _settings.ReadEzdentInfoFile;
        _pattern.Text = _settings.FileNamePattern;
        _parentFolder.Checked = _settings.CodeFromParentFolder;
        // A fresh install starts from "now" unless the user asks for the old pictures too.
        _sendOld.Checked = _settings.IsConfigured && _settings.StartFrom is null;
        _binFolder.Text = _settings.EzdentBinFolder;
        _loader.Text = _settings.LoaderName;
        _loaderArgs.Text = _settings.LoaderArguments;
        _linkageFolder.Text = _settings.LinkageFolder;
        _template.Text = _settings.LinkageTemplatePath;
        _unaccent.Checked = _settings.UnaccentNames;
    }

    private string? FindProblem()
    {
        switch (StationClient.ValidateServerUrl(_serverUrl.Text))
        {
            case ServerUrlProblem.Invalid:
                return Strings.ErrorServerUrl;
            case ServerUrlProblem.InsecureHttp:
                return Strings.ErrorInsecureUrl;
        }

        if (string.IsNullOrWhiteSpace(_token.Text) && !_settings.IsConfigured)
            return Strings.ErrorTokenRequired;
        if (HintParser.Validate(_pattern.Text) is { } patternError)
            return string.Format(Strings.ErrorPattern, patternError);
        if (!EzdentBridge.IsValidLoaderName(_loader.Text.Trim()))
            return Strings.ErrorLoader;
        if (!string.IsNullOrWhiteSpace(_watchFolder.Text) && !Directory.Exists(_watchFolder.Text.Trim()))
            return Strings.ErrorWatchFolder;
        return null;
    }

    private void HandleSaveClick(object? sender, EventArgs e)
    {
        if (FindProblem() is { } error)
        {
            MessageBox.Show(this, error, Strings.SettingsTitle, MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        _settings.ServerUrl = _serverUrl.Text.Trim().TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(_token.Text))
            _settings.WriteToken(_protector, _token.Text);
        _settings.WatchFolder = _watchFolder.Text.Trim();
        _settings.IncludeSubfolders = _subfolders.Checked;
        _settings.ReadEzdentInfoFile = _infoFile.Checked;
        _settings.FileNamePattern = _pattern.Text;
        _settings.CodeFromParentFolder = _parentFolder.Checked;
        _settings.StartFrom = _sendOld.Checked ? null : _settings.StartFrom ?? DateTimeOffset.Now;
        _settings.EzdentBinFolder = _binFolder.Text.Trim();
        _settings.LoaderName = _loader.Text.Trim();
        _settings.LoaderArguments = _loaderArgs.Text.Trim();
        _settings.LinkageFolder = _linkageFolder.Text.Trim();
        _settings.LinkageTemplatePath = _template.Text.Trim();
        _settings.UnaccentNames = _unaccent.Checked;

        DialogResult = DialogResult.OK;
        Close();
    }

    private async void HandleTestClick(object? sender, EventArgs e)
    {
        if (StationClient.ValidateServerUrl(_serverUrl.Text) is not ServerUrlProblem.None)
        {
            _testResult.Text = Strings.ErrorServerUrl;
            return;
        }

        var token = string.IsNullOrWhiteSpace(_token.Text) ? _settings.ReadToken(_protector) : _token.Text.Trim();
        if (string.IsNullOrEmpty(token))
        {
            _testResult.Text = Strings.ErrorTokenRequired;
            return;
        }

        _testResult.Text = Strings.TestRunning;
        using var client = new StationClient(_serverUrl.Text, token);
        var answer = await client.PingAsync(CancellationToken.None);
        _testResult.Text = answer switch
        {
            { Value: { } info } => string.Format(Strings.TestOk, info.DeviceName, info.BranchName),
            { Failure: StationFailure.Unauthorized } => Strings.TestUnauthorized,
            _ => string.Format(Strings.TestFailed, answer.Detail),
        };
    }

    private void AddHeader(string text)
    {
        var label = new Label { Text = text, AutoSize = true, Font = new Font(Font, FontStyle.Bold), Margin = new Padding(0, 10, 0, 4) };
        _grid.Controls.Add(label);
        _grid.SetColumnSpan(label, 3);
    }

    private void AddRow(string label, Control input, Control? extra = null)
    {
        _grid.Controls.Add(new Label { Text = label, AutoSize = true, Anchor = AnchorStyles.Left, Margin = new Padding(0, 6, 8, 0) });
        _grid.Controls.Add(input);
        if (extra is null)
            _grid.Controls.Add(new Label { AutoSize = true });
        else
            _grid.Controls.Add(extra);
    }

    private Button BrowseFolderButton(TextBox target)
    {
        var button = new Button { Text = Strings.ButtonBrowse, Width = 32 };
        button.Click += (_, _) =>
        {
            using var dialog = new FolderBrowserDialog { InitialDirectory = target.Text, UseDescriptionForTitle = true };
            if (dialog.ShowDialog(this) == DialogResult.OK)
                target.Text = dialog.SelectedPath;
        };
        return button;
    }

    private Button BrowseFileButton(TextBox target)
    {
        var button = new Button { Text = Strings.ButtonBrowse, Width = 32 };
        button.Click += (_, _) =>
        {
            using var dialog = new OpenFileDialog { Filter = "XML (*.xml)|*.xml|*.*|*.*", FileName = target.Text };
            if (dialog.ShowDialog(this) == DialogResult.OK)
                target.Text = dialog.FileName;
        };
        return button;
    }

    private static TextBox NewText() => new() { Width = 360 };

    private static CheckBox NewCheck(string text) => new() { Text = text, AutoSize = true };
}
