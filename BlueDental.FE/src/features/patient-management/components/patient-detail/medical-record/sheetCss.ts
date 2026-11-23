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
.nfc-tpl[data-form="1"]{font-size:17px}
.nfc-tpl[data-form="4"],.nfc-tpl[data-form="5"]{font-size:16px}
.nfc-tpl[data-form="9"]{font-size:15.5px}
.nfc-tpl[data-form="3"]{font-size:15px}
.nfc-tpl[data-form="8"]{font-size:14px}
/* Mẫu 2 at the BA's 12pt (R-1268, block further down). */
.nfc-tpl[data-form="2"]{font-size:16px}
/* 14px from the clinic's own copy, inside 15mm margins (R-1073). */
.nfc-tpl[data-form="7"]{font-size:14px}
/* Mẫu 10, the clinic's contract, as the clinic's own copy of it
   (docs/mau10-mac-cai.html, 2026-11-21): 20px on lines a line and a half
   apart — paragraphs, the national heading, the titles, the section heads;
   each line of a label and a blank on one line, the dotted blank stretching
   to the right margin; Bên A's company in bold; "Loại mắc cài" a label line
   over two rows of two choices lined up. In SHEET_CSS, so the print copy
   draws it too. */
.nfc-tpl[data-form="10"]{font-size:20px}
.nfc-tpl.nfc-tpl[data-form="10"] :is(p,h1,h2){line-height:1.5!important}
.nfc-tpl.nfc-tpl[data-form="10"] p:has(> span > .nfc-medical-record-text-field):not(:has(> input,[data-medical-record-field="orthodontic-contract.text.1"])){display:flex;align-items:baseline;gap:.3em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="10"] p:has(> span > .nfc-medical-record-text-field):not(:has(> input,[data-medical-record-field="orthodontic-contract.text.1"]))>span{flex:1 1 auto;min-width:0;white-space:pre-wrap}
.nfc-tpl.nfc-tpl[data-form="10"] p:has(> span > .nfc-medical-record-text-field):not(:has(> input,[data-medical-record-field="orthodontic-contract.text.1"]))>span>.nfc-medical-record-text-field{width:100%!important;min-width:0!important;max-width:none}
.nfc-tpl[data-form="10"] [data-medical-record-field="orthodontic-contract.party-a.name"]{font-weight:700}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"]{display:grid;grid-template-columns:1.5em minmax(0,1fr) minmax(0,1fr);column-gap:1.5em;align-items:baseline;white-space:nowrap}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"]>.bracket-label{grid-column:1/-1}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"]>.bracket-opt:is(:nth-child(2),:nth-child(5)){grid-column:2}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"] .bracket-opt{display:flex;align-items:baseline;gap:.25em;min-width:0}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"] .bracket-opt>.nfc-medical-record-checkbox{flex:none;margin:0 .15em 0 0;align-self:center}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"] .bracket-opt>span:has(>.nfc-medical-record-text-field){flex:1 1 0;min-width:2.5em}
.nfc-tpl[data-form="10"] p[data-record-section="bracket-types"] .bracket-opt .nfc-medical-record-text-field{width:100%!important;min-width:0!important}
/* The clinic's surgical checklists (2026-11-16): the count sheet (mẫu 12) is
   set at the BA's Word sizes further down (R-1276); the safety checklist (mẫu 11), three
   columns on A4 landscape inside 10mm, at 13px on 1.36 lines — 12px read too
   small, 14px a touch large (clinic 2026-11-16). The room left at the foot
   went into the line pitch and the gaps between sections ("hơi khít"), the
   sheet still one page with ~15px to spare. */
