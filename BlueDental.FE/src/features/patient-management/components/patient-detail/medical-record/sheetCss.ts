import { SHEET_FONT_FACE_CSS, SHEET_FONT_FAMILY } from "./sheetFont";

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

${SHEET_FONT_FACE_CSS}
.nfc-tpl{font-family:${SHEET_FONT_FAMILY};font-size:13px;color:#000;line-height:1.5}
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
/* Mẫu 2 inside its 15mm margins (clinic, 2026-10-28, R-1067): the headings of
   a table laid out in columns start on the left edge with I., II., 10., 11.,
   the right column reaches the right edge — "3. Hình vẽ mô tả tổn thương"
   (outpatient-figure) is left as drawn; each vital sign holds one line, its
   blank stretching between the label and the unit, the units lined up. */
.nfc-tpl table[data-record-page="outpatient-main"] table[data-record-section="layout"]>tbody>tr>td:first-child,
.nfc-tpl table[data-record-page="outpatient-summary"] table[data-record-section="layout"]>tbody>tr>td:first-child,
.nfc-tpl table[data-record-section="general-exam"]>tbody>tr>td:first-child{padding-left:0}
.nfc-tpl table[data-record-page="outpatient-main"] table[data-record-section="layout"]>tbody>tr>td:last-child,
.nfc-tpl table[data-record-page="outpatient-summary"] table[data-record-section="layout"]>tbody>tr>td:last-child{padding-right:0}
.nfc-tpl table[data-record-section="vitals"] td>p{display:flex;align-items:baseline;gap:3px;white-space:nowrap}
.nfc-tpl table[data-record-section="vitals"] td>p>span{flex:1 1 0;min-width:0}
.nfc-tpl table[data-record-section="vitals"] td>p>span>.nfc-medical-record-text-field{width:100%;min-width:0!important;box-sizing:border-box}
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
.nfc-tpl[data-form="1"]{font-size:17.333px}
.nfc-tpl[data-form="4"],.nfc-tpl[data-form="5"]{font-size:16px}
.nfc-tpl[data-form="9"]{font-size:15.5px}
.nfc-tpl[data-form="3"]{font-size:17.333px}
.nfc-tpl[data-form="8"]{font-size:14px}
/* Mẫu 2 at the BA's 12pt (R-1268, block further down). */
.nfc-tpl[data-form="2"]{font-size:16px}
/* 14px from the clinic's own copy, inside 15mm margins (R-1073). */
.nfc-tpl[data-form="7"]{font-size:14px}
/* Mẫu 10, the clinic's contract, at the BA's Word sizes (R-1299, 2026-11-23):
   Times New Roman 13pt on Word's lines a line and a half apart (1.725), no
   space between paragraphs; the national heading 14pt, an 8pt line under it,
   both titles 15pt, the section heads at the body's size; 20mm above and
   below, 17.5mm left, 10mm right (@page orthodontic-contract); a paragraph
   runs on over a page as in Word. Still as the clinic's own copy
   (docs/mau10-mac-cai.html, 2026-11-21): each label and its blank on one
   line, the dotted blank stretching to the right margin; Bên A's company in
   bold; "Loại mắc cài" a label line over two rows of two choices lined up;
   plain Times New Roman, not the letters an eighth larger (R-1264) Word has not.
   Word sets a line's extra space under its text, CSS half of it above: the
   first line and the agreement's title (at the top of a page, after the <hr>)
   are lifted by it. Word wraps "… MẮC CÀI" that CSS fits by 0.4px, hence 1px
   less room on that heading. The signature columns centre where Word's
   table cells do, 7.5px further apart than half the line each.
   In SHEET_CSS, so the print copy draws it too. */
.nfc-tpl[data-form="10"]{--nfc-letter-height:none;font-size:17.333px}
.nfc-tpl.nfc-tpl[data-form="10"] :is(p,h1,h2){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="10"]>h1{font-size:20px}
.nfc-tpl.nfc-tpl[data-form="10"]>p:first-child{margin-top:-5px}
.nfc-tpl.nfc-tpl[data-form="10"]>p:first-child>span{font-size:18.667px!important}
.nfc-tpl.nfc-tpl[data-form="10"]>h1>span{font-size:20px!important}
.nfc-tpl.nfc-tpl[data-form="10"]>p:first-child+h1{margin-top:18.4px}
.nfc-tpl.nfc-tpl[data-form="10"]>h1+p{margin-top:1.3px}
.nfc-tpl.nfc-tpl[data-form="10"]>hr+h1{margin-top:-5.7px}
.nfc-tpl.nfc-tpl[data-form="10"]>h2:nth-of-type(5){padding-right:1px}
.nfc-tpl.nfc-tpl[data-form="10"]>h2{font-size:17.333px}
.nfc-tpl.nfc-tpl[data-form="10"]>:is(p,h2){break-inside:auto;page-break-inside:auto;orphans:2;widows:2}
.nfc-tpl.nfc-tpl[data-form="10"]>p[style*="text-indent"]:has(+h2){text-indent:.5em!important}
.nfc-tpl.nfc-tpl[data-form="10"]>table[data-record-section="signature"]{margin:13.8px 0 0}
.nfc-tpl.nfc-tpl[data-form="10"]>table[data-record-section="signature"]>tbody>tr>td{padding:0}
.nfc-tpl.nfc-tpl[data-form="10"]>table[data-record-section="signature"]>tbody>tr>td:first-child{padding-right:7.4px}
.nfc-tpl.nfc-tpl[data-form="10"]>table[data-record-section="signature"]>tbody>tr>td:last-child{padding-left:7.6px}
.nfc-tpl.nfc-tpl[data-form="10"]>table[data-record-section="signature"] td:first-child br:nth-of-type(3){display:none}
.nfc-tpl.nfc-tpl[data-form="10"] p:has(> span > .nfc-medical-record-text-field):not(:has(> input,[data-medical-record-field="orthodontic-contract.text.1"])){display:flex;align-items:baseline;gap:.3em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="10"] p:has(> span > .nfc-medical-record-text-field):not(:has(> input,[data-medical-record-field="orthodontic-contract.text.1"]))>span{flex:1 1 auto;min-width:0;white-space:pre-wrap}
.nfc-tpl.nfc-tpl[data-form="10"] p:has(> span > .nfc-medical-record-text-field):not(:has(> input,[data-medical-record-field="orthodontic-contract.text.1"]))>span>.nfc-medical-record-text-field{width:100%!important;min-width:0!important;max-width:none}
.nfc-tpl.nfc-tpl[data-form="10"] .nfc-medical-record-text-field{margin-bottom:-.8px}
.nfc-tpl[data-form="10"] [data-medical-record-field="orthodontic-contract.party-a.name"]{font-weight:700}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"]{display:grid;grid-template-columns:1.5em minmax(0,1fr) minmax(0,1fr);column-gap:1.5em;align-items:baseline;white-space:nowrap}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"]>.bracket-label{grid-column:1/-1}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"]>.bracket-opt:is(:nth-child(2),:nth-child(5)){grid-column:2}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"] .bracket-opt{display:flex;align-items:baseline;gap:.25em;min-width:0}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"] .bracket-opt>.nfc-medical-record-checkbox{flex:none;margin:0 .15em 0 0;align-self:center}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"] .bracket-opt>span:has(>.nfc-medical-record-text-field){flex:1 1 0;min-width:2.5em}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"] .bracket-opt .nfc-medical-record-text-field{width:100%!important;min-width:0!important}
/* The clinic's surgical checklists (2026-11-16): the count sheet (mẫu 12) and
   the safety checklist (mẫu 11, three columns on A4 landscape) are set at the
   BA's Word sizes further down (R-1276, R-1283). */
/* Larger letters, same pages (clinic, 2026-11-14, R-1234: "in ra giấy nhìn nó
   nhỏ", the pages kept as they are). Times New Roman's lower case stands at
   0.45 of its size; font-size-adjust draws the letters as if it stood at
   --nfc-letter-height, about an eighth larger, while the type's size — and the
   line pitch, the box heights, the spacing, all set in em — stays. Only the
   letters widen: fitBlanks shortens a line's blanks so the line still holds,
   and holdLines takes a line the letters still break down until it holds.
   Not the cover, drawn as a frame; not the titles, already large. A browser
   without font-size-adjust prints the sheet as before. */
.nfc-tpl[data-form]:not([data-form="1"]){font-size-adjust:var(--nfc-letter-height)}
.nfc-tpl{--nfc-letter-height:0.5}
.nfc-tpl h1{font-size-adjust:none}
/* An empty blank's placeholder that shows nothing stands upright: in italic,
   whose letters sit higher on the line than the blank's upright ones, the
   larger letters make the blank a pixel taller, and every line holding one. */
.nfc-tpl .nfc-medical-record-text-field:is([data-placeholder=""],[data-placeholder="Nhập nội dung"]):empty::before{font-style:normal}
.nfc-tpl h2{font-size:1em}
.nfc-tpl h2 span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl>h2{margin:6px 0 2px}
.nfc-tpl>p{margin-bottom:2px}
.nfc-tpl>:is(p,h2):has(+table){margin-bottom:0}
.nfc-tpl>:is(p,h2)+table{margin-top:1px}
.nfc-tpl [data-grid-cell] p,.nfc-tpl [data-grid-cell] .nfc-medical-record-text-field{line-height:1.2;min-height:1.2em}
.nfc-tpl p[data-record-section="consultation-other"]{padding-left:6px}
/* Mẫu 3: "Tôi … (Khách hàng tự ghi …)" and the signatures under it stand a
   line apart from the plan lines above (clinic, 2026-11-10, R-1191). */
.nfc-tpl p[data-record-section="orthodontic-agreement"]{margin-top:18px}
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
/* Mẫu 2 as the BA's Word copy (Mau-02-Benh-an-ngoai-tru-RHM.docx, 2026-11-21,
   R-1268), measured line by line against the PDF Word prints of it. Times New
   Roman at its own height (no font-size-adjust); every line 1.5 of Word's,
   i.e. 1.725 × the size, no space around paragraphs: the text and blanks 12pt,
   I.–IV. 14pt, the titles 16pt, "3. Hình vẽ" 12.5pt, "TỔNG KẾT BỆNH ÁN:"
   13.5pt, what is inside its box 11.5pt; the letterhead four bold 12pt lines
   in a wider column, the MS block's labels and blanks in Word's two tab
   stops; a checkbox line stands taller, as Word's ☐ makes it; a line left
   before the signatures; "+ Bản thân:" and its blank on one line, as "+ Gia
   đình:" (BA, 2026-11-22, R-1270). The sizes the template draws in its spans
   give way to these.
   Its second copy (Mau-02-...RHM (1).docx, R-1269): the MS block 10pt, its
   tab stops at 569 and 1703 twips.
   Toàn thân's boxes stay in a column each, on Word's right tab, so the
   checkbox margin below leaves them alone; Huyết áp's two blanks take the room
   Word's tabs give them (1278/1770 twips), three digits each (BA, 2026-11-23,
   R-1304). */
