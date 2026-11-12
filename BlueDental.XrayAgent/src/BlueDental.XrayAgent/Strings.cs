namespace BlueDental.XrayAgent;

/// <summary>Every word the agent shows, in one place (the clinic works in Vietnamese).</summary>
internal static class Strings
{
    public const string AppName = "BlueDental X-quang";

    public const string Installed =
        "Đã cài đặt: trình duyệt mở được EzDent-i từ BlueDental và chương trình tự chạy khi đăng nhập Windows.";
    public const string Uninstalled = "Đã gỡ liên kết trình duyệt và tự chạy khi đăng nhập.";
    public const string BadLink = "Đường dẫn mở EzDent-i không hợp lệ.";
    public const string AgentBusy = "Chương trình BlueDental X-quang đang bận, vui lòng bấm lại.";

    public const string MenuStatus = "Trạng thái";
    public const string MenuSettings = "Cài đặt…";
    public const string MenuOpenWatchFolder = "Mở thư mục ảnh";
    public const string MenuOpenLogFolder = "Mở thư mục nhật ký";
    public const string MenuExit = "Thoát";

    public const string StatusNotConfigured = "Chưa cài đặt — mở Cài đặt để nhập địa chỉ BlueDental và mã thiết bị";
    public const string StatusTokenUnreadable = "Không đọc được mã thiết bị đã lưu — nhập lại trong Cài đặt";
    public const string StatusConnecting = "Đang kết nối…";
    public const string StatusConnected = "Đã kết nối: {0} — {1}";
    public const string StatusOffline = "Không kết nối được BlueDental ({0})";
    public const string StatusTokenRefused = "Mã thiết bị bị từ chối — nhập mã mới trong Cài đặt";
    public const string WatchOff = "Chưa chọn thư mục ảnh — chưa gửi ảnh";
    public const string WatchOn = "Đang theo dõi thư mục ảnh";
    public const string WatchFolderMissing = "Không thấy thư mục ảnh — chưa gửi ảnh";
    public const string Counters = "Đã gửi {0} · chờ gửi lại {1} · bị từ chối {2}";

    public const string TokenRefusedBalloon = "BlueDental từ chối mã thiết bị. Việc gửi ảnh đã dừng — nhập mã mới trong Cài đặt.";
    public const string RejectedBalloon = "Một ảnh bị BlueDental từ chối (không phải ảnh, quá lớn hoặc không an toàn). Xem nhật ký.";

    public const string OpenNotConfigured = "Chưa cài đặt kết nối BlueDental, chưa mở được EzDent-i.";
    public const string OpenLoaderMissing = "Không tìm thấy {0} trong thư mục EzDent-i. Kiểm tra Cài đặt.";
    public const string OpenPatientNotFound = "Không tìm thấy hồ sơ mã {0} ở chi nhánh của máy này.";
    public const string OpenUnauthorized = "BlueDental từ chối mã thiết bị — nhập mã mới trong Cài đặt.";
    public const string OpenServerUnavailable = "Không kết nối được BlueDental, vui lòng thử lại.";
    public const string OpenWriteFailed = "Không ghi được tệp liên kết cho EzDent-i.";
    public const string OpenLaunchFailed = "Không mở được EzDent-i.";

    public const string SettingsTitle = "Cài đặt BlueDental X-quang";
    public const string GroupServer = "Kết nối BlueDental";
    public const string GroupPictures = "Gửi ảnh X-quang";
    public const string GroupEzdent = "Mở EzDent-i từ BlueDental";
    public const string LabelServerUrl = "Địa chỉ BlueDental";
    public const string LabelToken = "Mã thiết bị";
    public const string TokenKeepHint = "Để trống = giữ mã đã lưu";
    public const string ButtonTest = "Kiểm tra kết nối";
    public const string LabelWatchFolder = "Thư mục ảnh";
    public const string CheckSubfolders = "Quét cả thư mục con";
    public const string LabelPattern = "Mẫu tên tệp (regex)";
    public const string CheckParentFolder = "Không có mã trong tên tệp thì lấy tên thư mục chứa ảnh";
    public const string CheckInfoFile = "Đọc Chart No từ tệp thông tin ảnh EzDent-i (tick \"Thêm Tệp Thông tin Hình ảnh\" khi xuất)";
    public const string CheckSendOld = "Gửi cả ảnh cũ đã có sẵn trong thư mục";
    public const string LabelBinFolder = "Thư mục Bin của EzDent-i";
    public const string LabelLoader = "Chương trình nạp";
    public const string LabelLoaderArgs = "Tham số ({linkage} = tệp liên kết)";
    public const string LabelLinkageFolder = "Thư mục ghi tệp liên kết (trống = mặc định)";
    public const string LabelTemplate = "Mẫu tệp liên kết (trống = mặc định)";
    public const string CheckUnaccent = "Ghi tên không dấu";
    public const string ButtonBrowse = "…";
    public const string ButtonSave = "Lưu";
    public const string ButtonCancel = "Huỷ";

    public const string ErrorServerUrl = "Địa chỉ BlueDental không hợp lệ.";
    public const string ErrorInsecureUrl = "Phải dùng https:// (chỉ máy này mới được dùng http://).";
    public const string ErrorTokenRequired = "Nhập mã thiết bị (lấy ở BlueDental → Cài đặt → Máy X-quang).";
    public const string ErrorPattern = "Mẫu tên tệp không hợp lệ: {0}";
    public const string ErrorLoader = "Chương trình nạp phải là tên một tệp .exe trong thư mục Bin.";
    public const string ErrorWatchFolder = "Không thấy thư mục ảnh.";
    public const string TestRunning = "Đang kiểm tra…";
    public const string TestOk = "Kết nối được: {0} — {1}";
    public const string TestUnauthorized = "Mã thiết bị không đúng hoặc đã bị thu hồi.";
    public const string TestFailed = "Không kết nối được ({0}).";
}
