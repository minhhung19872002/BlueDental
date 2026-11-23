using System;
using System.Threading.Tasks;
using BlueDental.Promotions;
using BlueDental.TreatmentManagement;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Volo.Abp;
using Volo.Abp.BackgroundWorkers;
using Volo.Abp.DependencyInjection;
using Volo.Abp.Domain.Repositories;
using Volo.Abp.Threading;
using Volo.Abp.Uow;
using Xunit;

namespace BlueDental.EntityFrameworkCore.Tests.Promotions;

/// <summary>
/// R-1279: "không giới hạn lượt, với không giới hạn thời gian" — a voucher with
/// no end date stores a NULL ValidTo on real PostgreSQL, and the hourly expiry
/// sweep leaves it active while a dated voucher past its end still expires.
/// </summary>
public class VoucherOpenEndedTests : BlueDentalPostgresTestBase
{
    private static readonly DateOnly LongAgo = new(2020, 1, 1);

    // Repositories take their services by property injection, which only Autofac does.
    protected override void SetAbpApplicationCreationOptions(AbpApplicationCreationOptions options) =>
        options.UseAutofac();

    [Fact]
    public async Task No_End_Date_And_No_Use_Limit_Round_Trip_As_Null()
    {
        var id = await InsertAsync(Issue("R1279OPEN", validTo: null));

        var voucher = await LoadAsync(id);
        voucher.ValidTo.ShouldBeNull();
        voucher.UsageLimit.ShouldBeNull();
        voucher.RemainingUses.ShouldBeNull();
    }

    [Fact]
    public async Task The_Expiry_Sweep_Skips_A_Voucher_With_No_End_Date()
    {
        var openId = await InsertAsync(Issue("R1279SWEEPOPEN", validTo: null));
        var datedId = await InsertAsync(Issue("R1279SWEEPDATED", validTo: LongAgo.AddDays(30)));

        await WithUnitOfWorkAsync(() => new SweepOnce(ServiceProvider).RunAsync());

        (await LoadAsync(openId)).Status.ShouldBe(VoucherStatus.Active);
        (await LoadAsync(datedId)).Status.ShouldBe(VoucherStatus.Expired);
    }

    [Fact]
    public async Task An_Unlimited_Open_Ended_Voucher_Keeps_Being_Redeemed_Years_On()
    {
        var voucher = Issue("R1279REDEEM", validTo: null);
        voucher.Publish();
        var id = await InsertAsync(voucher);
        var farFuture = new DateOnly(2099, 12, 31);

        await WithUnitOfWorkAsync(async () =>
        {
            var repository = GetRequiredService<IRepository<Voucher, Guid>>();
            var loaded = await repository.GetAsync(id);
            for (var use = 0; use < 25; use++)
                loaded.Redeem(farFuture, 1_000_000m).ShouldBe(100_000m);
            await repository.UpdateAsync(loaded, autoSave: true);
        });

        var redeemed = await LoadAsync(id);
        redeemed.UsedCount.ShouldBe(25);
        redeemed.Status.ShouldBe(VoucherStatus.Active);
        redeemed.IsAvailableFor(farFuture, 1_000_000m).ShouldBeTrue();
    }

    private static Voucher Issue(string code, DateOnly? validTo) => Voucher.Issue(
        Guid.NewGuid(), code, "Voucher R-1279", DiscountType.Percentage, 10m,
        LongAgo, validTo, VoucherScopeTarget.Treatment,
        clinicBranchId: Guid.NewGuid(), usageLimit: null);

    private async Task<Guid> InsertAsync(Voucher voucher)
    {
        await WithUnitOfWorkAsync(() =>
            GetRequiredService<IRepository<Voucher, Guid>>().InsertAsync(voucher, autoSave: true));
        return voucher.Id;
    }

    private Task<Voucher> LoadAsync(Guid id) =>
        WithUnitOfWorkAsync(() => GetRequiredService<IRepository<Voucher, Guid>>().GetAsync(id));

    private async Task<T> WithUnitOfWorkAsync<T>(Func<Task<T>> action)
    {
        using var uow = GetRequiredService<IUnitOfWorkManager>().Begin(requiresNew: true);
        var result = await action();
        await uow.CompleteAsync();
        return result;
    }

    private Task WithUnitOfWorkAsync(Func<Task> action) =>
        WithUnitOfWorkAsync(async () => { await action(); return true; });

    /// <summary>Runs the real worker body once instead of waiting for its hourly timer.</summary>
    [DisableConventionalRegistration]
    private sealed class SweepOnce(IServiceProvider services) : VoucherExpirationWorker(
        services.GetRequiredService<AbpAsyncTimer>(),
        services.GetRequiredService<IServiceScopeFactory>())
    {
        private readonly IServiceProvider _services = services;

        public Task RunAsync()
        {
            // Normally property-injected; the worker's Logger reads through it.
            LazyServiceProvider = _services.GetRequiredService<IAbpLazyServiceProvider>();
            return DoWorkAsync(new PeriodicBackgroundWorkerContext(_services));
        }
    }
}