.nfc-tpl[data-form="2"]{--nfc-letter-height:none}
.nfc-tpl[data-form="2"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="2"] :is(p,h1,h2){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="2"] h2{font-size:18.667px}
.nfc-tpl.nfc-tpl[data-form="2"] h2:has(>span[style*="font-size"]){font-size:16.667px}
.nfc-tpl[data-form="2"] table[data-record-page="outpatient-main"] h1{font-size:21.333px;text-align:center}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-page="outpatient-main"] h1:has(+h1){margin-top:10.4px}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-page="outpatient-main"] h1+h1{margin-bottom:4.6px}
.nfc-tpl.nfc-tpl[data-form="2"] p:has(>input.nfc-medical-record-checkbox):not(table[data-record-section="general-exam"] *){padding:2px 0 3.7px;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="layout"]>tbody>tr>td{padding-top:0;padding-bottom:0}
.nfc-tpl.nfc-tpl[data-form="2"] .nfc-medical-record-text-field:not([data-grid-cell] *){min-height:1em}
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.80"]{min-width:426px!important}
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.81"]{min-width:349px!important}
.nfc-tpl.nfc-tpl[data-form="2"] p:not(table[data-record-section="general-exam"] *)>input.nfc-medical-record-checkbox{margin:0 .9px}
.nfc-tpl[data-form="2"] table:has(.record-ids)>colgroup>col:first-child{width:378px!important}
.nfc-tpl[data-form="2"] table:has(.record-ids)>tbody>tr>td:first-child>p{white-space:nowrap}
.nfc-tpl[data-form="2"] table:has(.record-ids)>colgroup>col:last-child{width:auto!important}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-page="outpatient-main"] p.record-ids{grid-template-columns:75.6px minmax(0,1fr);column-gap:0;row-gap:0;width:auto;margin:0 0 0 43.4px;font-size:13.333px;line-height:1.725!important}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="general-exam"]>tbody>tr>td>p{line-height:32px!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="vitals"] td>p:has([data-medical-record-field="outpatient-dental.text.26"]){gap:0}
.nfc-tpl.nfc-tpl[data-form="2"] :is([data-medical-record-field="outpatient-dental.text.26"],[data-medical-record-field="outpatient-dental.text.27"]){padding-left:1px;padding-right:1px}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="signature"]{margin:27.6px 0 0}
.nfc-tpl[data-form="2"] table[data-record-section="outpatient-summary-title"] h1{font-size:18px;text-align:left}
.nfc-tpl[data-form="2"] table[data-record-page="outpatient-summary"]>tbody>tr:first-child>td{font-size:.9583em}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-page="outpatient-summary"]>tbody>tr:first-child>td p{line-height:1.722!important}
.nfc-tpl[data-form="2"] table[data-record-page="outpatient-summary"] table[data-record-section="layout"]{width:662px!important}
.nfc-tpl[data-form="2"] table[data-record-page="outpatient-summary"] table[data-record-section="layout"]>colgroup>col:first-child{width:520px!important}
.nfc-tpl[data-form="2"] table[data-record-page="outpatient-summary"] table[data-record-section="layout"]>colgroup>col:last-child{width:142px!important}
/* The code boxes as in Word: an empty 1.5-spaced paragraph above them and one in each box, so each row is a line of the text beside it, the first on "Bệnh chính" (BA, 2026-11-22, R-1270; trHeight 255 is only a least height). */
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="diagnosis-code"]{width:116px;margin:1.722em 0 0 14.6px}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="diagnosis-code"] td{height:1.722em}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="diagnosis-code"] p{line-height:1.722!important;min-height:0}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="summary-files"]{width:100%!important}
/* Loại 40px under the Word width so "Ngày … tháng … năm …" stays on one line (R-1278); the last col (auto) takes it. */
.nfc-tpl[data-form="2"] table[data-record-section="summary-files"]>colgroup>col:nth-child(1){width:167.4px!important}
.nfc-tpl[data-form="2"] table[data-record-section="summary-files"]>colgroup>col:nth-child(2){width:75.6px!important}
.nfc-tpl[data-form="2"] table[data-record-section="summary-files"]>colgroup>col:nth-child(3){width:189px!important}
.nfc-tpl[data-form="2"] table[data-record-section="summary-files"]>colgroup>col:nth-child(4){width:auto!important}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="summary-files"] :is(td,th){line-height:1.725}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="summary-files"] :is([colwidth="208"],[colwidth="90"],[colwidth="208,90"]){vertical-align:middle}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="summary-files"] td[rowspan="3"] p{line-height:1.15!important}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-page="outpatient-summary"] table[data-record-section="layout"]{margin-bottom:4px}
.nfc-tpl.nfc-tpl[data-form="2"] h2:has(>span[style*="font-size"])+p:empty{display:none}
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.99"]{min-width:24px!important}
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.100"]{min-width:20px!important}
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.101"]{min-width:28px!important}
/* 100px, not Word's 140: Loại is 40px narrower so the date line holds (R-1278). */
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.108"]{min-width:100px!important}
/* Người nhận hồ sơ's "Họ tên ......" on one line, as in Word (R-1270). */
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.107"]{min-width:120px!important}
/* Mẫu 4 as the BA's Word copy (Mau-04-Phieu-tu-van.docx, R-1273; again 2026-11-23,
   R-1291: paragraphs 13pt, titles 15pt), as mẫu 2 above: Times New Roman at its
   own height; every line Word's 1.3 (1.495 × the size), no space around
   paragraphs or under the titles; the text and blanks 13pt, "PHIẾU TƯ VẤN" 15pt,
   "NỘI DUNG TIẾP XÚC…" 13pt, the letterhead 11pt bold on 1.5525 lines, centred in
   Word's 407px column 6px left of the margin; 10mm above the page. "Chúng tôi
   là:" in Word's tab stops — "1." and "2." at 104px, "Chức vụ:" at 378px — and
   the blanks Word draws to the right margin (both rows, Địa chỉ, Số hồ sơ y tế,
   Ngày thực hiện) stretch to it; the one after "Đã tiếp xúc…" is a line of its
   own. The signatures sit 2px into their cells (Word's cell margin) and keep
   their room to sign. */
.nfc-tpl[data-form="4"]{--nfc-letter-height:none;font-size:17.333px}
.nfc-tpl[data-form="4"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="4"] :is(p,h1,h2){line-height:1.495!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="4"]>p:first-child{display:block!important;width:407px;margin-left:-6px!important;font-size:14.667px;line-height:1.5525!important}
.nfc-tpl.nfc-tpl[data-form="4"]>h1{font-size:20px}
.nfc-tpl.nfc-tpl[data-form="4"]>h2{font-size:17.333px}
.nfc-tpl.nfc-tpl[data-form="4"]>:is(h1,h2)>br,.nfc-tpl.nfc-tpl[data-form="4"]>p[data-spacer]{display:none}
.nfc-tpl.nfc-tpl[data-form="4"]>table{margin:0}
.nfc-tpl.nfc-tpl[data-form="4"]>table>tbody>tr>td{padding-top:0;padding-bottom:0}
.nfc-tpl.nfc-tpl[data-form="4"]>table:first-of-type>tbody>tr>td:first-child{padding-left:0}
.nfc-tpl[data-form="4"]>table:first-of-type>colgroup>col:first-child{width:372px!important}
.nfc-tpl[data-form="4"]>table:first-of-type>colgroup>col:last-child{width:auto!important}
.nfc-tpl.nfc-tpl[data-form="4"]>table:first-of-type>tbody>tr:nth-child(2)>td:first-child>p{padding-left:104px}
.nfc-tpl.nfc-tpl[data-form="4"]>table:first-of-type>tbody>tr:first-child>td:first-child>p>span:first-child{flex:none;width:calc(104px - .3em)}
.nfc-tpl[data-form="4"]>p:has(+table:last-of-type)>br:last-child{display:none}
.nfc-tpl.nfc-tpl[data-form="4"]>table:last-of-type>tbody>tr>td{padding-top:2px}
.nfc-tpl.nfc-tpl[data-form="4"] p:has(>span>:is([data-medical-record-field="general-consultation.text.6"],[data-medical-record-field="general-consultation.text.7"],[data-medical-record-field="general-consultation.text.8"],[data-medical-record-field="general-consultation.text.9"],[data-medical-record-field="general-consultation.text.12"],[data-medical-record-field="general-consultation.text.13"],[data-medical-record-field="general-consultation.text.14"])){display:flex;align-items:baseline;gap:.3em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="4"] p:has(>span>:is([data-medical-record-field="general-consultation.text.6"],[data-medical-record-field="general-consultation.text.7"],[data-medical-record-field="general-consultation.text.8"],[data-medical-record-field="general-consultation.text.9"],[data-medical-record-field="general-consultation.text.12"],[data-medical-record-field="general-consultation.text.13"],[data-medical-record-field="general-consultation.text.14"]))>span:last-of-type{flex:1 1 auto;min-width:0;white-space:pre-wrap}
.nfc-tpl.nfc-tpl[data-form="4"] :is([data-medical-record-field="general-consultation.text.6"],[data-medical-record-field="general-consultation.text.7"],[data-medical-record-field="general-consultation.text.8"],[data-medical-record-field="general-consultation.text.9"],[data-medical-record-field="general-consultation.text.12"],[data-medical-record-field="general-consultation.text.13"],[data-medical-record-field="general-consultation.text.14"]){width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="4"] .nfc-medical-record-text-field{min-height:1em}
.nfc-tpl.nfc-tpl[data-form="4"] [data-medical-record-field="general-consultation.text.10"]{display:block;width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box;min-height:1.495em;line-height:1.495}
/* Mẫu 3 as the BA's Word copy (Mau-03-Ho-so-benh-nhan-chinh-nha.docx,
   2026-11-22, R-1272; again 2026-11-23, R-1290): Times New Roman at its own
   height and its own width (no font-size-adjust), 13pt on Word's 1.5 lines (1.725
   × the size), no space around paragraphs; the headings 13pt, the title 15pt,
   the letterhead 12pt bold centred in Word's 384px column with MÃ NGOẠI TRÚ
   10pt beside it. The exam tables as Word's cells: 4px over the text, the row
   its trHeight + 5px, a label on a 16.87px line and a blank on 18px under 3.07px,
   centred in the row (so no 1.2em least height on the cell's p). The ☐ lines
   stand as tall as Word's, whose tick glyph needs room above. Word's tab stops
   become grid columns: Giới tính, the TMJ ticks, Loại mắc cài; the blanks Word
   draws to the right margin stretch to it. The pages break where the BA's copy
   does — before Kích thước môi and before Thắng lưỡi; the template's old <hr>
   breaks are gone. The gaps after the tables are Word's empty lines. */