.nfc-tpl[data-form="11"]{font-size:13px}
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
   tab stops at 569 and 1703 twips. */
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
.nfc-tpl.nfc-tpl[data-form="2"] p>input.nfc-medical-record-checkbox{margin:0 .9px}
.nfc-tpl[data-form="2"] table:has(.record-ids)>colgroup>col:first-child{width:378px!important}
.nfc-tpl[data-form="2"] table:has(.record-ids)>tbody>tr>td:first-child>p{white-space:nowrap}
.nfc-tpl[data-form="2"] table:has(.record-ids)>colgroup>col:last-child{width:auto!important}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-page="outpatient-main"] p.record-ids{grid-template-columns:75.6px minmax(0,1fr);column-gap:0;row-gap:0;width:auto;margin:0 0 0 43.4px;font-size:13.333px;line-height:1.725!important}
.nfc-tpl.nfc-tpl[data-form="2"] table[data-record-section="general-exam"]>tbody>tr>td>p{line-height:32px!important;margin:0}
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
/* Loại 40px under the Word width so "Ngày … tháng … năm …" stays on one line (R-1277); the last col (auto) takes it. */
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
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.108"]{min-width:140px!important}
/* Người nhận hồ sơ's "Họ tên ......" on one line, as in Word (R-1270). */
.nfc-tpl.nfc-tpl[data-form="2"] [data-medical-record-field="outpatient-dental.text.107"]{min-width:120px!important}
/* Mẫu 4 as the BA's Word copy (Mau-04-Phieu-tu-van.docx, 2026-11-22, R-1273), as mẫu
   2 above: Times New Roman at its own height; every line 1.35 of Word's (1.5525
   × the size), no space around paragraphs or under the titles; the text and
   blanks 12.5pt, "PHIẾU TƯ VẤN" 16pt, "NỘI DUNG TIẾP XÚC…" 14pt, the
   letterhead 11pt bold centred in Word's 407px column; 10mm above the page.
   "Chúng tôi là:" in Word's tab stops — "Chức vụ:" at 378px, "2." under "1." —
   and the blanks Word draws to the right margin (both rows, Địa chỉ, Số hồ sơ
   y tế, Ngày thực hiện) stretch to it; the one after "Đã tiếp xúc…" is a line
   of its own. The signatures keep their room to sign. */
.nfc-tpl[data-form="4"]{--nfc-letter-height:none;font-size:16.667px}
.nfc-tpl[data-form="4"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="4"] :is(p,h1,h2){line-height:1.5525!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="4"]>p:first-child{display:block!important;width:407px;font-size:14.667px}
.nfc-tpl.nfc-tpl[data-form="4"]>h1{font-size:21.333px}
.nfc-tpl.nfc-tpl[data-form="4"]>h2{font-size:18.667px}
.nfc-tpl.nfc-tpl[data-form="4"]>:is(h1,h2)>br,.nfc-tpl.nfc-tpl[data-form="4"]>p[data-spacer]{display:none}
.nfc-tpl.nfc-tpl[data-form="4"]>table{margin:0}
.nfc-tpl.nfc-tpl[data-form="4"]>table>tbody>tr>td{padding-top:0;padding-bottom:0}
.nfc-tpl.nfc-tpl[data-form="4"]>table:first-of-type>tbody>tr>td:first-child{padding-left:0}
.nfc-tpl[data-form="4"]>table:first-of-type>colgroup>col:first-child{width:384px!important}
.nfc-tpl[data-form="4"]>table:first-of-type>colgroup>col:last-child{width:auto!important}
.nfc-tpl.nfc-tpl[data-form="4"]>table:first-of-type>tbody>tr:nth-child(2)>td:first-child>p{padding-left:91.2px}
.nfc-tpl[data-form="4"]>p:has(+table:last-of-type)>br:last-child{display:none}
.nfc-tpl.nfc-tpl[data-form="4"] p:has(>span>:is([data-medical-record-field="general-consultation.text.6"],[data-medical-record-field="general-consultation.text.7"],[data-medical-record-field="general-consultation.text.8"],[data-medical-record-field="general-consultation.text.9"],[data-medical-record-field="general-consultation.text.12"],[data-medical-record-field="general-consultation.text.13"],[data-medical-record-field="general-consultation.text.14"])){display:flex;align-items:baseline;gap:.3em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="4"] p:has(>span>:is([data-medical-record-field="general-consultation.text.6"],[data-medical-record-field="general-consultation.text.7"],[data-medical-record-field="general-consultation.text.8"],[data-medical-record-field="general-consultation.text.9"],[data-medical-record-field="general-consultation.text.12"],[data-medical-record-field="general-consultation.text.13"],[data-medical-record-field="general-consultation.text.14"]))>span:last-of-type{flex:1 1 auto;min-width:0;white-space:pre-wrap}
.nfc-tpl.nfc-tpl[data-form="4"] :is([data-medical-record-field="general-consultation.text.6"],[data-medical-record-field="general-consultation.text.7"],[data-medical-record-field="general-consultation.text.8"],[data-medical-record-field="general-consultation.text.9"],[data-medical-record-field="general-consultation.text.12"],[data-medical-record-field="general-consultation.text.13"],[data-medical-record-field="general-consultation.text.14"]){width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="4"] .nfc-medical-record-text-field{min-height:1em}
.nfc-tpl.nfc-tpl[data-form="4"] [data-medical-record-field="general-consultation.text.10"]{display:block;width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box;min-height:1.5525em;line-height:1.5525}
/* Mẫu 3 as the BA's Word copy (Mau-03-Ho-so-benh-nhan-chinh-nha.docx,
   2026-11-22, R-1272), as mẫu 4: the lines outside the exam tables in Times New Roman
   at its own height, 12.5pt on Word's 1.5 lines (1.725 × the size), no space
   around paragraphs; the headings 14pt, the title 16pt, the letterhead 12pt
   bold centred in Word's 384px column with MÃ NGOẠI TRÚ 10pt beside it. The
   exam tables keep their type. Word's tab stops become grid columns: Giới
   tính, the TMJ ticks, Loại mắc cài; and the blanks Word draws to the right
   margin stretch to it. The pages break where the BA's copy breaks them: no
   longer after IV (the export left that break out, and at these sizes it
   left Cằm alone on a page) nor before VI; VIII still starts a page. */
