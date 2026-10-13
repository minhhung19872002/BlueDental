using System;
using System.Collections.Generic;
using System.Linq.Expressions;

namespace BlueDental.Appointments;

/// <summary>
/// The reception board's doctor priority: a visit ranks by where its dentist
/// stands in the picked list. Built as a chain of CASE branches so the database
/// sorts it and paging stays correct.
/// </summary>
internal static class DentistPriorityOrder
{
    public static Expression<Func<Appointment, int>> RankOf(IReadOnlyList<Guid> dentistIds)
    {
        var appointment = Expression.Parameter(typeof(Appointment), "a");
        var dentistId = Expression.Property(appointment, nameof(Appointment.DentistId));

        Expression rank = Expression.Constant(dentistIds.Count);
        for (var i = dentistIds.Count - 1; i >= 0; i--)
        {
            rank = Expression.Condition(
                Expression.Equal(dentistId, Expression.Constant(dentistIds[i])),
                Expression.Constant(i),
                rank);
        }

        return Expression.Lambda<Func<Appointment, int>>(rank, appointment);
    }
}