.nfc-tpl.nfc-tpl[data-form="3"]>:is(p,h1,h2,h3),.nfc-tpl.nfc-tpl[data-form="3"]>table:is(:first-of-type,:last-of-type){font-size:17.333px;font-size-adjust:none}
.nfc-tpl.nfc-tpl[data-form="3"]>:is(p,h1,h2,h3){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="3"]>:is(h1,h2) span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="3"]>h1{font-size:20px;margin:7.9px 0 4.1px}
.nfc-tpl.nfc-tpl[data-form="3"]>h2{font-size:17.333px}
.nfc-tpl.nfc-tpl[data-form="3"]>h2:nth-of-type(4){margin-top:11.73px;line-height:21.51px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>h2:nth-of-type(6){margin-top:14.23px}
.nfc-tpl.nfc-tpl[data-form="3"]>h2:nth-of-type(7){margin-top:26.88px}
.nfc-tpl.nfc-tpl[data-form="3"]>h2:nth-of-type(8){margin-top:15.07px}
.nfc-tpl.nfc-tpl[data-form="3"]>h3{margin-top:25.72px}
.nfc-tpl.nfc-tpl[data-form="3"]>h1>br,.nfc-tpl.nfc-tpl[data-form="3"]>p[data-spacer]:not(table+p),.nfc-tpl.nfc-tpl[data-form="3"]>hr,.nfc-tpl.nfc-tpl[data-form="3"]>[data-page-break]{display:none!important}
.nfc-tpl.nfc-tpl[data-form="3"]>:is(h2,h3){break-after:avoid-page;page-break-after:avoid}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>input){padding:1.9px 0 1.85px}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>span>[data-medical-record-field="orthodontic.patient.name"]){padding-top:0}
.nfc-tpl.nfc-tpl[data-form="3"]>p:is(:has(>input[data-medical-record-field="orthodontic.checkbox.1"]),:has(>input[data-medical-record-field="orthodontic.checkbox.6"]),:has(>input[data-medical-record-field="orthodontic.checkbox.43"])){padding-bottom:4.5px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table+p[data-spacer]{height:10px}
.nfc-tpl.nfc-tpl[data-form="3"]>table{margin:1.5px 0 0}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type{margin:5.9px 0 0}
.nfc-tpl.nfc-tpl[data-form="3"]>table:nth-of-type(3){margin-top:6px}
.nfc-tpl.nfc-tpl[data-form="3"]>table:nth-of-type(2){margin-top:-2px}
.nfc-tpl.nfc-tpl[data-form="3"]>table:nth-of-type(6){margin-top:4.17px}
.nfc-tpl.nfc-tpl[data-form="3"]>table>tbody>tr:is(:has([data-medical-record-field="orthodontic.checkbox.34"]),:has([data-medical-record-field="orthodontic.text.53"])){break-before:page;page-break-before:always}
.nfc-tpl[data-form="3"]>table:first-of-type>colgroup>col:first-child{width:384px!important}
.nfc-tpl[data-form="3"]>table:first-of-type>colgroup>col:last-child{width:auto!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type>tbody>tr{height:84px}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type>tbody>tr>td{vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type>tbody>tr>td:first-child>p{display:block!important;white-space:nowrap;line-height:19.6px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type>tbody>tr>td:first-child span[style*="font-size"]{font-size:16px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type>tbody>tr>td:last-child>p{display:flex;align-items:baseline;white-space:nowrap;text-align:left;margin:3.4px 0 0;padding-left:25.7px;line-height:19.5px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type>tbody>tr>td:last-child span[style*="font-size"]{font-size:13.333px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type>tbody>tr>td:last-child>p>span:last-child{flex:1 1 auto;min-width:0;margin-left:.3em}
.nfc-tpl.nfc-tpl[data-form="3"]>table:last-of-type p{line-height:1.725!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:not(:first-of-type,:last-of-type)>tbody>tr>:is(td,th){padding:4px 8px 0;height:26px;vertical-align:middle}
.nfc-tpl.nfc-tpl[data-form="3"]>table:not(:first-of-type,:last-of-type)>tbody>tr:has(.nfc-medical-record-text-field)>:is(td,th){height:30px}
.nfc-tpl.nfc-tpl[data-form="3"]>table:not(:first-of-type,:last-of-type)>tbody>tr:has(br)>:is(td,th){height:52px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:not(:first-of-type,:last-of-type)>tbody>tr:has(br~br)>:is(td,th){height:62px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:not(:first-of-type,:last-of-type)>tbody>tr>:is(td,th)>p{line-height:16.867px!important;margin:0 -6px 0 0;min-height:0;font-size-adjust:none}
.nfc-tpl.nfc-tpl[data-form="3"]>table:not(:first-of-type,:last-of-type)>tbody>tr>:is(td,th)>p:has(.nfc-medical-record-text-field){line-height:18px!important;margin-top:3.07px}
.nfc-tpl.nfc-tpl[data-form="3"] :is([data-medical-record-field="orthodontic.text.11"],[data-medical-record-field="orthodontic.text.12"],[data-medical-record-field="orthodontic.text.13"],[data-medical-record-field="orthodontic.text.14"]){width:28.5px!important;min-width:28.5px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:nth-of-type(4){margin-top:6px}
.nfc-tpl.nfc-tpl[data-form="3"]>table:nth-of-type(4)>tbody>tr:first-child>:first-child>p{margin-top:-5.06px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>table:nth-of-type(5){margin-top:-0.5px}
.nfc-tpl.nfc-tpl[data-form="3"]>p[data-record-section="orthodontic-agreement"]{margin-top:0}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>span>:is([data-medical-record-field="orthodontic.text.2"],[data-medical-record-field="orthodontic.patient.job"],[data-medical-record-field="orthodontic.patient.address"],[data-medical-record-field="orthodontic.patient.phone"],[data-medical-record-field="orthodontic.text.5"],[data-medical-record-field="orthodontic.text.6"],[data-medical-record-field="orthodontic.text.7"],[data-medical-record-field="orthodontic.text.8"],[data-medical-record-field="orthodontic.text.21"])){display:flex;align-items:baseline;gap:.25em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>span>:is([data-medical-record-field="orthodontic.text.2"],[data-medical-record-field="orthodontic.patient.job"],[data-medical-record-field="orthodontic.patient.address"],[data-medical-record-field="orthodontic.patient.phone"],[data-medical-record-field="orthodontic.text.5"],[data-medical-record-field="orthodontic.text.6"],[data-medical-record-field="orthodontic.text.7"],[data-medical-record-field="orthodontic.text.8"],[data-medical-record-field="orthodontic.text.21"]))>span:last-child{flex:1 1 auto;min-width:0}
.nfc-tpl.nfc-tpl[data-form="3"] :is([data-medical-record-field="orthodontic.text.1"],[data-medical-record-field="orthodontic.text.2"],[data-medical-record-field="orthodontic.patient.name"],[data-medical-record-field="orthodontic.patient.job"],[data-medical-record-field="orthodontic.patient.address"],[data-medical-record-field="orthodontic.patient.phone"],[data-medical-record-field="orthodontic.text.5"],[data-medical-record-field="orthodontic.text.6"],[data-medical-record-field="orthodontic.text.7"],[data-medical-record-field="orthodontic.text.8"],[data-medical-record-field="orthodontic.text.21"],[data-medical-record-field="orthodontic.text.100"],[data-medical-record-field="orthodontic.text.101"],[data-medical-record-field="orthodontic.text.102"],[data-medical-record-field="orthodontic.text.103"]){width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="3"] [data-medical-record-field="orthodontic.patient.date-of-birth"]{min-width:129px!important}
.nfc-tpl.nfc-tpl[data-form="3"] :is([data-medical-record-field="orthodontic.text.3"],[data-medical-record-field="orthodontic.text.4"]){min-width:102px!important}
.nfc-tpl.nfc-tpl[data-form="3"] .nfc-medical-record-text-field{min-height:1em}
/* Mẫu 5 as the BA's Word copy (Mau-05-Phieu-tu-van-va-xac-nhan-dong-y-dieu-
   tri.docx, R-1274; again 2026-11-23, R-1292: paragraphs 13pt, titles 15pt), as
   mẫu 3: Times New Roman at its own height, 13pt on Word's 1.5 lines, no space
   around paragraphs; the headings 13pt on the same lines, the title 15pt on
   Word's exact 28.8pt line; the letterhead 11pt bold on exact 15.6pt lines
   centred in Word's 397px column, "Mã hồ sơ" 10pt at Word's 445px. The tick
   rows are as tall as Word draws them, half the extra above the line and half
   below. The cost rows, "(tổng tiền viết bằng chữ)" (Word's right indent) and
   VII's text 13pt too. The signatures in Word's exact lines, the empty lines
   after the first gone, as in the BA's copy; the blanks run to the right
   margin, as on mẫu 3 and 4. Page 2 starts at V, as in Word. */
.nfc-tpl[data-form="5"]{--nfc-letter-height:none;font-size:17.333px}
.nfc-tpl[data-form="5"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="5"]>:is(p,h1,h2){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="5"]>h1{font-size:20px;line-height:22px!important;margin:23.2px 0 0}
.nfc-tpl.nfc-tpl[data-form="5"]>h2{font-size:17.333px;line-height:1.725!important;padding-bottom:0}
.nfc-tpl.nfc-tpl[data-form="5"]>p[data-spacer]{display:none}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type{margin:0}
.nfc-tpl[data-form="5"]>table:first-of-type>colgroup>col:first-child{width:395px!important}
.nfc-tpl[data-form="5"]>table:first-of-type>colgroup>col:last-child{width:auto!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td{padding:0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:first-child{padding-top:9.3px}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:first-child>p{display:block!important;white-space:nowrap;line-height:20.8px!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:first-child span[style*="font-size"]{font-size:14.667px!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child>p{display:flex;align-items:baseline;white-space:nowrap;text-align:left;margin:0;padding:7.4px 0 0 49.7px;line-height:20.8px!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child span[style*="font-size"]{font-size:13.333px!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child>p>span:last-child{flex:1 1 auto;min-width:0;margin-left:.3em}
.nfc-tpl[data-form="5"] [data-medical-record-field="consultation.text.1"]{width:100%!important;min-width:0!important;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child>p[data-medical-record-generated-row]{padding:0 0 0 112.8px}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child>p[data-medical-record-generated-row]>span{margin-left:0}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr{height:89.2px}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-methods"] p,.nfc-tpl.nfc-tpl[data-form="5"]>p[data-record-section="consultation-other"],.nfc-tpl.nfc-tpl[data-form="5"]>p:has(>input){line-height:1.725!important;padding:2.2px 0 2.3px}
.nfc-tpl.nfc-tpl[data-form="5"]>p[data-record-section="consultation-other"]{padding-left:6px}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] td,.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] tr:last-child>th,.nfc-tpl.nfc-tpl[data-form="5"]>table[data-record-section="consultation-cost"]+p,.nfc-tpl.nfc-tpl[data-form="5"]>h2:nth-of-type(7)~p{font-size:17.333px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-borderless]:not(:first-of-type):not([data-record-section]){margin:0 0 -3.3px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-borderless]:not(:first-of-type):not([data-record-section])>tbody>tr>td{padding-top:8.2px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-borderless]:not(:first-of-type):not([data-record-section]):last-of-type>tbody>tr>td{padding-top:8.2px}
.nfc-tpl.nfc-tpl[data-form="5"]>h2:nth-of-type(5){letter-spacing:-.25px;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-borderless]:not(:first-of-type):not([data-record-section]) p{line-height:20.8px!important}
.nfc-tpl.nfc-tpl[data-form="5"] .nfc-medical-record-text-field{min-height:1em}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] p{line-height:23.4px!important}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] tr:first-child p{line-height:21.9px!important}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"]{margin:5.3px 0 5.7px}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] .nfc-medical-record-text-field{display:block!important;min-height:23.4px;line-height:23.4px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-record-section="consultation-cost"]+p{display:flex;align-items:baseline;gap:.4em;white-space:nowrap;padding-right:14.5px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-record-section="consultation-cost"]+p>span:first-child{flex:1 1 auto;min-width:0}
.nfc-tpl.nfc-tpl[data-form="5"] [data-medical-record-field="consultation.text.47"]{width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="5"]>p:is(:has(>span>[data-medical-record-field="consultation.patient.name"]),:has(>span>[data-medical-record-field="consultation.patient.address"]),:has(>span>[data-medical-record-field="consultation.patient.phone"]),:has(>span>[data-medical-record-field="consultation.text.3"]),:has(>span>[data-medical-record-field="consultation.text.7"]),:has(>span>[data-medical-record-field="consultation.text.8"]),:has(>span>[data-medical-record-field="consultation.text.48"]),:has(>span>[data-medical-record-field="consultation.text.49"])){display:flex;align-items:baseline;gap:.25em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="5"]>p:is(:has(>span>[data-medical-record-field="consultation.patient.name"]),:has(>span>[data-medical-record-field="consultation.patient.address"]),:has(>span>[data-medical-record-field="consultation.patient.phone"]),:has(>span>[data-medical-record-field="consultation.text.3"]),:has(>span>[data-medical-record-field="consultation.text.7"]),:has(>span>[data-medical-record-field="consultation.text.8"]),:has(>span>[data-medical-record-field="consultation.text.48"]),:has(>span>[data-medical-record-field="consultation.text.49"]))>span:last-child{flex:1 1 auto;min-width:0}
.nfc-tpl.nfc-tpl[data-form="5"] :is([data-medical-record-field="consultation.patient.date-of-birth"],[data-medical-record-field="consultation.patient.address"],[data-medical-record-field="consultation.text.2"],[data-medical-record-field="consultation.text.4"],[data-medical-record-field="consultation.text.7"],[data-medical-record-field="consultation.text.8"],[data-medical-record-field="consultation.text.48"],[data-medical-record-field="consultation.text.49"]){width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="5"] [data-medical-record-field="consultation.patient.name"]{min-width:285px!important}
.nfc-tpl.nfc-tpl[data-form="5"] [data-medical-record-field="consultation.patient.phone"]{min-width:188px!important}
.nfc-tpl.nfc-tpl[data-form="5"] [data-medical-record-field="consultation.text.3"]{min-width:215px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>p:is(:has(>span>[data-medical-record-field="orthodontic.patient.name"]),:has(>input[data-medical-record-field="orthodontic.checkbox.40"]),:has(>input[data-medical-record-field="orthodontic.checkbox.43"]),:has(>input[data-medical-record-field="orthodontic.checkbox.46"]),:has(>input[data-medical-record-field="orthodontic.checkbox.61"]),:has(>input[data-medical-record-field="orthodontic.checkbox.63"])){display:grid;grid-auto-flow:column;grid-auto-columns:max-content;align-items:baseline;justify-content:start;white-space:nowrap;text-align:left}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>span>[data-medical-record-field="orthodontic.patient.name"]){grid-template-columns:auto minmax(0,1fr) 85px 31.6px 53.6px 21.9px 69.8px;justify-content:stretch}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>span>[data-medical-record-field="orthodontic.patient.name"])>span{margin-left:.25em}
.nfc-tpl.nfc-tpl[data-form="3"]>p:is(:has(>input[data-medical-record-field="orthodontic.checkbox.40"]),:has(>input[data-medical-record-field="orthodontic.checkbox.43"]),:has(>input[data-medical-record-field="orthodontic.checkbox.46"])){grid-template-columns:148.5px 21.5px 91.6px 21.9px 91.6px 21.9px}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>input[data-medical-record-field="orthodontic.checkbox.61"]){grid-template-columns:101px 21.8px 59.8px 129.2px 53.8px 21.9px 119.7px 144.9px}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>input[data-medical-record-field="orthodontic.checkbox.63"]){grid-template-columns:19.8px 116px 75.2px 55.9px 22.2px 71.3px 190.7px;padding-left:101px}
.nfc-tpl.nfc-tpl[data-form="3"]>p:is(:has(>input[data-medical-record-field="orthodontic.checkbox.61"]),:has(>input[data-medical-record-field="orthodontic.checkbox.63"]))>span{margin:0 .3em}
/* Mẫu 2's MS / Số ngoại trú / Số lưu trữ (clinic, 2026-10-28, R-1067), and mẫu
   7's MS / Mã người bệnh (2026-10-29, R-1073): the labels in one column, the
   blanks lined up after the ":", the block against the right margin. After the
   paragraph rules above, which it overrides; the header table it sits in drops
   its drawn 675px to span the writing area. */
.nfc-tpl table:has(.record-ids){width:100%!important}
.nfc-tpl table[data-record-page="outpatient-main"] p.record-ids,.nfc-tpl:is([data-form="7"],[data-form="11"],[data-form="12"]) p.record-ids{display:grid;grid-template-columns:auto auto;column-gap:5px;row-gap:2px;align-items:baseline;width:max-content;max-width:100%;margin:0 0 0 auto;line-height:1.5!important}
.nfc-tpl .record-ids-label{white-space:nowrap}
.nfc-tpl .record-ids>span:not(.record-ids-label){display:block;min-width:0}
.nfc-tpl .record-ids .nfc-medical-record-text-field{width:100%;box-sizing:border-box}
/* Mẫu 6 as the clinic's own copy (2026-10-29, R-1068), and mẫu 7 as its own
   (2026-10-29, R-1073): a line and a half between lines, titles included (mẫu
   10 too from R-1079 until its own Word lines, R-1299); the letterhead
   against the left margin and MS against the right; the first column of a
   borderless table on the left margin — on mẫu 6 a box opening a line too.
   After the paragraph rules above, which it overrides. */
.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="12"]) p:not(:is([data-cover],[data-grid-cell]) *),.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="12"]) h1:not([data-cover] *),.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="12"]) h2{line-height:1.5!important}
.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="11"],[data-form="12"])>table:first-child>tbody>tr>td:first-child,
.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="11"],[data-form="12"])>table[data-borderless]>tbody>tr>td:first-child{padding-left:0}
.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="11"],[data-form="12"])>table:first-child>tbody>tr>td:last-child{padding-right:0}
/* Mẫu 12's count table: rows tall enough to write a number in, the numbers
   in the middle; the gauze sizes in the first column keep their dotted line. */
