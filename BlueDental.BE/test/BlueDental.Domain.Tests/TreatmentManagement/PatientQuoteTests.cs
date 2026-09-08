using System;
using System.Linq;
using BlueDental.TreatmentManagement;
using Shouldly;
using Volo.Abp;
using Xunit;

namespace BlueDental.Domain.Tests.TreatmentManagement;

public class PatientQuoteTests
{
    private static readonly Guid Patient = Guid.NewGuid();
    private static readonly Guid Branch = Guid.NewGuid();

    private static PatientQuote Raise(int ordinal, params Guid[] adviseIds) =>
        PatientQuote.Raise(
            Guid.NewGuid(),
            Patient,
            Branch,
            ordinal,
            adviseIds.Select((id, index) => new PatientQuoteLine(id, true, index + 1)));

    [Fact]
    public void Raise_Should_Keep_The_Lines_It_Was_Given()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();

        var quote = Raise(1, first, second);

        quote.Ordinal.ShouldBe(1);
        quote.Lines.Select(line => line.AdviseId).ShouldBe(new[] { first, second });
        quote.Lines.ShouldAllBe(line => line.IsSelected);
    }

    [Fact]
    public void Raise_Should_Refuse_A_Number_Below_One()
    {
        Should.Throw<BusinessException>(() => Raise(0, Guid.NewGuid()));
    }

    [Fact]
    public void Raise_Should_Refuse_An_Empty_Quote()
    {
        Should.Throw<BusinessException>(() => Raise(1));
    }

    [Fact]
    public void A_Line_Must_Name_A_Consulting_Line()
    {
        Should.Throw<BusinessException>(() => new PatientQuoteLine(Guid.Empty, true, 1));
    }

    /// <summary>
    /// The stored order is renumbered 1..N, so it never carries gaps or ties —
    /// the same rule the consulting list follows, and for the same reason: a
    /// tie makes a dragged order look like it half-applied.
    /// </summary>
    [Fact]
    public void SetLines_Should_Renumber_From_One_In_The_Order_Given()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var quote = Raise(1, first, second);

        quote.SetLines(new[]
        {
            new PatientQuoteLine(second, true, 40),
            new PatientQuoteLine(first, false, 90)
        });

        quote.Lines.Select(line => line.SortOrder).ShouldBe(new[] { 1, 2 });
        quote.Lines.Select(line => line.AdviseId).ShouldBe(new[] { second, first });
        quote.Lines.Single(line => line.AdviseId == first).IsSelected.ShouldBeFalse();
    }

    [Fact]
    public void SetLines_Should_Refuse_The_Same_Consulting_Line_Twice()
    {
        var advise = Guid.NewGuid();
        var quote = Raise(1, advise);

        Should.Throw<BusinessException>(() => quote.SetLines(new[]
        {
            new PatientQuoteLine(advise, true, 1),
            new PatientQuoteLine(advise, false, 2)
        }));
    }

    [Fact]
    public void SetLines_Should_Refuse_Emptying_The_Quote()
    {
        var quote = Raise(1, Guid.NewGuid());

        Should.Throw<BusinessException>(() => quote.SetLines(Array.Empty<PatientQuoteLine>()));
    }

    [Fact]
    public void CopyLines_Should_Hand_Back_The_Same_Set_Ticks_And_Order()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var quote = Raise(1, first, second);
        quote.SetLines(new[]
        {
            new PatientQuoteLine(first, false, 1),
            new PatientQuoteLine(second, true, 2)
        });

        var copy = quote.CopyLines().ToList();

        copy.Select(line => line.AdviseId).ShouldBe(new[] { first, second });
        copy.Select(line => line.IsSelected).ShouldBe(new[] { false, true });
        copy.Select(line => line.SortOrder).ShouldBe(new[] { 1, 2 });
    }
}
