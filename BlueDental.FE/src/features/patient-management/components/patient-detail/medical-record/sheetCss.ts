/*
 * The stylesheet the A4 sheets are drawn with, measured off the reference's
 * own preview frame (staging, 2026-09-09).
 *
 * It lives inside the sheet's iframe, not in the app: the document is Times
 * New Roman at a fixed 13px on a 210mm page, and any of BlueDental's own CSS
 * reaching it would move the layout off the printed original.
 *
 * String.raw, because the sheet relies on CSS escapes such as a non-breaking
 * space in a ::before.
 */
export const SHEET_CSS = String.raw`
    
.nfc-tpl{font-family:'Times New Roman',Times,serif;font-size:13px;color:#000;line-height:1.5}
.nfc-tpl p{margin:0 0 4px;white-space:pre-wrap;line-height:1.5}
.nfc-tpl ul{list-style:disc outside;margin:0 0 4px;padding-left:1.5em}
.nfc-tpl ol{list-style:decimal outside;margin:0 0 4px;padding-left:1.5em}
/* A number of legacy medical-record templates use heading tags for section
   labels. Give them an explicit document scale instead of the browser's
   default heading scale, which made those labels unexpectedly oversized. */
.nfc-tpl h2{margin:8px 0 4px;font-size:15px;line-height:1.35}
.nfc-tpl h3{margin:6px 0 4px;font-size:14px;line-height:1.35}
/* Keep blank lines (empty <p> added with Enter) at a full line's height. */
.nfc-tpl p:empty{min-height:1.5em}
.nfc-tpl p:empty::before{content:"\00a0"}
.nfc-tpl strong{font-weight:bold}
.nfc-tpl [data-page-break="true"]{display:block;break-after:page;page-break-after:always}
.nfc-tpl table{border-collapse:collapse;table-layout:fixed;width:100%;margin:6px 0}
/* Explicit outer border too, so the frame survives any copied CSS reset that
   zeroes border-width in the print iframe. */
.nfc-tpl table:not([data-borderless]){border:1px solid #000}
.nfc-tpl td,.nfc-tpl th{border:1px solid #000;padding:4px 8px;vertical-align:top;word-wrap:break-word}
.nfc-tpl th{font-weight:600}
.nfc-tpl table[data-borderless],.nfc-tpl table[data-borderless] td,.nfc-tpl table[data-borderless] th{border:none;padding:2px 6px}
.nfc-tpl table[data-record-page="outpatient-main"],.nfc-tpl table[data-record-page="outpatient-figure"]{border:0;margin:0}
.nfc-tpl table[data-record-page="outpatient-main"]>tbody>tr>td,.nfc-tpl table[data-record-page="outpatient-figure"]>tbody>tr>td{border:0;padding:0}
.nfc-tpl table[data-record-page^="outpatient"] h1{font-size:21px;line-height:1.25;margin:6px 0;text-align:center}
.nfc-tpl table[data-record-page^="outpatient"] h2{font-size:15px;line-height:1.25;margin:8px 0 4px}
.nfc-tpl table[data-record-page^="outpatient"] p{line-height:1.35;margin-bottom:3px}
.nfc-tpl table[data-record-section="layout"]{border:0;margin:0}
.nfc-tpl table[data-record-section="layout"]>tbody>tr>td{border:0;padding:1px 4px}
.nfc-tpl table[data-record-section="general-exam"]{border:0;margin:0}
.nfc-tpl table[data-record-section="general-exam"]>tbody>tr>td{border:0;padding:1px 4px}
.nfc-tpl table[data-record-section="general-exam"]>tbody>tr>td:nth-child(-n+2)>p{display:flex;align-items:center;justify-content:flex-start;gap:6px;margin-bottom:2px}
.nfc-tpl table[data-record-section="general-exam"] .nfc-medical-record-checkbox{flex:none;margin:0 0 0 auto}
.nfc-tpl table[data-record-section="signature"]{border:0;margin:18px 0 0}
.nfc-tpl table[data-record-section="signature"]>tbody>tr>td{border:0;padding:2px 16px}
.nfc-tpl table[data-record-section="vitals"]{margin:0}
.nfc-tpl table[data-record-section="vitals"] td{padding:4px 8px}
.nfc-tpl table[data-record-section="outpatient-summary-title"]{border:0;margin:0}
.nfc-tpl table[data-record-section="outpatient-summary-title"]>tbody>tr>td{border:0;padding:0}
.nfc-tpl table[data-record-section="outpatient-summary-title"] h1{font-size:21px;line-height:1.25;margin:0;text-align:left}
.nfc-tpl table[data-record-page="outpatient-summary"]{margin:0}
.nfc-tpl table[data-record-page="outpatient-summary"]>tbody>tr:last-child>td{padding:0}
.nfc-tpl table[data-record-section="diagnosis-code"]{margin:22px 0 0}
.nfc-tpl table[data-record-section="diagnosis-code"] td{height:16px;padding:0}
.nfc-tpl table[data-record-section="summary-files"]{border:0;margin:0}
.nfc-tpl table[data-record-section="summary-files"] td,.nfc-tpl table[data-record-section="summary-files"] th{padding:2px 8px;line-height:1.2}
/* Mẫu 5 — Phiếu tư vấn và xác nhận đồng ý điều trị, laid out as the clinic's
   paper copy (2026-10-16): the title on one line, one text line to a table
   row, a narrow label column, so I–IV fit on the first page. */
.nfc-tpl h1[data-record-section="consultation-title"]{margin:12px 0 8px;line-height:1.2}
.nfc-tpl table[data-record-section="consultation-methods"]{margin:0}
.nfc-tpl table[data-record-section="consultation-methods"] td{padding:0 6px}
.nfc-tpl table[data-record-section="consultation-methods"] p{margin:0;line-height:1.2}
.nfc-tpl table[data-record-section="consultation-detail"],.nfc-tpl table[data-record-section="consultation-cost"]{margin:2px 0 4px}
.nfc-tpl table[data-record-section="consultation-detail"] td,.nfc-tpl table[data-record-section="consultation-detail"] th,.nfc-tpl table[data-record-section="consultation-cost"] td,.nfc-tpl table[data-record-section="consultation-cost"] th{padding:1px 8px;vertical-align:middle}
.nfc-tpl table[data-record-section="consultation-detail"] th{font-weight:normal;text-align:left}
.nfc-tpl table[data-record-section="consultation-detail"] p,.nfc-tpl table[data-record-section="consultation-cost"] p{margin:0;line-height:1.2}
/* All nine forms, after mẫu 5 (clinic, 2026-10-16):
   - each prints at the largest type (17px at most) whose every page fits
     its sheet of A4 with a few mm to spare, measured through the app's own
     print path (docs/testing/03-regression-log.md R-970); the section
     headings at the body's size;
   - a heading right above a table sits close to it, and a grid's rows hold
     one text line;
   - a blank in a grid cell prints with no dotted line — the cell's borders
     already say where to write. renderSheet marks those cells; a table that
     only lays the page out is not one, and its blanks keep the line. */
.nfc-tpl[data-form="1"]{font-size:17px}
.nfc-tpl[data-form="7"]{font-size:16.5px}
.nfc-tpl[data-form="4"],.nfc-tpl[data-form="5"],.nfc-tpl[data-form="6"]{font-size:16px}
.nfc-tpl[data-form="9"]{font-size:15.5px}
.nfc-tpl[data-form="3"]{font-size:15px}
.nfc-tpl[data-form="8"]{font-size:14px}
.nfc-tpl[data-form="2"]{font-size:13.5px}
.nfc-tpl h2{font-size:1em}
.nfc-tpl h2 span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl>h2{margin:6px 0 2px}
.nfc-tpl>p{margin-bottom:2px}
.nfc-tpl>:is(p,h2):has(+table){margin-bottom:0}
.nfc-tpl>:is(p,h2)+table{margin-top:1px}
.nfc-tpl [data-grid-cell] p,.nfc-tpl [data-grid-cell] .nfc-medical-record-text-field{line-height:1.2;min-height:1.2em}
.nfc-tpl p[data-record-section="consultation-other"]{padding-left:6px}
/* A part shown only for a ticked box (sheetSections): gone while unticked. */
.nfc-tpl [hidden]{display:none!important}
/* "Loại" on mẫu 5 (materials/materialField): the types of Danh mục as boxes in
   a row, a round ⊕ after them; a double click on a type corrects it. */
.nfc-tpl .nfc-material-field{display:inline-flex;flex-wrap:wrap;align-items:center;gap:2px 14px;vertical-align:middle}
.nfc-tpl .nfc-material-option{display:inline-flex;align-items:center;gap:2px;cursor:pointer;user-select:none;white-space:nowrap}
/* The + inside is drawn, not typed: a "+" glyph sits on the font's math axis,
   below the circle's middle, and shifts with the font. */
.nfc-tpl .nfc-material-add{position:relative;display:inline-block;box-sizing:border-box;width:20px;height:20px;padding:0;border:1.5px solid #334155;border-radius:50%;background:linear-gradient(currentColor,currentColor) center/9px 1.5px no-repeat,linear-gradient(currentColor,currentColor) center/1.5px 9px no-repeat,#fff;color:#334155;cursor:pointer}
.nfc-tpl .nfc-material-add:hover,.nfc-tpl .nfc-material-add:focus-visible{border-color:#2671d8;color:#2671d8}
.nfc-tpl .nfc-material-add[data-tooltip]::after{content:attr(data-tooltip);position:absolute;top:calc(100% + 6px);left:0;z-index:2;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.85);color:#fff;font:400 12px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .12s}
.nfc-tpl .nfc-material-add[data-tooltip]:hover::after,.nfc-tpl .nfc-material-add[data-tooltip]:focus-visible::after{opacity:1}
/* Taken in like mẫu 5 (renderSheet marks the gaps): an empty paragraph is a
   3px gap, a title loses its padding lines, and a paragraph runs at 1.3 —
   the templates' inline 1.5 included. Grid cells keep their own 1.2 and the
   cover, a fixed frame, is left as drawn. */
.nfc-tpl p[data-spacer]{min-height:0;height:3px;margin:0;line-height:0;overflow:hidden}
.nfc-tpl p[data-spacer]::before{content:none}
.nfc-tpl h1:not([data-cover] *){margin:10px 0 6px;line-height:1.2!important}
.nfc-tpl p:not(:is([data-cover],[data-grid-cell]) *){line-height:1.3!important}
@media print{
  .nfc-tpl [data-grid-cell] .nfc-medical-record-text-field{border-bottom:0!important}
  .nfc-tpl .nfc-material-add{display:none}
}
/* Compact table: columns size to content and the block is pulled out of the
   normal flow to the right corner, so anything written after it (ví dụ khối lịch
   hẹn) flows in the free space on its LEFT instead of being pushed below.
   Trước đây chỉ dùng margin-left:auto — bảng vẫn là block chiếm cả dòng nên
   không thể đặt gì cạnh nó. renderPaymentTemplate strips the editor's baked-in
   column widths so this needs no !important. */
.nfc-tpl table[data-compact]{width:auto;table-layout:auto;float:right;clear:right;margin:6px 0 6px 12px}
.nfc-tpl table[data-compact] td,.nfc-tpl table[data-compact] th{padding:1px 6px;white-space:nowrap}
/* Bảng thường (bảng dịch vụ, khối ký tên) luôn xuống dòng mới, không quấn quanh
   bảng gọn đang float. */
.nfc-tpl table:not([data-compact]){clear:both}
/* A4 cover frame used by the clinic medical-record bundle. The direct cell is
   page-height; nested tables remain ordinary editable layout/content tables. */
.nfc-tpl table[data-cover]{min-height:250mm;margin:0 0 18px;border:4px solid #000}
.nfc-tpl table[data-cover]>tbody>tr>td{height:250mm;border:4px solid #000;padding:8mm 9mm;vertical-align:top;font-size:12pt}
/* Per-table border width authored in TipTap. These rules come after the form
   defaults so an explicit editor choice also wins for cover/layout tables. */
.nfc-tpl table[data-border-width="1"]{--nfc-table-border-width:1px}
.nfc-tpl table[data-border-width="2"]{--nfc-table-border-width:2px}
.nfc-tpl table[data-border-width="3"]{--nfc-table-border-width:3px}
.nfc-tpl table[data-border-width="4"]{--nfc-table-border-width:4px}
.nfc-tpl table[data-border-width="5"]{--nfc-table-border-width:5px}
.nfc-tpl table[data-border-width]:not([data-borderless]){border-style:solid;border-color:#000;border-width:var(--nfc-table-border-width)}
.nfc-tpl table[data-border-width]:not([data-borderless])>tbody>tr>td,.nfc-tpl table[data-border-width]:not([data-borderless])>tbody>tr>th,.nfc-tpl table[data-border-width]:not([data-borderless])>thead>tr>td,.nfc-tpl table[data-border-width]:not([data-borderless])>thead>tr>th{border-style:solid;border-color:#000;border-width:var(--nfc-table-border-width)}
.nfc-tpl table[data-cover] h1{margin:0;font-size:29pt;line-height:1.35}
.nfc-tpl table[data-cover] h2{margin:0;font-size:29pt;line-height:1.35}
.nfc-tpl table[data-cover] h3{margin:4px 0 0;font-size:18pt;line-height:1.35}
.nfc-tpl table[data-cover] h4{margin:0;font-size:11pt;line-height:1.45}
.nfc-tpl table[data-cover] p{margin-bottom:6px;line-height:1.5}
.nfc-tpl .nfc-medical-record-text-field{display:inline-block;min-width:72px;min-height:1.2em;line-height:1.2;padding:0 3px;white-space:pre-wrap;overflow-wrap:anywhere;border-bottom:1px dotted #000;background:#fffde7;outline:1px dashed #f4b942;vertical-align:baseline}
.nfc-tpl .nfc-medical-record-text-field[data-field-full-width="true"]{display:inline-block;width:100%;max-width:none;box-sizing:border-box}
/* Saved medical-record templates may still carry a large inline min-width.
   Inside table cells, the cell must remain the width boundary. */
.nfc-tpl td .nfc-medical-record-text-field[data-field-full-width="true"],.nfc-tpl th .nfc-medical-record-text-field[data-field-full-width="true"]{min-width:0!important;max-width:100%!important}
/* TipTap appends a trailing <br> to otherwise empty inline nodes. Keep a DOM
   fallback so already-open/saved medical records become full width even before
   their explicit data-field-full-width marker is persisted. */
.nfc-tpl p:has(>.nfc-medical-record-text-field:first-child):has(>br.ProseMirror-trailingBreak:last-child)>.nfc-medical-record-text-field:not([data-field-full-width="false"]),
.nfc-tpl h2:has(>.nfc-medical-record-text-field:first-child):has(>br.ProseMirror-trailingBreak:last-child)>.nfc-medical-record-text-field:not([data-field-full-width="false"]){display:inline-block;width:100%;max-width:none;box-sizing:border-box}
/* "Tôi đã được Bác sĩ …" on the consent form: the treating doctor in bold (clinic, P1810). */
.nfc-tpl [data-medical-record-field="consultation.text.53"]{font-weight:700}
.nfc-tpl .nfc-medical-record-text-field:empty::before{content:attr(data-placeholder);color:#9ca3af;font-style:italic}
.nfc-tpl .nfc-medical-record-text-field[data-placeholder="Nhập nội dung"]:empty::before{content:''}
.nfc-tpl .nfc-medical-record-text-field:focus{background:#fff9c4;outline:2px solid #f59e0b}
/* The paper's small boxes (clinic, 2026-10-16, after mẫu 5). */
.nfc-tpl .nfc-medical-record-checkbox{width:12px;height:12px;margin:0 3px;vertical-align:-1px;accent-color:#2671d8;cursor:pointer}
@media print{
  .nfc-tpl{break-after:auto;page-break-after:auto}
  .nfc-tpl h1,.nfc-tpl h2,.nfc-tpl h3,.nfc-tpl h4,.nfc-tpl h5,.nfc-tpl h6,.nfc-tpl p,.nfc-tpl li{break-inside:avoid-page;page-break-inside:avoid}
  .nfc-tpl tr{break-inside:avoid-page;page-break-inside:avoid}
  .nfc-tpl [data-page-break="true"]{height:0;margin:0;border:0}
  .nfc-tpl .nfc-medical-record-text-field{
    border-bottom:1px dotted #000!important;
    background:transparent;
    outline:none
  }
  .nfc-tpl .nfc-medical-record-text-field:empty::before{content:''}
}
/* Đóng float lại trong phạm vi phiếu, không để nó tràn ra ngoài. */
.nfc-tpl::after{content:'';display:table;clear:both}
.nfc-tpl img{max-width:100%}
/* A drawing blank fills its cell, whose height the column beside it sets; the
   picture keeps its proportions inside it. The buttons sit on its top edge and
   never print. */
.nfc-tpl td.nfc-medical-record-drawing-cell{position:relative;padding:0}
.nfc-tpl .nfc-medical-record-drawing{position:absolute;inset:4px 8px}
.nfc-tpl:not([data-readonly]) .nfc-medical-record-drawing{background:#fffde7;outline:1px dashed #f4b942}
.nfc-tpl .nfc-medical-record-drawing-img{display:block;width:100%;height:100%;max-width:none;object-fit:contain}
.nfc-tpl .nfc-medical-record-drawing-tools{position:absolute;top:6px;right:6px;display:flex;gap:6px}
.nfc-tpl .nfc-medical-record-drawing-btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:1px solid #d0d7e2;border-radius:8px;background:#fff;color:#334155;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.nfc-tpl .nfc-medical-record-drawing-btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nfc-tpl .nfc-medical-record-drawing-btn:hover,.nfc-tpl .nfc-medical-record-drawing-btn:focus-visible{border-color:#2671d8;color:#2671d8}
.nfc-tpl .nfc-medical-record-drawing-btn--delete:hover,.nfc-tpl .nfc-medical-record-drawing-btn--delete:focus-visible{border-color:#dc2626;color:#dc2626}
.nfc-tpl .nfc-medical-record-drawing-btn[data-tooltip]::after{content:attr(data-tooltip);position:absolute;top:calc(100% + 6px);right:0;z-index:2;padding:4px 8px;border-radius:6px;background:rgba(0,0,0,.85);color:#fff;font:400 12px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .12s}
.nfc-tpl .nfc-medical-record-drawing-btn[data-tooltip]:hover::after,.nfc-tpl .nfc-medical-record-drawing-btn[data-tooltip]:focus-visible::after{opacity:1}
@media print{
  .nfc-tpl .nfc-medical-record-drawing-tools{display:none}
  .nfc-tpl:not([data-readonly]) .nfc-medical-record-drawing{background:transparent;outline:none}
}`;