.nfc-tpl table[data-record-section="surgical-count"] td{height:28px;vertical-align:middle}
.nfc-tpl table[data-record-section="surgical-count"] td:not(:first-child) p{text-align:center}
/* Mẫu 11 laid out as the clinic's paper PT-04 (2026-11-16, "chưa giống lắm"):
   the clinic's name small and mixed case beside the title, MS in the corner;
   the stages' titles in rounded boxes joined by arrows; under them one ruled
   table, each column's sections split by a rule reaching the column's sides
   (.ss-rule); one italic signature line under each column. */
.nfc-tpl[data-form="11"] p{line-height:1.46;margin-bottom:1px}
.nfc-tpl[data-form="11"]>p{margin-bottom:12px}
/* The stages' cells set tighter than the rest (clinic 2026-11-16: "margin top và bottom của từng cell
   hơi lớn, cần ít hơn để tạo gap cho phần bên trên") — the room goes above the table. */
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-stages"] p{line-height:1.36}
.nfc-tpl[data-form="11"]>table{margin:0}
.nfc-tpl[data-form="11"]>table[data-record-section="surgical-safety-header"]{margin-bottom:22px}
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-header"]>tbody>tr>td{vertical-align:top;padding:0 4px}
.nfc-tpl[data-form="11"] .ss-clinic{text-align:center;font-size:12px;margin:0}
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-header"] h1{font-size:22px;line-height:1.2;margin:16px 0 8px}
.nfc-tpl[data-form="11"] .ss-code{text-align:right;margin:0}
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"]{border-collapse:separate;border-spacing:0;margin:20px 0 14px}
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"]>tbody>tr>td{vertical-align:middle;text-align:center;padding:0}
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"]>tbody>tr>td:nth-child(odd){border:1.5px solid #000;border-radius:6px;padding:7px 6px}
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"] td:nth-child(odd) p{font-size:15px;margin:0;text-align:center}
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"] td:nth-child(even) p{line-height:0!important;margin:0;text-align:center}
.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-stages"]>tbody>tr>td{padding:3px 10px 4px}
.nfc-tpl[data-form="11"] .ss-rule{border-top:1px solid #000;margin:4px -10px 1px;padding:3px 10px 0}
/* The second answer of a pair starts where the paper's does, about a third
   into the column (measured off the clinic's photo, 2026-11-16). */
.nfc-tpl[data-form="11"] .ss-opt{display:inline-block;min-width:8.5em}
.nfc-tpl[data-form="11"] .ss-col1 .ss-opt{min-width:11em}
.nfc-tpl[data-form="11"] .ss-col3 .ss-opt{min-width:7.5em}
@media print{
  /* The notes under the third stage are lines to write on: dotted on paper,
     though they sit in a ruled table, whose blanks otherwise print bare. */
  .nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-stages"] .ss-note .nfc-medical-record-text-field{border-bottom:1px dotted #000!important;--nfc-dots:1!important}
}
.nfc-tpl[data-form="11"]>table[data-record-section="signature"]{margin-top:10px}
.nfc-tpl[data-form="11"]>table[data-record-section="signature"]>tbody>tr>td{padding:0 4px}
.nfc-tpl[data-form="11"]>table[data-record-section="signature"] p{text-align:center}
.nfc-tpl[data-form="6"]>table[data-borderless] td>p>input.nfc-medical-record-checkbox:first-child,
.nfc-tpl[data-form="6"]>p>input.nfc-medical-record-checkbox:first-child{margin-left:0}
/* On the 15mm forms a long blank's lines of its own (flowLines) reach the right
   margin, as the clinic's copies of mẫu 2 and mẫu 7 draw them (2026-10-29,
   R-1073). The text on them still breaks where the blank's first line did. */
.nfc-tpl:is([data-form="2"],[data-form="6"],[data-form="7"],[data-form="10"],[data-form="11"],[data-form="12"]) [data-flow-of]{width:100%;min-width:0!important;max-width:none;box-sizing:border-box}
/* Mẫu 6 as the BA's Word copy (R-1275, sizes again R-1293 2026-11-23): Times
   New Roman at its own height, 13pt on Word's 1.3 lines, no space around
   paragraphs; the letterhead 11pt bold on Word's 1.5 lines; the Quốc hiệu 14pt
   and the title 15pt on 1.5 lines, I. and II. 13pt; the tick rows as tall as
   Word draws them; the signatures on 1.5 lines, with the template's two empty
   lines before the dotted name kept — room to sign (clinic, 2026-11-25; Word
   has none). They fit on page 2 since the page's foot is 7.5mm, not 12.5mm
   (SHEET_PRINT_CSS). The body runs 6px into the right margin as Word's -91
   twips indent (the page gives those 6px back so print never shrinks) and its
   spaces close up .9px, so its lines break where Word's do; page 1 ends inside
   "Chúng tôi cam kết…" as in Word, no forced break before II. */
.nfc-tpl[data-form="6"]{--nfc-letter-height:none;font-size:17.333px}
.nfc-tpl[data-form="6"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="6"] :is(p,h1,h2){line-height:1.495!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="6"]>:is(h1,h2){font-size:17.333px}
.nfc-tpl.nfc-tpl[data-form="6"]>h1{font-size:20px;line-height:1.725!important;margin:6.2px 0 4px}
.nfc-tpl.nfc-tpl[data-form="6"]>h1>br{display:none}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child{margin:0}
.nfc-tpl[data-form="6"]>table:first-child>colgroup>col:first-child{width:350px!important}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr{height:96px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr>td{padding:0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child p{font-size:14.667px;line-height:1.725!important;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr>td:first-child>p{margin-left:-3.6px!important;margin-top:-1.6px!important;margin-bottom:1.6px!important}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr>td:last-child>p{text-align:left!important;padding-left:113px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr>td:last-child>p:first-child>*{font-size:13.333px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child+p{font-size:18.667px;line-height:1.725!important;margin-top:1.5px}
.nfc-tpl.nfc-tpl[data-form="6"]>table[data-borderless]:not(:first-child):not(:last-of-type){margin:1.3px 0 -.7px}
.nfc-tpl.nfc-tpl[data-form="6"]>p:has(>input[data-medical-record-field="surgery-consent.checkbox.12"]){padding:2.3px 0 1.2px}
.nfc-tpl.nfc-tpl[data-form="6"]>table[data-borderless]:not(:first-child):not(:last-of-type)>tbody>tr>td{padding-top:0;padding-bottom:0}
.nfc-tpl.nfc-tpl[data-form="6"]>table[data-borderless]:not(:first-child):not(:last-of-type) p{line-height:32px!important}
.nfc-tpl.nfc-tpl[data-form="6"]>:is(hr,p:empty:has(+hr)){display:none!important}
.nfc-tpl.nfc-tpl[data-form="6"]>p{break-inside:auto;page-break-inside:auto;orphans:2;widows:2}
.nfc-tpl.nfc-tpl[data-form="6"]>:is(p:not(table:first-child+p),h2){margin-right:-6px}
.nfc-tpl.nfc-tpl[data-form="6"]>p[style*="justify"]{word-spacing:-.9px}
.nfc-tpl.nfc-tpl[data-form="6"]>p:has(>input[data-medical-record-field="surgery-consent.checkbox.25"]){padding:2.9px 0 4.5px}
.nfc-tpl.nfc-tpl[data-form="6"]>p:has(>input[data-medical-record-field="surgery-consent.checkbox.26"]){padding-bottom:1.6px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:last-of-type{margin-top:3px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:last-of-type p{line-height:1.725!important}
.nfc-tpl.nfc-tpl[data-form="6"]>table:last-of-type p>em~span>.nfc-medical-record-text-field{position:relative;top:2.9px}
.nfc-tpl.nfc-tpl[data-form="6"] p:is(:has(>span>[data-medical-record-field="surgery-consent.text.1"]),:has(>span>[data-medical-record-field="surgery-consent.text.2"]),:has(>span>[data-medical-record-field="surgery-consent.text.3"]),:has(>span>[data-medical-record-field="surgery-consent.text.4"]),:has(>span>[data-medical-record-field="surgery-consent.text.5"]),:has(>span>[data-medical-record-field="surgery-consent.text.6"]),:has(>span>[data-medical-record-field="surgery-consent.text.7"]),:has(>span>[data-medical-record-field="surgery-consent.text.8"]),:has(>span>[data-medical-record-field="surgery-consent.text.21"]),:has(>span>[data-medical-record-field="surgery-consent.patient.name"]),:has(>span>[data-medical-record-field="surgery-consent.text.9"]),:has(>span>[data-medical-record-field="surgery-consent.text.11"]),:has(>span>[data-medical-record-field="surgery-consent.text.12"]),:has(>span>[data-medical-record-field="surgery-consent.text.13"])){display:flex;align-items:baseline;gap:.25em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="6"] p:is(:has(>span>[data-medical-record-field="surgery-consent.text.1"]),:has(>span>[data-medical-record-field="surgery-consent.text.2"]),:has(>span>[data-medical-record-field="surgery-consent.text.3"]),:has(>span>[data-medical-record-field="surgery-consent.text.4"]),:has(>span>[data-medical-record-field="surgery-consent.text.5"]),:has(>span>[data-medical-record-field="surgery-consent.text.6"]),:has(>span>[data-medical-record-field="surgery-consent.text.7"]),:has(>span>[data-medical-record-field="surgery-consent.text.8"]),:has(>span>[data-medical-record-field="surgery-consent.text.21"]),:has(>span>[data-medical-record-field="surgery-consent.patient.name"]),:has(>span>[data-medical-record-field="surgery-consent.text.9"]),:has(>span>[data-medical-record-field="surgery-consent.text.11"]),:has(>span>[data-medical-record-field="surgery-consent.text.12"]),:has(>span>[data-medical-record-field="surgery-consent.text.13"]))>span{flex:1 1 auto;min-width:0}
.nfc-tpl.nfc-tpl[data-form="6"] p:is(:has(>span>[data-medical-record-field="surgery-consent.patient.name"]),:has(>span>[data-medical-record-field="surgery-consent.text.9"]))>span:last-child{flex:0 0 196px;margin:0 4.6px 0 4.1px}
.nfc-tpl.nfc-tpl[data-form="6"] p:is(:has(>span>[data-medical-record-field="surgery-consent.patient.name"]),:has(>span>[data-medical-record-field="surgery-consent.text.9"]))>span:first-child{margin-right:-14.3px}
.nfc-tpl.nfc-tpl[data-form="6"] :is([data-medical-record-field="surgery-consent.text.1"],[data-medical-record-field="surgery-consent.text.2"],[data-medical-record-field="surgery-consent.text.3"],[data-medical-record-field="surgery-consent.text.4"],[data-medical-record-field="surgery-consent.text.5"],[data-medical-record-field="surgery-consent.text.6"],[data-medical-record-field="surgery-consent.text.7"],[data-medical-record-field="surgery-consent.text.8"],[data-medical-record-field="surgery-consent.text.21"],[data-medical-record-field="surgery-consent.patient.name"],[data-medical-record-field="surgery-consent.patient.birth-year"],[data-medical-record-field="surgery-consent.text.9"],[data-medical-record-field="surgery-consent.text.10"],[data-medical-record-field="surgery-consent.text.11"],[data-medical-record-field="surgery-consent.text.12"],[data-medical-record-field="surgery-consent.text.13"]){width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="6"] .nfc-medical-record-text-field{min-height:1em}
/* Mẫu 12 as the BA's Word copy (Mau-12-Bang-kiem-dem-gac-dung-cu.docx,
   2026-11-23, R-1276; sizes again R-1298 2026-11-23): Times New Roman at its
   own height, 13pt on Word's 1.5 lines, no space around paragraphs; the
   letterhead 11pt bold, MS 10pt where Word sets it; the title 15pt on one line;
   the count table's head 13pt on single lines, broken where Word breaks it;
   its rows as tall as Word's exact lines, the empty blanks no taller than
   them; the tick rows as tall as Word draws them; the blanks end where Word's
   tabs end them; the signatures on 1.5 lines, the empty lines before the name
   gone, as in the BA's copy. */
.nfc-tpl[data-form="12"]{--nfc-letter-height:none;font-size:17.333px}
.nfc-tpl[data-form="12"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="12"] :is(p,h1){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="12"]>table:first-child{margin:0}
.nfc-tpl[data-form="12"]>table:first-child>colgroup>col:first-child{width:368.6px!important}
.nfc-tpl.nfc-tpl[data-form="12"]>table:first-child>tbody>tr{height:90px}
.nfc-tpl.nfc-tpl[data-form="12"]>table:first-child>tbody>tr>td{padding:2px 0 0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="12"]>table:first-child>tbody>tr>td:first-child>p{font-size:14.667px;line-height:21px!important;margin-left:5.7px!important}
.nfc-tpl.nfc-tpl[data-form="12"] p.record-ids{font-size:13.333px;line-height:21px!important;row-gap:0;column-gap:0;grid-template-columns:104px 1fr;width:auto;margin:0 0 0 56.6px}
.nfc-tpl.nfc-tpl[data-form="12"] p.record-ids .nfc-medical-record-text-field{width:100%!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="12"]>h1[data-record-section="surgical-count-title"]{font-size:20px;margin-top:7.9px}
.nfc-tpl.nfc-tpl[data-form="12"] [data-medical-record-field="surgical-count.patient.name"]{display:inline-block;width:270.9px!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="12"] [data-medical-record-field="surgical-count.patient.age"]{display:inline-block;width:42.9px!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="12"] [data-medical-record-field="surgical-count.patient.gender-male"]{margin:0 4.7px 0 -11.7px}
.nfc-tpl.nfc-tpl[data-form="12"] [data-medical-record-field="surgical-count.patient.gender-female"]{margin:0 5.8px 0 4.9px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]{margin-top:0}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:first-child p{line-height:1.15!important}
.nfc-tpl.nfc-tpl[data-form="12"]>p:has([data-medical-record-field="surgical-count.patient.name"]){padding-bottom:10.2px!important}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:nth-child(n+4)>td:first-child{padding-top:2.8px;padding-bottom:5.2px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:first-child>td{padding-top:1.7px;padding-bottom:1.7px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:first-child>td:first-child{padding-left:2px;padding-right:2px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:first-child>td:is(:nth-child(2),:nth-child(5)){padding-left:5px;padding-right:5px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:nth-child(n+2) p{line-height:26.45px!important}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:nth-child(n+2) .nfc-medical-record-text-field{line-height:18.4px!important;min-height:0!important;height:18.4px!important}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:nth-child(n+2)>td:first-child>p{position:relative;top:-4.8px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]+p{margin-top:22.5px}
.nfc-tpl.nfc-tpl[data-form="12"]>p:has(>input[type="checkbox"]){padding:2.5px 0 2.1px}
.nfc-tpl.nfc-tpl[data-form="12"] p:is(:has(>span>[data-medical-record-field="surgical-count.text.2"]),:has(>span>[data-medical-record-field="surgical-count.text.3"]),:has(>span>[data-medical-record-field="surgical-count.text.5"])){display:flex;align-items:baseline;gap:.25em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="12"] p:is(:has(>span>[data-medical-record-field="surgical-count.text.2"]),:has(>span>[data-medical-record-field="surgical-count.text.3"]),:has(>span>[data-medical-record-field="surgical-count.text.5"]))>span:last-child{flex:1 1 auto;min-width:0;margin-top:-1.35px}
.nfc-tpl.nfc-tpl[data-form="12"] p:has(>span>[data-medical-record-field="surgical-count.text.2"]){padding-right:49.1px}
.nfc-tpl.nfc-tpl[data-form="12"] p:has(>span>[data-medical-record-field="surgical-count.text.3"]){padding:2px 56px 1px 0!important}
.nfc-tpl.nfc-tpl[data-form="12"] p:has(>span>[data-medical-record-field="surgical-count.text.3"])>input[type="checkbox"]:first-child{margin-left:0}
.nfc-tpl.nfc-tpl[data-form="12"] p:has(>span>[data-medical-record-field="surgical-count.text.5"]){padding-right:35px}
.nfc-tpl.nfc-tpl[data-form="12"] :is([data-medical-record-field="surgical-count.text.2"],[data-medical-record-field="surgical-count.text.3"],[data-medical-record-field="surgical-count.text.5"]){width:100%!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="signature"]{margin-top:31.3px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="signature"]>tbody>tr>td{padding-top:0;padding-bottom:0}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="signature"] p>em+br~br{display:none}
@media print{
  .nfc-tpl [data-grid-cell] .nfc-medical-record-text-field{border-bottom:0!important;--nfc-dots:0!important}
  .nfc-tpl table[data-record-section="surgical-count"] td:first-child .nfc-medical-record-text-field:not([data-field-full-width="true"]){border-bottom:1px dotted #000!important;--nfc-dots:1!important}
  /* Mẫu 2's vitals box and files table keep their dots on paper, as the BA's Word copy has them: "Mạch ......lần/ph", "Số tờ ......", "Họ tên ......" (R-1270). */
  .nfc-tpl[data-form="2"] :is(table[data-record-section="vitals"],table[data-record-section="summary-files"]) .nfc-medical-record-text-field{border-bottom:1px dotted #000!important;--nfc-dots:1!important}
  /* Mẫu 11's and 12's signers' names print with no dotted line (clinic 2026-11-16): the room above is for the signature. */
  .nfc-tpl:is([data-form="11"],[data-form="12"])>table[data-record-section="signature"] .nfc-medical-record-text-field{border-bottom:0!important;--nfc-dots:0!important}
  .nfc-tpl .nfc-material-add{display:none}
}
/* Mẫu 7 as the BA's Word copy (Mau-07-Phieu-phau-thuat-thu-thuat.docx,
   2026-11-23, R-1280; sizes again R-1294 2026-11-23), as mẫu 5: Times New
   Roman at its own height, 13pt on Word's 1.5 lines (1.725 × the size), no
   space around paragraphs; the title 15pt; the letterhead 11pt bold on Word's
   exact 15.75pt lines, centred where Word centres it, MS and Mã người bệnh
   11pt bold at Word's tab stops; the page 12.5mm above, 7.5mm below, 15mm at
   the sides. The lines under the table at Word's 1.4 spacing; nine TRÌNH TỰ
   lines, as Word — a tenth shows only once something is written on it —
   dotted on paper as Word's (R-1286), their dots on the text's line as Word's,
   the header row as tall as Word's and the row's foot as deep. The signature
   line's blanks as wide as Word's dots; one empty line between "(Ký, ghi rõ
   họ tên)" and the dotted name, room to sign (clinic, 2026-11-25; the Word
   copy has none) — one, not the template's two, as that is all the page has
   left: a second would carry the signature on to a page of its own. */
.nfc-tpl[data-form="7"]{--nfc-letter-height:none;font-size:17.333px}
.nfc-tpl[data-form="7"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="7"] :is(p,h1,h2){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="7"]>h2{font-size:17.333px}
.nfc-tpl.nfc-tpl[data-form="7"]>h1{font-size:20px;margin:9.9px 0 2.4px}
.nfc-tpl.nfc-tpl[data-form="7"]>h1>br{display:none}
.nfc-tpl.nfc-tpl[data-form="7"]>table:first-child{margin:0}
.nfc-tpl[data-form="7"]>table:first-child>colgroup>col:first-child{width:359px!important}
.nfc-tpl.nfc-tpl[data-form="7"]>table:first-child>tbody>tr>td{padding:0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="7"]>table:first-child>tbody>tr>td:first-child>p{font-size:14.667px;line-height:21px!important;white-space:nowrap;margin-left:.6px!important}
.nfc-tpl.nfc-tpl[data-form="7"]>table:first-child>tbody>tr>td:first-child{padding-top:2.3px}
.nfc-tpl.nfc-tpl[data-form="7"] p.record-ids{font-size:14.667px;line-height:20px!important;grid-template-columns:133.3px minmax(0,1fr);column-gap:0;row-gap:0;width:auto;margin:0 0 0 85.4px;padding-top:3.3px}
.nfc-tpl.nfc-tpl[data-form="7"] p.record-ids .nfc-medical-record-text-field{min-width:0!important;min-height:1em;line-height:20px}
.nfc-tpl.nfc-tpl[data-form="7"]>p:has(>span>:is([data-medical-record-field="procedure-record.text.1"],[data-medical-record-field="procedure-record.text.2"],[data-medical-record-field="procedure-record.text.3"],[data-medical-record-field="procedure-record.text.4"],[data-medical-record-field="procedure-record.text.5"],[data-medical-record-field="procedure-record.text.6"],[data-medical-record-field="procedure-record.text.31"],[data-medical-record-field="procedure-record.text.33"],[data-medical-record-field="procedure-record.text.34"],[data-medical-record-field="procedure-record.text.35"])){display:flex;align-items:baseline;gap:.3em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="7"]>p:has(>span>:is([data-medical-record-field="procedure-record.text.1"],[data-medical-record-field="procedure-record.text.2"],[data-medical-record-field="procedure-record.text.3"],[data-medical-record-field="procedure-record.text.4"],[data-medical-record-field="procedure-record.text.5"],[data-medical-record-field="procedure-record.text.6"],[data-medical-record-field="procedure-record.text.31"],[data-medical-record-field="procedure-record.text.33"],[data-medical-record-field="procedure-record.text.34"],[data-medical-record-field="procedure-record.text.35"]))>span{flex:1 1 auto;min-width:0;white-space:pre-wrap}
.nfc-tpl.nfc-tpl[data-form="7"] :is([data-medical-record-field="procedure-record.text.1"],[data-medical-record-field="procedure-record.text.2"],[data-medical-record-field="procedure-record.text.3"],[data-medical-record-field="procedure-record.text.4"],[data-medical-record-field="procedure-record.text.5"],[data-medical-record-field="procedure-record.text.6"],[data-medical-record-field="procedure-record.text.11"],[data-medical-record-field="procedure-record.text.31"],[data-medical-record-field="procedure-record.text.33"],[data-medical-record-field="procedure-record.text.34"],[data-medical-record-field="procedure-record.text.35"]){width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="7"] .nfc-medical-record-text-field{min-height:1em}
.nfc-tpl.nfc-tpl[data-form="7"]>p:has(>input){padding:2.4px 0 1.9px}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.patient.name"]{min-width:262.8px!important;margin:0 -18.1px 0 3.8px}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.patient.age"]{min-width:42.9px!important;margin:0 -10.5px 0 -2.2px}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.patient.gender-male"]{margin-left:11.9px}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.patient.gender-female"]{margin-left:14.2px}
.nfc-tpl.nfc-tpl[data-form="7"]>p:has(>span>[data-medical-record-field="procedure-record.text.7"]){display:flex;align-items:baseline;white-space:pre}
.nfc-tpl.nfc-tpl[data-form="7"]>p:has(>span>[data-medical-record-field="procedure-record.text.7"])>span:last-child{flex:1 1 auto;min-width:0}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.7"]{width:40px!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.8"]{width:43.4px!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.9"]{width:40px!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.10"]{width:45.2px!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="7"]>table:not([data-borderless]){margin:1.4px 0 0}
.nfc-tpl.nfc-tpl[data-form="7"]>table:not([data-borderless]) :is(th,td){padding:0 7.2px}
.nfc-tpl.nfc-tpl[data-form="7"]>table:not([data-borderless]) th{font-weight:700;vertical-align:middle;height:24.8px;box-sizing:border-box;padding-bottom:1.3px}
.nfc-tpl.nfc-tpl[data-form="7"]>table:not([data-borderless]) td p{line-height:1.725!important;min-height:0}
.nfc-tpl.nfc-tpl[data-form="7"]>table:not([data-borderless]) td .nfc-medical-record-text-field{line-height:1.725!important}
.nfc-tpl.nfc-tpl[data-form="7"]>table:not([data-borderless])~p{line-height:1.61!important}
.nfc-tpl.nfc-tpl[data-form="7"]>table:not([data-borderless]) td:not(.nfc-medical-record-drawing-cell){padding-bottom:12.6px}
.nfc-tpl.nfc-tpl[data-form="7"]>table:not([data-borderless])~p>br:last-child{display:none}
.nfc-tpl.nfc-tpl[data-form="7"]>table[data-borderless]:last-of-type{margin:0}
.nfc-tpl.nfc-tpl[data-form="7"]>table[data-borderless]:last-of-type>tbody>tr>td{padding:0}
.nfc-tpl.nfc-tpl[data-form="7"]>table[data-borderless]:last-of-type p{line-height:1.725!important}
.nfc-tpl.nfc-tpl[data-form="7"]>table[data-borderless]:last-of-type p>br:is(:nth-of-type(2),:nth-of-type(5)){display:none}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.42"]{min-width:68.9px!important;margin-right:2px}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.36"]{min-width:21px!important;margin:0 -2.4px 0 -3.5px}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.37"]{min-width:0!important;padding:0}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.38"]{min-width:20.4px!important;margin:0 1px 0 -3.3px}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.39"]{min-width:16.5px!important;margin-left:2.3px}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.40"]{min-width:16.5px!important;margin-left:4px}
.nfc-tpl.nfc-tpl[data-form="7"]>table[data-borderless]:last-of-type p:has([data-medical-record-field="procedure-record.text.42"]){text-indent:8.1px}
.nfc-tpl.nfc-tpl[data-form="7"]>table[data-borderless]:last-of-type p:has([data-medical-record-field="procedure-record.text.42"]) .nfc-medical-record-text-field{text-indent:0}
.nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.41"]{min-width:229px!important;margin-left:-1.7px;position:relative;top:2.9px}
.nfc-tpl.nfc-tpl[data-form="7"]>table[data-borderless]:last-of-type+p{display:none}
/* Mẫu 8 as the BA's Word copy (Mau-08-Phieu-theo-doi-dieu-tri.docx,
   2026-11-23, R-1281; sizes again R-1295 2026-11-23), as mẫu 7: Times New
   Roman at its own height, 13pt; the title 15pt on Word's exact 25.2pt line;
   the letterhead 11pt bold on Word's exact 13.7pt lines, centred in Word's
   column; MS, Tờ điều trị số and Số ngoại trú 10pt on
   16.15pt lines, the labels at Word's indent, their blanks lined up at its
   tab and running to the right margin. The table in Word's columns: its head
   in plain type, seventeen rows of 34.5pt, dotted on paper as Word's
   (R-1286) — on paper low in its row, room above it to write by hand
   (R-1287); the cells' padding a little
   under Word's, so "23/11/2026 08:30" holds one line in Ngày, giờ. */
.nfc-tpl[data-form="8"]{--nfc-letter-height:none;font-size:17.333px}
.nfc-tpl[data-form="8"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="8"] :is(p,h1,h2){margin:0}
.nfc-tpl.nfc-tpl[data-form="8"]>h1{font-size:20px;line-height:33.6px!important;margin:18.4px 0 0}
.nfc-tpl.nfc-tpl[data-form="8"]>h1>br{display:none}
.nfc-tpl.nfc-tpl[data-form="8"]>table:first-child{margin:0}
.nfc-tpl.nfc-tpl[data-form="8"]>table:first-child>colgroup>col:first-child{width:351.5px!important}
.nfc-tpl.nfc-tpl[data-form="8"]>table:first-child>tbody>tr>td{padding:0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="8"]>table:first-child>tbody>tr>td:first-child{padding-top:7.7px}
.nfc-tpl.nfc-tpl[data-form="8"]>table:first-child>tbody>tr>td:first-child>p{display:block!important;width:347.8px;font-size:14.667px;line-height:18.27px!important;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="8"] p.record-ids{display:grid;grid-template-columns:94.7px minmax(0,1fr);column-gap:0;row-gap:0;align-items:baseline;width:auto;margin:0 0 0 93.2px;padding:10.3px 0 0;font-size:13.333px;line-height:21.5px!important}
.nfc-tpl.nfc-tpl[data-form="8"] p.record-ids .nfc-medical-record-text-field{min-width:0!important;min-height:1em;line-height:1.2;white-space:pre-wrap;overflow-wrap:anywhere}
.nfc-tpl.nfc-tpl[data-form="8"]>p:has(>input){line-height:1.725!important;margin-top:1.2px}
.nfc-tpl.nfc-tpl[data-form="8"] [data-medical-record-field="treatment-tracking.page-1.patient.name"]{min-width:215.6px!important}
.nfc-tpl.nfc-tpl[data-form="8"] [data-medical-record-field="treatment-tracking.page-1.patient.age"]{min-width:72px!important}
.nfc-tpl.nfc-tpl[data-form="8"] .nfc-medical-record-text-field{min-height:1em}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless]){margin:12.7px 0 0}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless])>colgroup>col:nth-child(1){width:18.78%!important}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless])>colgroup>col:nth-child(2){width:31.42%!important}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless])>colgroup>col:nth-child(3){width:26.74%!important}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless])>colgroup>col:nth-child(4){width:auto!important}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless]) th{box-sizing:border-box;height:60.7px;padding:0 1px;vertical-align:middle;text-align:center;font-weight:400}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless]) th em{font-style:normal}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless]) th p{line-height:18.2px!important;text-align:center}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless]) td{box-sizing:border-box;height:46px;padding:0 3px;vertical-align:middle}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless]) td .nfc-medical-record-text-field{padding:0 1px}
.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless]) td p,.nfc-tpl.nfc-tpl[data-form="8"]>table:not([data-borderless]) td .nfc-medical-record-text-field{line-height:18.2px!important;min-height:0}
/* Mẫu 9 as the BA's Word copy (Mau-09-Phieu-cham-soc.docx, 2026-11-23,
   R-1282; sizes again R-1296 2026-11-23), as mẫu 7: Times New Roman at its
   own height, 13pt on Word's 1.5 lines, no space around paragraphs; the title
   15pt; the letterhead 11pt bold on Word's exact 15.1pt lines; MS and Mã người
   bệnh 13pt bold, left-aligned on one edge as Word's, their blanks to the
   right margin; "Điều dưỡng ghi phiếu số" at
   Word's indent; Chẩn đoán over two dotted lines, the second one drawn until a
   long diagnosis writes on lines of its own. The table in Word's columns and
   13pt: a header row of 47.85pt, twenty rows of 27.15pt, dotted on paper as
   Word's (R-1286) — on paper low in its row, room above it to write by
   hand (R-1287). */
