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
.nfc-tpl .nfc-medical-record-text-field{display:inline-block;min-width:72px;min-height:1.3em;line-height:1.3;padding:0 3px;white-space:pre-wrap;overflow-wrap:anywhere;border-bottom:1px dotted #000;background:#fffde7;outline:1px dashed #f4b942;vertical-align:baseline}
.nfc-tpl .nfc-medical-record-text-field[data-field-full-width="true"]{display:inline-block;width:100%;max-width:none;box-sizing:border-box}
/* Saved medical-record templates may still carry a large inline min-width.
   Inside table cells, the cell must remain the width boundary. */
.nfc-tpl td .nfc-medical-record-text-field[data-field-full-width="true"],.nfc-tpl th .nfc-medical-record-text-field[data-field-full-width="true"]{min-width:0!important;max-width:100%!important}
/* TipTap appends a trailing <br> to otherwise empty inline nodes. Keep a DOM
   fallback so already-open/saved medical records become full width even before
   their explicit data-field-full-width marker is persisted. */
.nfc-tpl p:has(>.nfc-medical-record-text-field:first-child):has(>br.ProseMirror-trailingBreak:last-child)>.nfc-medical-record-text-field:not([data-field-full-width="false"]),
.nfc-tpl h2:has(>.nfc-medical-record-text-field:first-child):has(>br.ProseMirror-trailingBreak:last-child)>.nfc-medical-record-text-field:not([data-field-full-width="false"]){display:inline-block;width:100%;max-width:none;box-sizing:border-box}
.nfc-tpl .nfc-medical-record-text-field:empty::before{content:attr(data-placeholder);color:#9ca3af;font-style:italic}
.nfc-tpl .nfc-medical-record-text-field[data-placeholder="Nhập nội dung"]:empty::before{content:''}
.nfc-tpl .nfc-medical-record-text-field:focus{background:#fff9c4;outline:2px solid #f59e0b}
.nfc-tpl .nfc-medical-record-checkbox{width:15px;height:15px;margin:0 3px;vertical-align:-2px;accent-color:#2671d8;cursor:pointer}
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
.nfc-tpl img{max-width:100%}`;

/*
 * The frame around the sheet: A4 at 210x297mm with a 12mm margin, one white
 * page on a grey ground, and `<hr>` between pages — a dashed rule on screen,
 * a page break on paper. Also the three field states the reference draws:
 * filled (blue on pale blue), suggested from the record (amber outline), and
 * both flattened to plain black when printing.
 */
export const SHEET_PAGE_CSS = String.raw`    html,body{margin:0;min-height:100%;background:#f0f0f0}
    body{padding:20px;box-sizing:border-box}
    .nfc-tpl{width:210mm;min-height:297mm;margin:0 auto;padding:12mm;box-sizing:border-box;background:#fff;box-shadow:0 0 10px rgba(0,0,0,.1)}
    .nfc-tpl>hr{margin:28px 0;border:0;border-top:2px dashed #b7c0ce}
    
  .nfc-tpl .nfc-medical-record-text-field:not(:empty){color:#1769E0;background:#EAF2FD}
  .nfc-tpl .nfc-medical-record-text-field:focus{outline-width:1px}
  .nfc-tpl [data-medical-record-suggested="true"]{outline:1px solid #f59e0b!important;outline-offset:1px}
  @media print{
    .nfc-tpl .nfc-medical-record-text-field:not(:empty){color:#000!important;background:transparent!important}
    .nfc-tpl [data-medical-record-suggested="true"]{outline:none!important}
  }

    @page{size:A4;margin:0}
    @media print{
      html,body{width:210mm;height:auto!important;min-height:0!important;margin:0;padding:0;background:#fff}
      .nfc-tpl{width:210mm;height:auto;min-height:0;margin:0;padding:12mm;box-shadow:none}
      .nfc-tpl>hr{height:0;margin:0;border:0;break-after:page;page-break-after:always}
    }
  `;
