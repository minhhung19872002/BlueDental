using System;

namespace BlueDental.Catalogs;

/// <summary>
/// One row of the stage table as the dialog (or the Excel importer) sends it to
/// <see cref="CatalogEntry.SyncStages"/>. <see cref="Id"/> is <see cref="Guid.Empty"/>
/// for a row that has not been saved yet.
/// </summary>
public readonly record struct CatalogStageRow(
    Guid Id,
    string Name,
    decimal Value,
    ServiceStageValueType ValueType,
    bool IsMarketingSalary);
