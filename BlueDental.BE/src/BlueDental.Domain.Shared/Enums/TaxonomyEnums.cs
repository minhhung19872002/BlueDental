namespace BlueDental.Catalogs;

/// <summary>
/// The taxonomy groups the reference application exposes on the "Danh mục"
/// screen. Each group is one sub-route: the left panel lists the groups of that
/// slug, the right panel lists the entries inside the selected group.
///
/// Values are the reference's own <c>group</c> query values
/// (<c>GET /api/v1/taxonomy/?group=...</c>) so the clone stays comparable.
/// </summary>
public static class TaxonomyGroups
{
    /// <summary>Dịch vụ — /taxonomy/service, entries carry a price.</summary>
    public const string CareService = "care_service";

    /// <summary>Chẩn đoán — /taxonomy/diagnosis.</summary>
    public const string Diagnosis = "diagnosis";

    /// <summary>Loại thuốc — /taxonomy/medicine, entries carry a price.</summary>
    public const string MedicationType = "medication_type";

    /// <summary>Dữ liệu tư vấn — /taxonomy/consulting.</summary>
    public const string ConsultingData = "consulting_data";

    /// <summary>Nguồn đến — /taxonomy/source.</summary>
    public const string Source = "source";

    /// <summary>Lịch sử bệnh — /taxonomy/history.</summary>
    public const string DiseaseHistory = "disease_history";

    /// <summary>Đơn thuốc mẫu — /taxonomy/prescription-template, entries carry content.</summary>
    public const string PrescriptionTemplate = "prescription_template";

    /// <summary>Bệnh án mẫu — /taxonomy/medical-record-template, entries carry content.</summary>
    public const string MedicalRecordTemplate = "medical_record_template";

    /// <summary>Nghề nghiệp — /taxonomy/occupation.</summary>
    public const string Occupation = "occupation";

    /// <summary>Vật tư — used by the Vật tư screen rather than Danh mục.</summary>
    public const string Supplies = "supplies";

    public static readonly string[] All =
    [
        CareService,
        Diagnosis,
        MedicationType,
        ConsultingData,
        Source,
        DiseaseHistory,
        PrescriptionTemplate,
        MedicalRecordTemplate,
        Occupation,
        Supplies
    ];

    /// <summary>Groups whose entries are priced.</summary>
    public static readonly string[] Priced = [CareService, MedicationType, Supplies];

    /// <summary>Groups whose entries carry template content.</summary>
    public static readonly string[] Templated = [PrescriptionTemplate, MedicalRecordTemplate];

    public static bool IsKnown(string group) => All.Contains(group);
}
