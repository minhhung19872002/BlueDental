using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Microsoft.EntityFrameworkCore;
using Volo.Abp.DependencyInjection;
using Volo.Abp.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore.Repositories;

/// <summary>
/// A sheet stores <c>{"fieldValues": {blank id: text}}</c> (medicalRecordDraft.ts);
/// a line added with Enter under a blank is stored as
/// <c>custom.line.&lt;that blank&gt;.&lt;n&gt;</c> (lineEditing.ts). Reads the
/// part's blanks out of every sheet's JSON in the database rather than loading
/// the sheets: a branch keeps years of them. The LIKE leaves out the sheets
/// where none of them was ever written before any JSON is parsed, and
/// <c>bd_try_jsonb</c> (migration MedicalRecordFieldSuggestionsR1219) reads a
/// sheet whose content is not JSON as nothing instead of failing the query.
/// A blank holding several lines counts each line on its own.
/// </summary>
public class EfCoreMedicalRecordFieldHistory : IMedicalRecordFieldHistory, ITransientDependency
{
    private readonly IDbContextProvider<BlueDentalDbContext> _dbContextProvider;

    public EfCoreMedicalRecordFieldHistory(IDbContextProvider<BlueDentalDbContext> dbContextProvider)
    {
        _dbContextProvider = dbContextProvider;
    }

    public async Task<List<string>> GetCommonValuesAsync(
        Guid clinicBranchId, MedicalRecordForm form, IReadOnlyList<string> fieldIds,
        int minPatients, int maxLength, int limit)
    {
        if (fieldIds.Count == 0)
        {
            return [];
        }

        var dbContext = await _dbContextProvider.GetDbContextAsync();
        var formCode = (short)form;
        var keys = fieldIds.ToArray();
        var addedLineKeys = keys.Select(id => $"custom.line.{id}.%").ToArray();
        var inContent = keys.Select(id => $"%\"{id}\"%")
            .Concat(keys.Select(id => $"%\"custom.line.{id}.%"))
            .ToArray();

        return await dbContext.Database
            .SqlQuery<string>($"""
                SELECT v."Text" AS "Value"
                FROM (
                    SELECT btrim(l."Line") AS "Text", r."PatientId"
                    FROM bd_patient_medical_records r
                    CROSS JOIN LATERAL (SELECT bd_try_jsonb(r."Content") -> 'fieldValues' AS "Values") j
                    CROSS JOIN LATERAL jsonb_each_text(
                        CASE WHEN jsonb_typeof(j."Values") = 'object' THEN j."Values" ELSE jsonb_build_object() END
                    ) f("Key", "Value")
                    CROSS JOIN LATERAL regexp_split_to_table(f."Value", '\r?\n') l("Line")
                    WHERE r."ClinicBranchId" = {clinicBranchId}
                      AND r."Form" = {formCode}
                      AND NOT r."IsDeleted"
                      AND r."CancelledAt" IS NULL
                      AND r."Content" LIKE ANY ({inContent})
                      AND (f."Key" = ANY ({keys}) OR f."Key" LIKE ANY ({addedLineKeys}))
                ) v
                WHERE v."Text" <> '' AND char_length(v."Text") <= {maxLength}
                GROUP BY v."Text"
                HAVING count(DISTINCT v."PatientId") >= {minPatients}
                ORDER BY count(DISTINCT v."PatientId") DESC, v."Text"
                LIMIT {limit}
                """)
            .ToListAsync();
    }
}