.nfc-tpl.nfc-tpl[data-form="3"]>:is(p,h1,h2,h3),.nfc-tpl.nfc-tpl[data-form="3"]>table:is(:first-of-type,:last-of-type){font-size:16.667px;font-size-adjust:none}
.nfc-tpl.nfc-tpl[data-form="3"]>:is(p,h1,h2,h3){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="3"]>:is(h1,h2) span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="3"]>h1{font-size:21.333px;margin:7.9px 0 4.1px}
.nfc-tpl.nfc-tpl[data-form="3"]>h2{font-size:18.667px}
.nfc-tpl.nfc-tpl[data-form="3"]>h2:nth-of-type(4){margin-top:11.73px;line-height:24.27px!important}
.nfc-tpl.nfc-tpl[data-form="3"]>h2:nth-of-type(6){margin-top:18.5px}
.nfc-tpl.nfc-tpl[data-form="3"]>h2:nth-of-type(7){margin-top:10.35px}
.nfc-tpl.nfc-tpl[data-form="3"]>h3{margin-top:12.65px}
.nfc-tpl.nfc-tpl[data-form="3"]>h1>br,.nfc-tpl.nfc-tpl[data-form="3"]>p[data-spacer]:not(table+p),.nfc-tpl.nfc-tpl[data-form="3"]>hr:first-of-type,.nfc-tpl.nfc-tpl[data-form="3"]>[data-page-break]{display:none!important}
.nfc-tpl.nfc-tpl[data-form="3"]>:is(h2,h3){break-after:avoid-page;page-break-after:avoid}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>input){padding-bottom:1.85px}
.nfc-tpl.nfc-tpl[data-form="3"]>p:is(:has(>input[data-medical-record-field="orthodontic.checkbox.1"]),:has(>input[data-medical-record-field="orthodontic.checkbox.6"]),:has(>input[data-medical-record-field="orthodontic.checkbox.46"])){padding-bottom:4.5px}
.nfc-tpl.nfc-tpl[data-form="3"]>table+p[data-spacer]{height:10px}
.nfc-tpl.nfc-tpl[data-form="3"]>table{margin:1.5px 0 0}
.nfc-tpl.nfc-tpl[data-form="3"]>table:first-of-type{margin:5.9px 0 0}
.nfc-tpl.nfc-tpl[data-form="3"]>table:nth-of-type(3){margin-top:6px}
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
.nfc-tpl.nfc-tpl[data-form="3"]>p[data-record-section="orthodontic-agreement"]{margin-top:0}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>span>:is([data-medical-record-field="orthodontic.text.2"],[data-medical-record-field="orthodontic.patient.job"],[data-medical-record-field="orthodontic.patient.address"],[data-medical-record-field="orthodontic.patient.phone"],[data-medical-record-field="orthodontic.text.5"],[data-medical-record-field="orthodontic.text.6"],[data-medical-record-field="orthodontic.text.7"],[data-medical-record-field="orthodontic.text.8"],[data-medical-record-field="orthodontic.text.21"])){display:flex;align-items:baseline;gap:.25em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="3"]>p:has(>span>:is([data-medical-record-field="orthodontic.text.2"],[data-medical-record-field="orthodontic.patient.job"],[data-medical-record-field="orthodontic.patient.address"],[data-medical-record-field="orthodontic.patient.phone"],[data-medical-record-field="orthodontic.text.5"],[data-medical-record-field="orthodontic.text.6"],[data-medical-record-field="orthodontic.text.7"],[data-medical-record-field="orthodontic.text.8"],[data-medical-record-field="orthodontic.text.21"]))>span:last-child{flex:1 1 auto;min-width:0}
.nfc-tpl.nfc-tpl[data-form="3"] :is([data-medical-record-field="orthodontic.text.1"],[data-medical-record-field="orthodontic.text.2"],[data-medical-record-field="orthodontic.patient.name"],[data-medical-record-field="orthodontic.patient.job"],[data-medical-record-field="orthodontic.patient.address"],[data-medical-record-field="orthodontic.patient.phone"],[data-medical-record-field="orthodontic.text.5"],[data-medical-record-field="orthodontic.text.6"],[data-medical-record-field="orthodontic.text.7"],[data-medical-record-field="orthodontic.text.8"],[data-medical-record-field="orthodontic.text.21"],[data-medical-record-field="orthodontic.text.100"],[data-medical-record-field="orthodontic.text.101"],[data-medical-record-field="orthodontic.text.102"],[data-medical-record-field="orthodontic.text.103"]){width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="3"] [data-medical-record-field="orthodontic.patient.date-of-birth"]{min-width:129px!important}
.nfc-tpl.nfc-tpl[data-form="3"] :is([data-medical-record-field="orthodontic.text.3"],[data-medical-record-field="orthodontic.text.4"]){min-width:102px!important}
.nfc-tpl.nfc-tpl[data-form="3"] .nfc-medical-record-text-field{min-height:1em}
/* Mẫu 5 as the BA's Word copy (Mau-05-Phieu-tu-van-va-xac-nhan-dong-y-dieu-
   tri.docx, 2026-11-22, R-1274), as mẫu 3: Times New Roman at its own height, 12.5pt on
   Word's 1.5 lines, no space around paragraphs; the headings 14pt, the title
   16pt on Word's exact 28.8pt line; the letterhead 12pt bold on exact 15.6pt
   lines centred in Word's 397px column, "Mã hồ sơ" 10pt at Word's 445px. The
   tick rows are as tall as Word draws them (its tick glyph stands above the
   line). The BA left the cost rows, "(tổng tiền viết bằng chữ)" and VII's
   text at the form's old 13.5pt, so they stay at it. The signatures in Word's
   exact lines, the empty lines after the first gone, as in the BA's copy; the
   blanks run to the right margin, as on mẫu 3 and 4. */
