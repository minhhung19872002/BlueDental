using System;
using System.Linq;
using System.Threading.Tasks;
using BlueDental.PatientManagement;
using Shouldly;
using Volo.Abp;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Uow;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.PatientManagement;

/// <summary>
/// F-98 Thư mục on real PostgreSQL with the real migration: a folder and the
/// pictures filed in it round-trip, the column's root reads only unfiled
/// pictures, and a folder removed from the table hands its pictures back.
/// </summary>
public class PatientImageFolderPersistenceTests : BlueDentalPostgresTestBase
{
    protected override void SetAbpApplicationCreationOptions(AbpApplicationCreationOptions options) =>
        options.UseAutofac();

    [Fact]
    public async Task A_Folder_And_Its_Pictures_Round_Trip()
    {
        var (patientId, branchId) = (Guid.NewGuid(), Guid.NewGuid());
        var folder = PatientImageFolder.Create(Guid.NewGuid(), patientId, branchId, PatientImageType.During, "  Lấy cao   răng ");
        var filed = Picture(patientId, branchId, PatientImageType.During, ordering: 2);
        var loose = Picture(patientId, branchId, PatientImageType.During, ordering: 1);
        filed.FileInto(folder);

        await WithUnitOfWorkAsync(async () =>
        {
            await Folders.InsertAsync(folder, autoSave: true);
            await Images.InsertManyAsync([filed, loose], autoSave: true);
        });

        var stored = await WithUnitOfWorkAsync(() => Folders.GetAsync(folder.Id));
        stored.Name.ShouldBe("Lấy cao răng");
        stored.Type.ShouldBe(PatientImageType.During);

        var inFolder = await WithUnitOfWorkAsync(() => Images.GetListAsync(x => x.FolderId == folder.Id));
        inFolder.Select(x => x.Id).ShouldBe([filed.Id]);

        var atRoot = await WithUnitOfWorkAsync(() =>
            Images.GetListAsync(x => x.PatientId == patientId && x.FolderId == null));
        atRoot.Select(x => x.Id).ShouldBe([loose.Id]);
    }

    [Fact]
    public async Task A_Folder_Row_Gone_From_The_Table_Sets_Its_Pictures_Free()
    {
        var (patientId, branchId) = (Guid.NewGuid(), Guid.NewGuid());
        var folder = PatientImageFolder.Create(Guid.NewGuid(), patientId, branchId, PatientImageType.Before, "Tạm");
        var picture = Picture(patientId, branchId, PatientImageType.Before, ordering: 1);
        picture.FileInto(folder);

        await WithUnitOfWorkAsync(async () =>
        {
            await Folders.InsertAsync(folder, autoSave: true);
            await Images.InsertAsync(picture, autoSave: true);
        });

        // The app deletes softly and frees the pictures itself; the foreign key's
        // ON DELETE SET NULL is the backstop when a row is ever removed for good.
        PostgresTestDatabase.Execute($"DELETE FROM bd_patient_image_folders WHERE \"Id\" = '{folder.Id}'");

        var reloaded = await WithUnitOfWorkAsync(() => Images.GetAsync(picture.Id));
        reloaded.FolderId.ShouldBeNull();
    }

    private IRepository<PatientImageFolder, Guid> Folders => GetRequiredService<IRepository<PatientImageFolder, Guid>>();
    private IRepository<PatientImage, Guid> Images => GetRequiredService<IRepository<PatientImage, Guid>>();

    private static PatientImage Picture(Guid patientId, Guid branchId, PatientImageType type, int ordering) =>
        PatientImage.Attach(
            Guid.NewGuid(), patientId, branchId,
            $"patients/{patientId}/{ordering}.png", $"{ordering}.png", "image/png", 1024,
            Guid.NewGuid(), DateTimeOffset.UtcNow, type: type, ordering: ordering);

    private async Task<T> WithUnitOfWorkAsync<T>(Func<Task<T>> action)
    {
        using var uow = GetRequiredService<IUnitOfWorkManager>().Begin(requiresNew: true);
        var result = await action();
        await uow.CompleteAsync();
        return result;
    }

    private Task WithUnitOfWorkAsync(Func<Task> action) =>
        WithUnitOfWorkAsync(async () => { await action(); return true; });
}