/*
 * The three field states the reference draws: filled (blue on pale blue),
 * suggested from the record (amber outline), and both flattened to plain black
 * on paper. Scoped to the sheet, so it is safe wherever a sheet is drawn.
 */
const SHEET_FIELD_CSS = String.raw`
  .nfc-tpl[data-readonly="true"] .nfc-medical-record-checkbox{pointer-events:none}
  .nfc-tpl .nfc-medical-record-text-field:not(:empty){color:#1769E0;background:#EAF2FD}
  .nfc-tpl .nfc-medical-record-text-field:focus{outline-width:1px}
  .nfc-tpl [data-medical-record-suggested="true"]{outline:1px solid #f59e0b!important;outline-offset:1px}
  @media print{
    .nfc-tpl .nfc-medical-record-text-field:not(:empty){color:#000!important;background:transparent!important}
    .nfc-tpl [data-medical-record-suggested="true"]{outline:none!important}
  }`;

/*
 * What a sheet does on paper, read off the reference's own stylesheet: A4 with
 * a **5mm printer margin** and a page number at the bottom right, and a page
 * break at each `<hr>`, which is how the form marks where one of its pages
 * ends. The 7mm the sheet adds brings the first page's edge to the 12mm the
 * preview shows; every later page keeps the 5mm the printer gives it.
 *
 * The margin is the part that matters. At `margin: 0` only the first page had
 * an edge — the form's own padding is on the whole block, not on each page —
 * so everything after it ran to the very edge of the paper and tore.
 *
 * Chrome ignores the `@bottom-right` box (paged-media margin boxes are not
 * implemented); it is kept because it is what the reference ships, and it
 * costs nothing.
 *
 * A ticked box keeps the reference's blue on paper. Chrome paints
 * `accent-color` even with "Background graphics" off — measured, and the same
 * on the reference, which forces nothing — but a driver set to economy would
 * grey it out, so the tick asks for its colour explicitly. Only the tick: the
 * blue of a filled blank and the amber of a suggested one are *meant* to
 * flatten to black on paper.
 *
 * This is the part that has to travel with the sheet wherever it is printed
 * from. Printing the sheet's *frame* from outside cannot honour it: an iframe
 * is one box to the printer, and it gets sliced wherever the outer page ends,
 * through the middle of a row.
 */
