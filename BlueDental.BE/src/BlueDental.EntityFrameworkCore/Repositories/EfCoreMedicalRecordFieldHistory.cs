using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Microsoft.EntityFrameworkCore;
using Volo.Abp.DependencyInjection;
using Volo.Abp.EntityFrameworkCore;

namespace BlueDental.EntityFrameworkCore.Repositories;

/// <summary>
/// A sheet stores <c>{"fieldValues": {blank id: text}}</c> (medicalRecordDraft.ts).
/// Reads one blank out of every sheet's JSON in the database rather than
/// loading the sheets: a branch keeps years of them. The LIKE leaves out the
/// sheets where the blank was never written before any JSON is parsed, and
/// <c>bd_try_jsonb</c> (migration MedicalRecordFieldSuggestionsR1219) reads a
/// sheet whose content is not JSON as nothing instead of failing the query.
/// </summary>
public class EfCoreMedicalRecordFieldHistory : IMedicalRecordFieldHistory, ITransientDependency
{
    private readonly IDbContextProvider<BlueDentalDbContext> _dbContextProvider;

    public EfCoreMedicalRecordFieldHistory(IDbContextProvider<BlueDentalDbContext> dbContextProvider)
    {
        _dbContextProvider = dbContextProvider;
    }

    public async Task<List<string>> GetCommonValuesAsync(
        Guid clinicBranchId, MedicalRecordForm form, string fieldId, int minPatients, int maxLength, int limit)
    {
        var dbContext = await _dbContextProvider.GetDbContextAsync();
        var formCode = (short)form;
        var quotedKey = $"%\"{fieldId}\"%";

        return await dbContext.Database
            .SqlQuery<string>($"""
                SELECT v."Text" AS "Value"
                FROM (
                    SELECT btrim(bd_try_jsonb(r."Content") -> 'fieldValues' ->> {fieldId}) AS "Text", r."PatientId"
                    FROM bd_patient_medical_records r
                    WHERE r."ClinicBranchId" = {clinicBranchId}
                      AND r."Form" = {formCode}
                      AND NOT r."IsDeleted"
                      AND r."CancelledAt" IS NULL
                      AND r."Content" LIKE {quotedKey}
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