.nfc-tpl[data-form="9"]{--nfc-letter-height:none;font-size:17.333px}
.nfc-tpl[data-form="9"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="9"] :is(p,h1,h2){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="9"]>h1{font-size:20px;margin:0 0 2.4px}
.nfc-tpl.nfc-tpl[data-form="9"]>table:first-child{margin:0}
.nfc-tpl.nfc-tpl[data-form="9"]>table:first-child>tbody>tr>td{padding:0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="9"]>table:first-child>tbody>tr>td:first-child{padding:8.3px 0 0 5.7px}
.nfc-tpl.nfc-tpl[data-form="9"]>table:first-child>tbody>tr>td:first-child>p{font-size:14.667px;line-height:20.13px!important;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="9"] p.record-ids{display:grid;grid-template-columns:129.6px minmax(0,1fr);column-gap:5px;row-gap:0;align-items:baseline;width:auto;margin:0;padding:11.9px 8.6px 0 67.9px;font-size:17.333px;line-height:24.8px!important}
.nfc-tpl.nfc-tpl[data-form="9"] p.record-ids .record-ids-label{justify-self:start}
.nfc-tpl.nfc-tpl[data-form="9"] p.record-ids .nfc-medical-record-text-field{min-width:0!important;min-height:1em;line-height:1.2}
.nfc-tpl.nfc-tpl[data-form="9"]>p:has(>span>[data-medical-record-field="care.record-number"]){text-align:left!important;padding-left:195.3px}
.nfc-tpl.nfc-tpl[data-form="9"] [data-medical-record-field="care.record-number"]{min-width:110px!important}
.nfc-tpl.nfc-tpl[data-form="9"]>p:has(>input){padding:2.4px 0 1.9px}
.nfc-tpl.nfc-tpl[data-form="9"] [data-medical-record-field="care.patient.name"]{min-width:279.7px!important}
.nfc-tpl.nfc-tpl[data-form="9"] [data-medical-record-field="care.patient.age"]{min-width:44px!important}
.nfc-tpl.nfc-tpl[data-form="9"] [data-medical-record-field="care.patient.gender-male"]{margin-left:15.2px}
.nfc-tpl.nfc-tpl[data-form="9"] [data-medical-record-field="care.patient.gender-female"]{margin-left:2.9px}
.nfc-tpl.nfc-tpl[data-form="9"]>p:has(>span>[data-medical-record-field="care.diagnosis"]){display:flex;flex-wrap:wrap;align-items:baseline;gap:0 .3em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="9"]>p:has(>span>[data-medical-record-field="care.diagnosis"])>span{flex:1 1 0;min-width:0;white-space:pre-wrap}
.nfc-tpl.nfc-tpl[data-form="9"] [data-medical-record-field="care.diagnosis"]{width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="9"]>p:has(>span>[data-medical-record-field="care.diagnosis"]):not(:has(+p[data-flow-line]))::after{content:"${".".repeat(320)}";flex:0 0 100%;min-width:0;overflow:hidden;white-space:nowrap;font-style:normal}
.nfc-tpl.nfc-tpl[data-form="9"] .nfc-medical-record-text-field{min-height:1em}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless]){margin:7.1px 0 0;font-size:17.333px}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless])>colgroup>col:nth-child(1){width:16.4%!important}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless])>colgroup>col:nth-child(2){width:10.99%!important}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless])>colgroup>col:nth-child(3){width:27.46%!important}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless])>colgroup>col:nth-child(4){width:24.72%!important}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless])>colgroup>col:nth-child(5){width:auto!important}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless]) th{box-sizing:border-box;height:69.1px;padding:2px 1px 0;vertical-align:middle;text-align:center;font-weight:700}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless]) th p{line-height:18.6px!important;text-align:center}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless]) td{box-sizing:border-box;height:36.2px;padding:3.2px 7.2px 0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless]) td p,.nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless]) td .nfc-medical-record-text-field{line-height:18.6px!important;min-height:0}
/* The letterhead — "SỞ Y TẾ … NHA KHOA ĐỨC HẠNH", four bold lines — set as
   mẫu 9's on every form that carries it (clinic, 2026-11-25): Times New Roman
   11pt bold on 20.13px lines, each line centred on the longest, which starts
   the block. Each form had it at its own Word copy's size and spacing (12pt on
   mẫu 2 and 3, lines from 18.3px to 27.6px apart). Mẫu 1 has its own three-line
   heading on the cover, mẫu 10 none, mẫu 11 its own (clinic: not mẫu 11).
   The block keeps the height it had on each form, so nothing under it moves:
   the lines below were matched to the BA's Word copies, and a shorter or
   taller letterhead would carry them all up or down. */