const SHEET_PRINT_CSS = String.raw`
    @page{size:A4;margin:5mm;@bottom-right{content:counter(page);font-family:'Times New Roman',Times,serif;font-size:10pt;color:#000}}
    @media print{
      .nfc-tpl{width:200mm;height:auto;min-height:0;margin:0 auto;padding:7mm;box-shadow:none}
      .nfc-tpl>hr{height:0;margin:0;border:0;break-after:page;page-break-after:always}
      .nfc-tpl .nfc-medical-record-checkbox{accent-color:#2671d8;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    }`;

/*
 * The frame around the sheet inside its own document: one white A4 page on a
 * grey ground, with `<hr>` drawn as a dashed rule between pages.
 */
export const SHEET_PAGE_CSS = String.raw`    html,body{margin:0;min-height:100%;background:#f0f0f0}
    body{padding:20px;box-sizing:border-box}
    .nfc-tpl{width:210mm;min-height:297mm;margin:0 auto;padding:12mm;box-sizing:border-box;background:#fff;box-shadow:0 0 10px rgba(0,0,0,.1)}
    .nfc-tpl>hr{margin:28px 0;border:0;border-top:2px dashed #b7c0ce}
    ${SHEET_FIELD_CSS}
    @media print{html,body{width:210mm;height:auto!important;min-height:0!important;margin:0;padding:0;background:#fff}}
${SHEET_PRINT_CSS}
  `;

/**
 * Everything a sheet needs to print from the *app's* document rather than its
 * own — the copy made for the printer, as the reference does it.
 *
 * Only rules scoped to `.nfc-tpl` (plus `@page`, which is the print job's):
 * the sheet's own `html, body` rules would repaint the whole app.
 */
export const PRINT_COPY_CSS = String.raw`${SHEET_CSS}
    .nfc-tpl{width:210mm;margin:0 auto;padding:12mm;box-sizing:border-box;background:#fff}
    .nfc-tpl>hr{margin:0;border:0}
${SHEET_FIELD_CSS}
${SHEET_PRINT_CSS}
  `;
