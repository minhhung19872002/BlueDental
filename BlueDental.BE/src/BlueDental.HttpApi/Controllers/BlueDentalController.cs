using System;
using BlueDental.Localization;
using Microsoft.AspNetCore.Mvc;
using Volo.Abp.AspNetCore.Mvc;

namespace BlueDental.Controllers;

/// <summary>
/// Base controller for all BlueDental API controllers.
/// Inherits ABP conventions (localization, current user injection, etc.).
/// </summary>
public abstract class BlueDentalController : AbpControllerBase
{
    private const string ExcelContentType =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    protected BlueDentalController()
    {
        LocalizationResource = typeof(BlueDentalResource);
    }

    /// <summary>
    /// Returns a workbook as a download. The name carries the date so a clinic
    /// exporting the same report twice does not overwrite yesterday's file.
    /// </summary>
    protected IActionResult Excel(byte[] content, string name) =>
        File(content, ExcelContentType, $"{name}-{DateTime.Now:yyyyMMdd-HHmm}.xlsx");

    protected IActionResult Pdf(byte[] content, string name) =>
        File(content, "application/pdf", $"{name}.pdf");
}