.nfc-tpl.nfc-tpl.nfc-tpl[data-form] p[data-block-align="left"][style*="display: table"]{display:block!important;width:max-content!important;max-width:none!important;height:var(--nfc-letterhead-height,auto);margin-right:auto!important;font-size:14.667px!important;font-size-adjust:none!important;line-height:20.13px!important;letter-spacing:normal!important;word-spacing:normal!important;white-space:nowrap!important}
.nfc-tpl.nfc-tpl.nfc-tpl[data-form] p[data-block-align="left"][style*="display: table"] :is(span[style*="font-size"],strong){font-size:inherit!important}
.nfc-tpl.nfc-tpl.nfc-tpl[data-form="4"]>p[data-block-align="left"][style*="display: table"]{margin-left:0!important}
.nfc-tpl[data-form="2"]{--nfc-letterhead-height:110.4px}
.nfc-tpl[data-form="3"]{--nfc-letterhead-height:78.4px}
.nfc-tpl[data-form="4"]{--nfc-letterhead-height:91.1px}
.nfc-tpl[data-form="5"]{--nfc-letterhead-height:83.2px}
.nfc-tpl[data-form="6"]{--nfc-letterhead-height:101.2px}
.nfc-tpl:is([data-form="7"],[data-form="12"]){--nfc-letterhead-height:84px}
.nfc-tpl[data-form="8"]{--nfc-letterhead-height:73.1px}
/* Mẫu 11 as the BA's Word copy (Mau-11-Bang-kiem-an-toan-phau-thuat.docx,
   2026-11-23, R-1283; again R-1297 2026-11-23), over the clinic's layout
   above: Times New Roman at its own height, 12pt on Word's single lines
   (13.8pt, no 1.2em floor), a tick line as tall as Word's ☐ makes it (16pt
   apart); the name and diagnosis lines 1.5 apart; the clinic's name 11pt on
   Word's exact lines, 6px past its cell on each side as Word's indent, the
   title 15pt, MS 11pt; the stages' titles
   12.5pt bold in square boxes and nothing between them; the second answer of
   a pair at Word's tab; the second column ruled only where its rows meet
   (above Dự kiến) — not above Kháng sinh nor Chẩn đoán hình ảnh (R-1286);
   the signatures 11pt italic, the names where Word puts
   their dotted line (printed bare, the clinic's rule for 11 and 12, R-1276).
   The page 10mm above, 5mm below. */