.nfc-tpl[data-form="5"]{--nfc-letter-height:none;font-size:16.667px}
.nfc-tpl[data-form="5"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="5"]>:is(p,h1,h2){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="5"]>h1{font-size:21.333px;line-height:22px!important;margin:23.2px 0 0}
.nfc-tpl.nfc-tpl[data-form="5"]>h2{font-size:18.667px;line-height:29.5px!important;padding-bottom:2.7px}
.nfc-tpl.nfc-tpl[data-form="5"]>p[data-spacer]{display:none}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type{margin:0}
.nfc-tpl[data-form="5"]>table:first-of-type>colgroup>col:first-child{width:395px!important}
.nfc-tpl[data-form="5"]>table:first-of-type>colgroup>col:last-child{width:auto!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td{padding:0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:first-child{padding-top:9.3px}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:first-child>p{display:block!important;white-space:nowrap;line-height:20.8px!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:first-child span[style*="font-size"]{font-size:16px!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child>p{display:flex;align-items:baseline;white-space:nowrap;text-align:left;margin:0;padding:7.4px 0 0 49.7px;line-height:20.8px!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child span[style*="font-size"]{font-size:13.333px!important}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child>p>span:last-child{flex:1 1 auto;min-width:0;margin-left:.3em}
.nfc-tpl[data-form="5"] [data-medical-record-field="consultation.text.1"]{width:100%!important;min-width:0!important;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child>p[data-medical-record-generated-row]{padding:0 0 0 112.8px}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr>td:last-child>p[data-medical-record-generated-row]>span{margin-left:0}
.nfc-tpl.nfc-tpl[data-form="5"]>table:first-of-type>tbody>tr{height:89.2px}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-methods"] p,.nfc-tpl.nfc-tpl[data-form="5"]>p[data-record-section="consultation-other"],.nfc-tpl.nfc-tpl[data-form="5"]>p:has(>input){line-height:1.725!important;padding-bottom:4.5px}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] td,.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] tr:last-child>th,.nfc-tpl.nfc-tpl[data-form="5"]>table[data-record-section="consultation-cost"]+p,.nfc-tpl.nfc-tpl[data-form="5"]>h2:nth-of-type(7)~p{font-size:18px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-borderless]:not(:first-of-type):not([data-record-section]){margin:0 0 -3.3px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-borderless]:not(:first-of-type):not([data-record-section])>tbody>tr>td{padding-top:6.9px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-borderless]:not(:first-of-type):not([data-record-section]):last-of-type>tbody>tr>td{padding-top:10.1px}
.nfc-tpl.nfc-tpl[data-form="5"]>h2:nth-of-type(5){letter-spacing:-.25px;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-borderless]:not(:first-of-type):not([data-record-section]) p{line-height:20.8px!important}
.nfc-tpl.nfc-tpl[data-form="5"] .nfc-medical-record-text-field{min-height:1em}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] p{line-height:23.4px!important}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] tr:first-child p{line-height:21.9px!important}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"]{margin:4.1px 0 4px}
.nfc-tpl.nfc-tpl[data-form="5"] table[data-record-section="consultation-cost"] .nfc-medical-record-text-field{display:block!important;min-height:23.4px;line-height:23.4px}
.nfc-tpl.nfc-tpl[data-form="5"]>table[data-record-section="consultation-cost"]+p{display:flex;align-items:baseline;gap:.4em;white-space:nowrap}
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
   10 too, R-1079); the letterhead against the left margin and MS against the
   right; the first column of a borderless table on the left margin — on mẫu 6
   a box opening a line too. After the paragraph rules above, which it overrides. */
.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="10"],[data-form="12"]) p:not(:is([data-cover],[data-grid-cell]) *),.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="10"],[data-form="12"]) h1:not([data-cover] *),.nfc-tpl:is([data-form="6"],[data-form="7"],[data-form="10"],[data-form="12"]) h2{line-height:1.5!important}
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
.nfc-tpl[data-form="11"] .ss-arrow{width:46px;height:22px;vertical-align:middle}
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
  .nfc-tpl[data-form="11"] table[data-record-section="surgical-safety-stages"] .ss-note .nfc-medical-record-text-field{border-bottom:1px dotted #000!important}
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
/* Mẫu 6 as the BA's Word copy (Mau-06-Giay-dong-y-thuc-hien-phau-thuat-thu-
   thuat.docx, 2026-11-23, R-1275), as mẫu 3/4/5: Times New Roman at its own
   height, 12pt on Word's 1.3 lines, no space around paragraphs; the letterhead
   10pt bold on Word's 1.5 lines, MS 10pt where Word sets it; the Quốc hiệu 16pt
   and the title 14pt on 1.5 lines, I. and II. 14pt; the tick rows as tall as
   Word draws them; the signatures on 1.5 lines, the empty lines before the
   dotted name gone, as in the BA's copy; the blanks run to the right margin. */
.nfc-tpl[data-form="6"]{--nfc-letter-height:none;font-size:16px}
.nfc-tpl[data-form="6"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="6"] :is(p,h1,h2){line-height:1.495!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="6"]>:is(h1,h2){font-size:18.667px}
.nfc-tpl.nfc-tpl[data-form="6"]>h1{line-height:1.725!important;margin:18.7px 0 2.8px}
.nfc-tpl.nfc-tpl[data-form="6"]>h1>br{display:none}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child{margin:0}
.nfc-tpl[data-form="6"]>table:first-child>colgroup>col:first-child{width:321px!important}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr{height:96px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr>td{padding:0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child p{font-size:13.333px;line-height:1.725!important;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr>td:first-child>p{margin-left:-1.8px!important}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child>tbody>tr>td:last-child>p{text-align:left!important;padding-left:161px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:first-child+p{font-size:21.333px;line-height:1.725!important;margin-top:1.5px}
.nfc-tpl.nfc-tpl[data-form="6"]>table[data-borderless]:not(:first-child):not(:last-of-type){margin:1.3px 0 1.2px}
.nfc-tpl.nfc-tpl[data-form="6"]>p:has(>input[data-medical-record-field="surgery-consent.checkbox.12"]){padding:2.3px 0 1.2px}
.nfc-tpl.nfc-tpl[data-form="6"]>table[data-borderless]:not(:first-child):not(:last-of-type)>tbody>tr>td{padding-top:0;padding-bottom:0}
.nfc-tpl.nfc-tpl[data-form="6"]>table[data-borderless]:not(:first-child):not(:last-of-type) p{line-height:30.6px!important}
.nfc-tpl.nfc-tpl[data-form="6"]>hr+h2{margin-top:-2.9px}
.nfc-tpl.nfc-tpl[data-form="6"]>p:has(>input[data-medical-record-field="surgery-consent.checkbox.25"]){padding:2.9px 0 4.5px}
.nfc-tpl.nfc-tpl[data-form="6"]>p:has(>input[data-medical-record-field="surgery-consent.checkbox.26"]){padding-bottom:1.6px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:last-of-type{margin-top:24.7px}
.nfc-tpl.nfc-tpl[data-form="6"]>table:last-of-type p{line-height:1.725!important}
.nfc-tpl.nfc-tpl[data-form="6"]>table:last-of-type p>em+br~br{display:none}
.nfc-tpl.nfc-tpl[data-form="6"] p:is(:has(>span>[data-medical-record-field="surgery-consent.text.1"]),:has(>span>[data-medical-record-field="surgery-consent.text.2"]),:has(>span>[data-medical-record-field="surgery-consent.text.3"]),:has(>span>[data-medical-record-field="surgery-consent.text.4"]),:has(>span>[data-medical-record-field="surgery-consent.text.5"]),:has(>span>[data-medical-record-field="surgery-consent.text.6"]),:has(>span>[data-medical-record-field="surgery-consent.text.7"]),:has(>span>[data-medical-record-field="surgery-consent.text.8"]),:has(>span>[data-medical-record-field="surgery-consent.text.21"]),:has(>span>[data-medical-record-field="surgery-consent.patient.name"]),:has(>span>[data-medical-record-field="surgery-consent.text.9"]),:has(>span>[data-medical-record-field="surgery-consent.text.11"])){display:flex;align-items:baseline;gap:.25em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="6"] p:is(:has(>span>[data-medical-record-field="surgery-consent.text.1"]),:has(>span>[data-medical-record-field="surgery-consent.text.2"]),:has(>span>[data-medical-record-field="surgery-consent.text.3"]),:has(>span>[data-medical-record-field="surgery-consent.text.4"]),:has(>span>[data-medical-record-field="surgery-consent.text.5"]),:has(>span>[data-medical-record-field="surgery-consent.text.6"]),:has(>span>[data-medical-record-field="surgery-consent.text.7"]),:has(>span>[data-medical-record-field="surgery-consent.text.8"]),:has(>span>[data-medical-record-field="surgery-consent.text.21"]),:has(>span>[data-medical-record-field="surgery-consent.patient.name"]),:has(>span>[data-medical-record-field="surgery-consent.text.9"]),:has(>span>[data-medical-record-field="surgery-consent.text.11"]))>span{flex:1 1 auto;min-width:0}
.nfc-tpl.nfc-tpl[data-form="6"] p:is(:has(>span>[data-medical-record-field="surgery-consent.patient.name"]),:has(>span>[data-medical-record-field="surgery-consent.text.9"]))>span:last-child{flex:0 0 196px;margin:0 4.6px 0 4.1px}
.nfc-tpl.nfc-tpl[data-form="6"] p:is(:has(>span>[data-medical-record-field="surgery-consent.patient.name"]),:has(>span>[data-medical-record-field="surgery-consent.text.9"]))>span:first-child{margin-right:-14.3px}
.nfc-tpl.nfc-tpl[data-form="6"] :is([data-medical-record-field="surgery-consent.text.1"],[data-medical-record-field="surgery-consent.text.2"],[data-medical-record-field="surgery-consent.text.3"],[data-medical-record-field="surgery-consent.text.4"],[data-medical-record-field="surgery-consent.text.5"],[data-medical-record-field="surgery-consent.text.6"],[data-medical-record-field="surgery-consent.text.7"],[data-medical-record-field="surgery-consent.text.8"],[data-medical-record-field="surgery-consent.text.21"],[data-medical-record-field="surgery-consent.patient.name"],[data-medical-record-field="surgery-consent.patient.birth-year"],[data-medical-record-field="surgery-consent.text.9"],[data-medical-record-field="surgery-consent.text.10"],[data-medical-record-field="surgery-consent.text.11"]){width:100%!important;min-width:0!important;max-width:none;box-sizing:border-box}
.nfc-tpl.nfc-tpl[data-form="6"] .nfc-medical-record-text-field{min-height:1em}
/* Mẫu 12 as the BA's Word copy (Mau-12-Bang-kiem-dem-gac-dung-cu.docx,
   2026-11-23, R-1276): Times New Roman at its own height, 11.5pt on Word's 1.5
   lines, no space around paragraphs; the letterhead 11pt bold, MS 10pt where
   Word sets it; the title 16pt on one line; the count table's head on single
   lines, its rows as they were; the tick rows as tall as Word draws them; the
   blanks end where Word's tabs end them; the signatures on 1.5 lines, the
   empty lines before the name gone, as in the BA's copy. */
.nfc-tpl[data-form="12"]{--nfc-letter-height:none;font-size:15.333px}
.nfc-tpl[data-form="12"] span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl.nfc-tpl[data-form="12"] :is(p,h1){line-height:1.725!important;margin:0}
.nfc-tpl.nfc-tpl[data-form="12"]>table:first-child{margin:0}
.nfc-tpl[data-form="12"]>table:first-child>colgroup>col:first-child{width:368.6px!important}
.nfc-tpl.nfc-tpl[data-form="12"]>table:first-child>tbody>tr{height:90px}
.nfc-tpl.nfc-tpl[data-form="12"]>table:first-child>tbody>tr>td{padding:2px 0 0;vertical-align:top}
.nfc-tpl.nfc-tpl[data-form="12"]>table:first-child>tbody>tr>td:first-child>p{font-size:14.667px;line-height:21px!important;margin-left:5.7px!important}
.nfc-tpl.nfc-tpl[data-form="12"] p.record-ids{font-size:13.333px;line-height:21px!important;row-gap:0;column-gap:0;grid-template-columns:104px 1fr;width:auto;margin:0 0 0 56.6px}
.nfc-tpl.nfc-tpl[data-form="12"] p.record-ids .nfc-medical-record-text-field{width:100%!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="12"]>h1[data-record-section="surgical-count-title"]{font-size:21.333px;margin-top:7.9px}
.nfc-tpl.nfc-tpl[data-form="12"] [data-medical-record-field="surgical-count.patient.name"]{display:inline-block;width:295.6px!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="12"] [data-medical-record-field="surgical-count.patient.age"]{display:inline-block;width:49.8px!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="12"] [data-medical-record-field="surgical-count.patient.gender-male"]{margin:0 4.7px 0 -11.7px}
.nfc-tpl.nfc-tpl[data-form="12"] [data-medical-record-field="surgical-count.patient.gender-female"]{margin:0 5.8px 0 10px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]{margin-top:0}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:first-child p{line-height:1.15!important}
.nfc-tpl.nfc-tpl[data-form="12"]>p:has([data-medical-record-field="surgical-count.patient.name"]){padding-bottom:10.2px!important}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:nth-child(n+4)>td:first-child{padding-top:2.8px;padding-bottom:5.2px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]>tbody>tr:first-child>td{padding-top:1.7px;padding-bottom:1.7px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="surgical-count"]+p{margin-top:8.1px}
.nfc-tpl.nfc-tpl[data-form="12"]>p:has(>input[type="checkbox"]){padding:2.2px 0 1.8px}
.nfc-tpl.nfc-tpl[data-form="12"] p:is(:has(>span>[data-medical-record-field="surgical-count.text.2"]),:has(>span>[data-medical-record-field="surgical-count.text.3"]),:has(>span>[data-medical-record-field="surgical-count.text.5"])){display:flex;align-items:baseline;gap:.25em;white-space:nowrap}
.nfc-tpl.nfc-tpl[data-form="12"] p:is(:has(>span>[data-medical-record-field="surgical-count.text.2"]),:has(>span>[data-medical-record-field="surgical-count.text.3"]),:has(>span>[data-medical-record-field="surgical-count.text.5"]))>span:last-child{flex:1 1 auto;min-width:0;margin-top:-1.35px}
.nfc-tpl.nfc-tpl[data-form="12"] p:has(>span>[data-medical-record-field="surgical-count.text.2"]){padding-right:49.1px}
.nfc-tpl.nfc-tpl[data-form="12"] p:has(>span>[data-medical-record-field="surgical-count.text.3"]){padding-right:56px}
.nfc-tpl.nfc-tpl[data-form="12"] p:has(>span>[data-medical-record-field="surgical-count.text.3"])>input[type="checkbox"]:first-child{margin-left:0}
.nfc-tpl.nfc-tpl[data-form="12"] p:has(>span>[data-medical-record-field="surgical-count.text.5"]){padding-right:35px}
.nfc-tpl.nfc-tpl[data-form="12"] :is([data-medical-record-field="surgical-count.text.2"],[data-medical-record-field="surgical-count.text.3"],[data-medical-record-field="surgical-count.text.5"]){width:100%!important;min-width:0!important}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="signature"]{margin-top:28.6px}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="signature"]>tbody>tr>td{padding-top:0;padding-bottom:0}
.nfc-tpl.nfc-tpl[data-form="12"]>table[data-record-section="signature"] p>em+br~br{display:none}
@media print{
  .nfc-tpl [data-grid-cell] .nfc-medical-record-text-field{border-bottom:0!important}
  .nfc-tpl table[data-record-section="surgical-count"] td:first-child .nfc-medical-record-text-field:not([data-field-full-width="true"]){border-bottom:1px dotted #000!important}
  /* Mẫu 2's vitals box and files table keep their dots on paper, as the BA's Word copy has them: "Mạch ......lần/ph", "Số tờ ......", "Họ tên ......" (R-1270). */
  .nfc-tpl[data-form="2"] :is(table[data-record-section="vitals"],table[data-record-section="summary-files"]) .nfc-medical-record-text-field{border-bottom:1px dotted #000!important}
  /* Mẫu 11's and 12's signers' names print with no dotted line (clinic 2026-11-16): the room above is for the signature. */
  .nfc-tpl:is([data-form="11"],[data-form="12"])>table[data-record-section="signature"] .nfc-medical-record-text-field{border-bottom:0!important}
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
/* Mẫu 1 at the BA's Word sizes (BA, 2026-11-22, R-1271). The cover: the three
   letterhead lines 14pt on 1.5 lines, MÃ BỆNH NHÂN / MÃ LƯU TRỮ on 1.5 lines of
   their 12pt blank, NĂM 20 at 12pt, and the MÃ BỆNH box's blanks a dotted line
   across the box, under their label. Pages 2 and 3: the titles at 16pt, the
   tables' text in the middle of its cells, the list's columns as Word's and its
   rows at the height they had. */
.nfc-tpl[data-form="1"] table[data-cover] h4{font-size:18.667px;line-height:1.725}
.nfc-tpl[data-form="1"] table[data-cover] :is(h4,h3>span) span[style*="font-size"]{font-size:inherit!important}
.nfc-tpl[data-form="1"] table[data-cover] h3>span[style*="font-size"]{font-size:16px!important}
.nfc-tpl[data-form="1"] table[data-cover] p[style*="text-align: right"]{line-height:1.725}
.nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]) .nfc-medical-record-text-field{display:block;width:100%;box-sizing:border-box}
.nfc-tpl[data-form="1"]>h2{font-size:21.333px}
.nfc-tpl[data-form="1"]>table:is(:nth-of-type(2),:nth-of-type(3),:nth-of-type(4))>tbody>tr>td{vertical-align:middle}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>colgroup>col:nth-child(1){width:8.26%!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>colgroup>col:nth-child(2){width:41.7%!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>colgroup>col:nth-child(3){width:23.62%!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>colgroup>col:nth-child(4){width:auto!important}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:first-child>td{height:54.2px}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:nth-child(2)>td{height:89.5px}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:nth-child(n+3)>td{height:69.2px}
.nfc-tpl[data-form="1"]>table:nth-of-type(2)>tbody>tr:is(:nth-child(7),:nth-child(9))>td{height:48.8px}
@media print{
  .nfc-tpl[data-form="1"] table[data-cover] table:not([data-borderless]) .nfc-medical-record-text-field{border-bottom:1px dotted #000!important}
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
     blank has dots — every rule above still decides that — and is drawn clear;
     ::after draws it again at 0.6 scale, which stays vector on paper. :not(#_)
     outranks those rules' !important. */
  .nfc-tpl .nfc-medical-record-text-field:not(#_){position:relative;border-bottom-color:transparent!important}
  .nfc-tpl .nfc-medical-record-text-field::after{content:'';position:absolute;left:0;bottom:-1px;width:calc(100% / .6);border-bottom:1px #000;border-bottom-style:inherit;transform:scale(.6);transform-origin:left bottom;pointer-events:none}
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
  .nfc-tpl .nfc-medical-record-text-field[data-form-code="true"]{display:inline;min-width:0!important;min-height:0;padding:0;line-height:inherit;border:0!important;outline:none!important;background:none!important;color:inherit!important}`;

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
 * with 5mm at top and bottom, 10mm at the sides (the clinic asked for the least
 * margin above and below, the room going to the gaps inside, 2026-11-16) — Chrome takes a named page's size, so a job printing it
 * among the upright forms turns only its sheet. Mẫu 2 then gave up
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
    @page outpatient-dental{margin:15mm 15mm 7mm}
    @page surgical-safety{size:A4 landscape;margin:5mm 10mm}
    @media print{
      .nfc-tpl{page:margin-5mm;width:200mm;height:auto;min-height:0;margin:0 auto;padding:7mm;box-shadow:none}
      .nfc-tpl:is([data-form="2"],[data-form="6"],[data-form="7"],[data-form="10"],[data-form="12"]){page:margin-15mm;width:auto;margin:0;padding:0}
      .nfc-tpl[data-form="2"]{page:outpatient-dental}
      /* Mẫu 4: 10mm above the page, as the BA's Word copy (2026-11-22). */
      .nfc-tpl[data-form="4"]{padding-top:5mm}
      .nfc-tpl[data-form="11"]{page:surgical-safety;width:auto;margin:0;padding:0}
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
    .nfc-tpl[data-form="11"]{width:297mm;min-height:210mm;padding:5mm 10mm}
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
    .nfc-tpl[data-form="11"]{width:297mm;padding:5mm 10mm}
    .nfc-tpl>hr{margin:0;border:0}
${SHEET_FIELD_CSS}
${SHEET_PRINT_CSS}
  `;
