using System.Collections.Generic;
using System.Linq;
using Volo.Abp.Domain.Values;

namespace BlueDental.Values;

/// <summary>
/// Value object base that actually compares by value.
///
/// ABP's <see cref="ValueObject"/> declares <c>GetAtomicValues()</c> but does not
/// override <see cref="object.Equals(object)"/>, so plain subclasses still compare
/// by reference. Deriving from this class restores the DDD semantics.
/// </summary>
public abstract class ComparableValueObject : ValueObject
{
    public override bool Equals(object? obj)
    {
        if (obj is null || obj.GetType() != GetType())
        {
            return false;
        }

        var other = (ComparableValueObject)obj;
        return GetAtomicValues().SequenceEqual(other.GetAtomicValues());
    }

    public override int GetHashCode()
    {
        var hash = new HashCode();

        foreach (var value in GetAtomicValues())
        {
            hash.Add(value);
        }

        return hash.ToHashCode();
    }

    public static bool operator ==(ComparableValueObject? left, ComparableValueObject? right)
        => left is null ? right is null : left.Equals(right);

    public static bool operator !=(ComparableValueObject? left, ComparableValueObject? right)
        => !(left == right);
}