.nfc-tpl[data-form="11"]{--nfc-letter-height:none;font-size:16px}
.nfc-tpl.nfc-tpl[data-form="11"] p{line-height:18.4px!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="11"] p:has(input){padding-top:2.4px}
.nfc-tpl.nfc-tpl[data-form="11"]>p{line-height:27.6px!important}
.nfc-tpl.nfc-tpl[data-form="11"]>p:first-of-type{margin-top:2.5px}
.nfc-tpl.nfc-tpl[data-form="11"]>p:nth-of-type(2){padding-top:1.5px}
.nfc-tpl.nfc-tpl[data-form="11"]>table{margin:0}
.nfc-tpl.nfc-tpl[data-form="11"]>table[data-record-section="surgical-safety-header"]{margin:0}
.nfc-tpl.nfc-tpl[data-form="11"]>table[data-record-section="surgical-safety-header"]>tbody>tr>td{padding:0}
.nfc-tpl.nfc-tpl[data-form="11"]>table[data-record-section="surgical-safety-header"]>tbody>tr>td:first-child{padding-right:4px}
.nfc-tpl.nfc-tpl[data-form="11"] .ss-clinic{font-size:14.667px;line-height:15.6px!important;margin:0 -6px;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-header"] h1{font-size:20px;line-height:26.4px!important;margin:14.9px 0 0}
.nfc-tpl.nfc-tpl[data-form="11"] .ss-code{font-size:14.667px;line-height:16.3px!important}
.nfc-tpl.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"]{margin:7.6px 0 21.2px;border-collapse:collapse}
.nfc-tpl.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"]>tbody>tr>td:nth-child(odd){border:1px solid #000;border-radius:0;padding:0;height:27.5px;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"] td:nth-child(odd) p{font-size:16.667px;line-height:28.75px!important}
.nfc-tpl.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety"] td:nth-child(5) p{font-size:16px}
.nfc-tpl.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-stages"]>tbody>tr>td{padding:0 1.2px 3.6px 9.2px}
.nfc-tpl.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-stages"] p{min-height:0}
.nfc-tpl.nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-stages"] p:has(input){padding:2.8px 0 0 2.5px}
.nfc-tpl.nfc-tpl[data-form="11"] .ss-rule{margin:0;padding:0;border-top:0}
.nfc-tpl.nfc-tpl[data-form="11"] .ss-col1 .ss-opt{min-width:143px}
.nfc-tpl.nfc-tpl[data-form="11"] .ss-col2 .ss-opt{min-width:110.4px}
.nfc-tpl.nfc-tpl[data-form="11"] .ss-col3 .ss-opt{min-width:97.5px}
.nfc-tpl.nfc-tpl[data-form="11"]>table[data-record-section="signature"]{margin-top:5.5px}
.nfc-tpl.nfc-tpl[data-form="11"]>table[data-record-section="signature"] p{font-size:14.667px;line-height:16.3px!important}
.nfc-tpl.nfc-tpl[data-form="11"]>table[data-record-section="signature"] p>br:nth-of-type(n+2){display:none}
.nfc-tpl.nfc-tpl[data-form="11"]>table[data-record-section="signature"] .nfc-medical-record-text-field{min-width:160px!important;margin-top:37px}
/* The dots the BA's Word copies print in their tables and under where people
   sign (owner, 2026-11-23, R-1285, R-1286: "trong table sao không có các dấu
   chấm"): every blank of mẫu 7's TRÌNH TỰ, of mẫu 8's and mẫu 9's tables, and
   mẫu 11's three names — out of the bare grid and signature rules above.
   Mẫu 12 keeps its own rule (R-1276). */
@media print{
  .nfc-tpl.nfc-tpl:is([data-form="7"],[data-form="8"],[data-form="9"])>table:not([data-borderless]) [data-grid-cell] .nfc-medical-record-text-field,
  .nfc-tpl.nfc-tpl[data-form="11"]>table[data-record-section="signature"] .nfc-medical-record-text-field{border-bottom:1px dotted #000!important;--nfc-dots:1!important}
  /* Mẫu 8's and 9's blanks low in their rows on paper, the room above them to write by hand; on screen they stay where they were (R-1287). */
  .nfc-tpl.nfc-tpl:is([data-form="8"],[data-form="9"])>table:not([data-borderless])>tbody>tr>td{vertical-align:bottom;padding-top:0;padding-bottom:7px}
  /* Mẫu 9's rows are lower (27pt against 34.5pt): its line as far down its row as mẫu 8's, three quarters of the way. */
  .nfc-tpl.nfc-tpl[data-form="9"]>table:not([data-borderless])>tbody>tr>td{padding-bottom:5px}
  /* Mẫu 7's minute slot between "Giờ" and ", ngày" is a hair wide, as Word has none: no stray dot in it. */
  .nfc-tpl.nfc-tpl[data-form="7"] [data-medical-record-field="procedure-record.text.37"]{--nfc-dots:0!important}
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
/* Mẫu 1 at the BA's Word sizes (BA, 2026-11-22, R-1271; again 2026-11-23,
   R-1289: the text 13pt, the titles 13pt bold). Pages 2 and 3: Word's cells
   (4px over the text, 8px each side, the row at its trHeight + 5px), the text
   in the middle of its cell, the list's columns as Word's; the titles
   squeezed 2% so they hold one line as in Word. */
.nfc-tpl[data-form="1"]>h2{font-size:17.333px}
/* The cover (page 1) as the clinic's HC-01 "Bìa hồ sơ bệnh án" (2026-11-25):
   only how it looks — every blank and box stays. Word draws it inside 10mm /
   20mm margins: a 3pt navy frame 688 × 1048px from x 73.6, y 35.8 of the
   page, so the frame stands out of the sheet's 12mm margin, which pages 2
   and 3 keep. Inside it, each line on Word's own baseline (px from the
   frame's inner top): the letterhead 11pt bold on 1.5 lines (51.9, 77.2,
   102.5), centred where Word's text box is; MÃ BỆNH NHÂN 11pt plain, flush
   right 41.8px in (162.8), MÃ LƯU TRỮ — not in HC-01 — on the box's second
   line under it; the title 34pt (350.7, 423.9); NĂM 20 at 20pt plain (479.8);
   the patient's lines 13pt, 34px in, on 1.5 lines 10pt apart, each blank
   running to 41.6px from the frame (594.7, 640.0, 683.3), Phường/Xã — not in
   HC-01 — at the same pitch, the treatment dates on single lines; the MÃ
   BỆNH box 12pt in a 1px frame 270.9 × 161px, 213.3px in, its blanks ending
   58px short of its right side, the box 22px lower than Word's for the extra
   Phường/Xã line. Empty paragraphs give no gap: the margins below do. */
.nfc-tpl[data-form="1"] table[data-cover]{border-collapse:separate;border-spacing:0;border:4px solid #1c334e!important;margin:-9.55px 0 0 28.25px;width:688px!important;max-width:none!important;min-height:0}
.nfc-tpl[data-form="1"] table[data-cover]>colgroup>col{width:680px!important;max-width:none!important}
.nfc-tpl[data-form="1"] table[data-cover]>tbody>tr>td{border:0!important;padding:0;height:1040px;font-size:17.333px}
.nfc-tpl[data-form="1"] table[data-cover]>tbody>tr>td>p:is(:empty,[data-spacer]){display:none}
.nfc-tpl[data-form="1"] table[data-cover] h4{font-size:14.667px;line-height:25.3px;margin:0;padding-right:13.4px}
.nfc-tpl[data-form="1"] table[data-cover]>tbody>tr>td>h4:first-child{margin-top:34.3px}
.nfc-tpl[data-form="1"] table[data-cover] :is(h4,h3>span,h1) span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl[data-form="1"] table[data-cover] p[style*="text-align: right"]{font-size:14.667px;line-height:25.3px!important;margin:0;padding-right:41.8px}
.nfc-tpl[data-form="1"] table[data-cover] p[style*="text-align: right"]:has([data-medical-record-field="cover.patient.code"]){margin-top:35px}
.nfc-tpl[data-form="1"] table[data-cover] p[style*="text-align: right"] strong{font-weight:400}
.nfc-tpl[data-form="1"] table[data-cover] p[style*="text-align: right"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl[data-form="1"] table[data-cover] h1{font-size:45.333px;line-height:73.2px!important;margin:103px 0 0}
.nfc-tpl[data-form="1"] table[data-cover] h3{font-size:26.667px;line-height:35.2px;margin:8px 0 0;font-weight:400}
.nfc-tpl[data-form="1"] table[data-cover] h3>span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl[data-form="1"] table[data-cover]>tbody>tr>td>p:not([style*="text-align"]){font-size:17.333px;line-height:29.9px!important;margin:0 0 13.4px;padding:0 45px 0 34px}
.nfc-tpl[data-form="1"] table[data-cover]>tbody>tr>td>p:has([data-medical-record-field="cover.patient.name"]){margin:85.5px 0 15.4px;padding-right:41.6px}
.nfc-tpl[data-form="1"] table[data-cover]>tbody>tr>td>p:has([data-medical-record-field="cover.patient.ward"]){margin-bottom:18.5px}
/* Nam / Nữ as HC-01's ⬜ (clinic, 2026-11-25: "ô checkbox chỗ bìa nên to hơn"):
   18px, its foot 3px under the line's baseline, ~7.5px before its label — the
   cover only; every other box, page 3's too, stays the forms' 12px. */
.nfc-tpl[data-form="1"] table[data-cover] .nfc-medical-record-checkbox{width:18px;height:18px;margin:0 3px 0 1px;vertical-align:-3px}
.nfc-tpl[data-form="1"] table[data-cover]>tbody>tr>td>p:has(:is([data-medical-record-field="cover.text.2"],[data-medical-record-field="cover.text.5"])){line-height:19.9px!important}
.nfc-tpl[data-form="1"] table[data-cover] table[data-borderless]{margin:31.2px 0 0;width:100%}
.nfc-tpl[data-form="1"] table[data-cover] table[data-borderless]>colgroup>col:nth-child(1){width:213.3px!important}
.nfc-tpl[data-form="1"] table[data-cover] table[data-borderless]>colgroup>col:nth-child(2){width:270.9px!important}
.nfc-tpl[data-form="1"] table[data-cover] table[data-borderless]>tbody>tr>td{padding:0}
.nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]){margin:0;border:1px solid #000}
.nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless])>tbody>tr>td{font-size:16px;padding:8.7px 0 16px 9.8px}
.nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]) td>p{line-height:27.6px!important;margin:0 0 8px}
.nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]) td>p:last-child{margin-bottom:0}
.nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]) .nfc-medical-record-text-field{display:block;width:100%;box-sizing:border-box}
.nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]) td>p:has(.nfc-medical-record-text-field){display:flex;align-items:baseline;white-space:nowrap;padding-right:57.7px}
.nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]) td>p>span:has(.nfc-medical-record-text-field){flex:1 1 auto;min-width:0;margin-left:.3em}
/* "NĂM 20" + the year blank read as one number, "NĂM 2026" (BA, 2026-11-23: "cho sát vô"):
   the h3's centring put the digits in the middle of the blank, a gap after "20".
   The digits start at the blank's left edge; the blank keeps its width (left
   padding moved right), written or not. */
