namespace BlueDental.Labo;

/// <summary>
/// Which Đặt hàng form wrote the order (F-91). It decides what Tạo phiếu Labo
/// requires, which print sheet the order uses and how it reads back.
/// </summary>
public enum LaboOrderLayout : short
{
    /// <summary>The Labo v2 form: supplier, material, Mặt răng and per-tooth specs.</summary>
    Classic = 1,

    /// <summary>
    /// Phiếu yêu cầu (BA mock "bản 2 nhập mã số, không kế hoạch nhà cung cấp"):
    /// a hand-typed Mã số, Loại phục hình, a 6-zone shade map and Đường hoàn
    /// tất, entered once and stored on every tooth. No supplier, no plan line.
    /// </summary>
    RequestSlip = 2
}

/// <summary>Loại ca on the Phiếu yêu cầu: a new case, or a piece the lab makes again.</summary>
public enum LaboCaseType : short
{
    /// <summary>Ca mới.</summary>
    New = 1,

    /// <summary>Sửa / làm lại — only recorded; the order behaves as a new one.</summary>
    Redo = 2
}