.nfc-tpl .nfc-medical-record-text-field[data-medical-record-field="cover.year"]{padding:0 6px 0 0;text-align:left}
.nfc-tpl[data-form="1"]>table:is(:nth-of-type(2),:nth-of-type(3),:nth-of-type(4))>tbody>tr>:is(td,th){vertical-align:middle}
.nfc-tpl[data-form="1"]>table:not([data-cover],[data-borderless])>tbody>tr>:is(td,th){padding:8.6px 8px 0}
.nfc-tpl[data-form="1"]>table:not([data-cover],[data-borderless])>tbody>tr>:is(td,th)>p{line-height:20.5px!important;margin:0 -6px 3px 0}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr>:is(td,th){padding:4px 8px 0}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr>:is(td,th)>p{line-height:18.133px!important;margin-bottom:0}
.nfc-tpl[data-form="1"]>table[data-borderless]>tbody>tr>td{padding:2px 5px 0 7px}
.nfc-tpl[data-form="1"]>table[data-borderless]>tbody>tr>td>p{line-height:22.13px!important;margin:0}
.nfc-tpl[data-form="1"]>table[data-borderless]>tbody>tr>td>p:first-child{margin-top:0.23px}
.nfc-tpl[data-form="1"]>table:not([data-cover])>tbody>tr>th>p{margin-right:0}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:first-child>th:is(:nth-child(1),:nth-child(2))>p{margin-top:3.4px}
.nfc-tpl[data-form="1"]>h2{transform:scaleX(.98)}
.nfc-tpl[data-form="1"]>h2:nth-of-type(1){line-height:1.725;margin:2.75px 0 7.05px}
.nfc-tpl[data-form="1"]>h2:nth-of-type(2){line-height:20px;margin:7.7px 0 2.4px}
.nfc-tpl[data-form="1"]>table:nth-of-type(2){width:680px!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>colgroup>col:nth-child(1){width:8.26%!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>colgroup>col:nth-child(2){width:41.7%!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>colgroup>col:nth-child(3){width:23.62%!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>colgroup>col:nth-child(4){width:auto!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:first-child>:is(td,th){height:54.2px}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:nth-child(2)>td{height:89.5px}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:nth-child(n+3)>td{height:69.2px}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:is(:nth-child(7),:nth-child(9))>td{height:48.8px}
/* Page 3 (clinic, 2026-11-25): the tick columns only as wide as they need —
   "Đầy đủ/Đạt" on one line; the Phân loại ticks, which have no heading, a box
   wide — and the rest to the text beside them, so it wraps less. Then room to
   sign under "(Ký, ghi rõ họ tên)" of Người giao / Người nhận hồ sơ. */
.nfc-tpl[data-form="1"]>table:nth-of-type(3)>colgroup>col:is(:nth-child(2),:nth-child(4)){width:106px!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(3)>colgroup>col:is(:nth-child(1),:nth-child(3)){width:auto!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(4)>colgroup>col:nth-child(2){width:60px!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(4)>colgroup>col:nth-child(3){width:234px!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(4)>colgroup>col:nth-child(1){width:auto!important}
.nfc-tpl[data-form="1"]>table[data-borderless]:last-of-type td>p{padding-bottom:66.4px}
@media print{
  .nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]) .nfc-medical-record-text-field{border-bottom:1px dotted #000!important;--nfc-dots:1!important}
}
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
/* Giấy đồng ý phẫu thuật/thủ thuật, "Tê môi, tê lưỡi …": the side written there in bold (clinic, 2026-11-09). */
.nfc-tpl [data-medical-record-field="surgery-consent.text.21"]{font-weight:700}
.nfc-tpl .nfc-medical-record-text-field:empty::before{content:attr(data-placeholder);color:#9ca3af;font-style:italic}
.nfc-tpl .nfc-medical-record-text-field[data-placeholder="Nhập nội dung"]:empty::before{content:''}
.nfc-tpl .nfc-medical-record-text-field:focus{background:#fff9c4;outline:2px solid #f59e0b}
/*
 * A blank held still for a selection across lines (R-1179) keeps the shape it
 * had while editable. Chrome gives an editable its own line break rule, and an
 * empty one a line to put the caret on; without that line an empty blank sits
 * on its bottom edge, every line holding one grows, and the sheet jumps under
 * the pointer as the drag begins. The invisible character is that line.
 */
.nfc-tpl [data-held-editable]{line-break:after-white-space}
.nfc-tpl .nfc-medical-record-text-field[data-held-editable]:empty::before{content:attr(data-placeholder) "\200b"}
.nfc-tpl .nfc-medical-record-text-field[data-held-editable][data-placeholder="Nhập nội dung"]:empty::before{content:"\200b"}
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
  .nfc-tpl .nfc-medical-record-text-field:empty::before{content:'';font-style:normal}
  /* The dots finer than a 1px dotted border (BA, 2026-11-22, R-1270: "dấu chấm này chỉnh nhỏ hơn"):
     Chrome prints any border under 1px at 1px, so the border only says whether a
     blank has dots — every rule above still decides that, and sets --nfc-dots
     beside it — and is drawn clear. :not(#_) outranks those rules' !important.
     The dots themselves are Word's (owner, 2026-11-23, R-1284: "chỗ trống là
     dấu chấm chứ đâu phải line ngang"): a run of full stops on the line the
     words stand on, as Word's dotted tab leader prints, clipped at the blank's
     end. Type, not a border or a picture, so it prints sharp whatever the
     printer's background setting. It is set on the blank's own first line
     (same top, same line height), so it stands where the words do. */
  .nfc-tpl .nfc-medical-record-text-field:not(#_){position:relative;border-bottom-color:transparent!important}
  .nfc-tpl .nfc-medical-record-text-field::after{content:"${".".repeat(320)}";position:absolute;left:0;right:0;top:0;overflow:hidden;white-space:nowrap;line-height:inherit;font-style:normal;font-weight:400;letter-spacing:0;text-align:left;color:#000;opacity:var(--nfc-dots,1);pointer-events:none}
  /* A blank with something written in it prints with no dots (BA, 2026-11-22, R-1270: "nếu như có data bỏ hết dấu ... đi"). */
  .nfc-tpl .nfc-medical-record-text-field:not(:empty)::after{display:none}
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
  }
  /* MS, the form's own code (BA, 2026-10-29, R-1069): nobody writes in it, so
     it reads as plain text on screen and on paper — no box, tint or dotted line. */
  .nfc-tpl .nfc-medical-record-text-field[data-form-code="true"]{display:inline;min-width:0!important;min-height:0;padding:0;line-height:inherit;border:0!important;--nfc-dots:0!important;outline:none!important;background:none!important;color:inherit!important}`;

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
 * Mẫu 2, mẫu 6 and mẫu 7 are the exceptions (clinic, 2026-10-28 and
 * 2026-10-29, R-1067, R-1068 and R-1073): 15mm on every edge of every page,
 * so their pages are a named page with that margin — the A4 and the page
 * number still come from the rule above — and the sheet itself adds none.
 * Mẫu 10, the clinic's contract, joined them (R-1079), and mẫu 12, the
 * surgical count sheet (2026-11-16). Mẫu 11, the surgical safety checklist,
 * is the one landscape sheet: its own page, `surgical-safety`, A4 on its side
 * with 10mm at top and sides and 5mm at the bottom, as the BA's Word copy
 * (R-1283; 5mm at the top before, 2026-11-16) — Chrome takes a named page's
 * size, so a job printing it among the upright forms turns only its sheet.
 * Mẫu 7 has its own page too, `procedure-record`: 12.5mm above, 7.5mm below,
 * 15mm at the sides, as its Word copy (R-1280). Mẫu 2 then gave up
 * 8mm at the foot of each page for room to space its lines (2026-11-12): its
 * own page, `outpatient-dental`, 15mm on three edges and 7mm at the bottom.
 *
 * Every other sheet is on a named page too, `margin-5mm`, which has no rule of
 * its own and so is exactly the page above (R-1070). Chrome starts a new page
 * wherever the page name changes, so anything printed after a 15mm sheet that
 * is not on that name gets a page to itself — blank, when it is a browser
 * extension's empty block the app cannot hide. The name lets the app's
 * document wear the last sheet's page (medical-record.css) and leave nothing
 * to change at.
 *
 * The empty @top-center is there so Chrome prints no header of its own — the
 * date and time and the page's title over the top margin (clinic 2026-11-16,
 * seen on the 15mm sheets; a 5mm margin is too narrow for it). Chrome leaves
 * out its header once the page has a top margin box of the author's, as the
 * page number in @bottom-right already left out its footer; measured on
 * Chromium's own print-to-PDF, which draws both by default. The margins, and
 * so every sheet's layout, stay as they are.
 *
 * This is the part that has to travel with the sheet wherever it is printed
 * from. Printing the sheet's *frame* from outside cannot honour it: an iframe
 * is one box to the printer, and it gets sliced wherever the outer page ends,
 * through the middle of a row.
 */
const SHEET_PRINT_CSS = String.raw`
    @page{size:A4;margin:5mm;@top-center{content:""}@bottom-right{content:counter(page);font-family:${SHEET_FONT_FAMILY};font-size:10pt;color:#000}}
    @page margin-15mm{margin:15mm}
    @page consent-form{margin:15mm calc(15mm - 6px) 7.5mm 15mm}
    @page outpatient-dental{margin:15mm 15mm 7mm}
    @page procedure-record{margin:12.5mm 15mm 7.5mm}
    @page orthodontic-contract{margin:20mm 10mm 20mm 17.5mm}
    @page surgical-safety{size:A4 landscape;margin:10mm 10mm 5mm}
    @media print{
      .nfc-tpl{page:margin-5mm;width:200mm;height:auto;min-height:0;margin:0 auto;padding:7mm;box-shadow:none}
      .nfc-tpl:is([data-form="2"],[data-form="6"],[data-form="7"],[data-form="10"],[data-form="12"]){page:margin-15mm;width:auto;margin:0;padding:0}
      .nfc-tpl[data-form="2"]{page:outpatient-dental}
      /* Mẫu 7: 12.5mm above, 7.5mm below, as the BA's Word copy (R-1280). */
      .nfc-tpl[data-form="7"]{page:procedure-record}
      /* Mẫu 10: 20mm above and below, 17.5mm left, 10mm right, as the BA's Word copy (R-1299). */
      .nfc-tpl[data-form="10"]{page:orthodontic-contract}
      /* Mẫu 6: 7.5mm below (12.5mm before, clinic 2026-11-25), as mẫu 7 — the
         room it gives page 2 goes to the signatures. */
      .nfc-tpl[data-form="6"]{page:consent-form;padding-right:6px}
      /* Mẫu 4: 10mm above the page, as the BA's Word copy (2026-11-22). */
      .nfc-tpl[data-form="4"]{padding-top:calc(5mm - 2px)}
      .nfc-tpl[data-form="11"]{page:surgical-safety;width:auto;min-height:0;margin:0;padding:0}
      .nfc-tpl>hr{height:0;margin:0;border:0;break-after:page;page-break-after:always}
      /* Nothing empty runs on to a page of its own (2026-11-21): the 7mm under
         a 5mm sheet's last line, and a 3px gap closing a page, each moved whole
         to a fresh page when the page was full to within a few px, and the
         printer gave out a blank one. The paper's own 5mm still stands under
         the last line. */
      .nfc-tpl{padding-bottom:0}
      .nfc-tpl>p[data-spacer]:is(:last-child,:has(+hr)){display:none}
      /* The same for the bottom margin of the last box of a page — of the
         sheet, kept inside it by its closing ::after (mẫu 9, a table ending
         0.2px above the foot), or before a page break (mẫu 6, a page full to
         the foot): it went on to a page of its own. */
      .nfc-tpl>:not([data-spacer]):not(:has(~ :not([data-spacer]))),
      .nfc-tpl>:not([data-spacer]):is(:has(+hr),:has(+p[data-spacer]+hr)){margin-bottom:0}
      .nfc-tpl .nfc-medical-record-checkbox{accent-color:#2671d8;print-color-adjust:exact;-webkit-print-color-adjust:exact}
      /* Every form's text justified on paper (clinic, 2026-11-25): a paragraph
         running onto a second line printed with a ragged right edge. Set on
         the sheet so it is inherited — whatever states its own alignment (the
         titles, the centred and right-hand lines, the header cells, the lines
         matched to the BA's Word) keeps it. Justifying only spreads the spaces
         of a line that already wraps: no line breaks, so no page, moves. */
      .nfc-tpl{text-align:justify}
    }`;

/*
 * The frame around the sheet inside its own document: one white A4 page on a
 * grey ground, with `<hr>` drawn as a dashed rule between pages.
 */
export const SHEET_PAGE_CSS = String.raw`    html,body{margin:0;min-height:100%;background:#f0f0f0}
    body{padding:20px;box-sizing:border-box}
    .nfc-tpl{width:210mm;min-height:297mm;margin:0 auto;padding:12mm;box-sizing:border-box;background:#fff;box-shadow:0 0 10px rgba(0,0,0,.1)}
    .nfc-tpl:is([data-form="2"],[data-form="6"],[data-form="7"],[data-form="10"],[data-form="12"]){padding:15mm}
    .nfc-tpl[data-form="4"]{padding-top:10mm}
    .nfc-tpl[data-form="7"]{padding:12.5mm 15mm 7.5mm}
    .nfc-tpl[data-form="10"]{padding:20mm 10mm 20mm 17.5mm}
    .nfc-tpl[data-form="11"]{width:297mm;min-height:210mm;padding:10mm 10mm 5mm}
    .nfc-tpl>hr{margin:28px 0;border:0;border-top:2px dashed #b7c0ce}
    ${SHEET_FIELD_CSS}
    @media print{html,body{width:210mm;height:auto!important;min-height:0!important;margin:0;padding:0;background:#fff}}
    @media print{html:has(.nfc-tpl:is([data-form="2"],[data-form="6"],[data-form="7"],[data-form="10"],[data-form="11"],[data-form="12"])),html:has(.nfc-tpl:is([data-form="2"],[data-form="6"],[data-form="7"],[data-form="10"],[data-form="11"],[data-form="12"])) body{width:auto}}
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
    .nfc-tpl:is([data-form="2"],[data-form="6"],[data-form="7"],[data-form="10"],[data-form="12"]){padding:15mm}
    .nfc-tpl[data-form="4"]{padding-top:10mm}
    .nfc-tpl[data-form="7"]{padding:12.5mm 15mm 7.5mm}
    .nfc-tpl[data-form="10"]{padding:20mm 10mm 20mm 17.5mm}
    .nfc-tpl[data-form="11"]{width:297mm;padding:10mm 10mm 5mm}
    .nfc-tpl>hr{margin:0;border:0}
${SHEET_FIELD_CSS}
${SHEET_PRINT_CSS}
  `;
