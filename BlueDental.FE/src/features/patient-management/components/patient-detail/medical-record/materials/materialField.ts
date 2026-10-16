import { t } from "@/lib/i18n";

/**
 * "Loại" under Chi tiết răng sứ / Chi tiết Implant on mẫu 5 (clinic,
 * 2026-10-16): the types from Danh mục → Vật liệu nha khoa as boxes to tick, a
 * ⊕ to add one, a double click on a type to correct it. Ticking fills Hãng,
 * Xuất xứ and Bảo hành below — the value alone for one type, "value (type)"
 * joined by "; " for several.
 *
 * It is a blank like any other — `data-medical-record-field`, stored under its
 * id — with `data-field-type="materials"`. What it holds is the ticked types,
 * `[{ id, name }]` as JSON: the id to find the type again, the name so the
 * sheet still reads right after the type is renamed or deleted.
 */

export const MATERIAL_FIELD_TYPE = "materials";

const SELECTED_ATTR = "data-material-selected";
const OPTION_CLASS = "nfc-material-option";
const ACTION_ATTR = "data-material-action";

/** One type as the sheet is handed it: Danh mục's row, already shaped. */
export interface SheetMaterial {
  id: string;
  name: string;
  brand: string | null;
  origin: string | null;
  warranty: string | null;
}

/** One ticked type as the sheet stores it. */
export interface PickedMaterial {
  id?: string;
  name: string;
}

export function isMaterialField(node: Element): boolean {
  return node.getAttribute("data-field-type") === MATERIAL_FIELD_TYPE;
}

/** The kind the blank lists: 1 = răng sứ, 2 = implant (RestorationKind). */
export function materialKindOf(node: Element): number {
  return Number(node.getAttribute("data-material-kind")) || 1;
}

/** The auto value the catalog travels under, per kind. */
export function materialCatalogKey(kind: number): string {
  return `materials.${kind}`;
}

export function parseMaterials(value: unknown): SheetMaterial[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isSheetMaterial) : [];
  } catch {
    return [];
  }
}

function isSheetMaterial(value: unknown): value is SheetMaterial {
  return typeof value === "object" && value !== null && typeof (value as SheetMaterial).name === "string";
}

export function parsePicked(value: unknown): PickedMaterial[] {
  if (typeof value !== "string" || !value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is PickedMaterial => typeof item?.name === "string")
      : [];
  } catch {
    return [];
  }
}

/** What the blank holds now, read back off the sheet: "" when nothing is ticked. */
export function materialsOf(node: Element): string {
  return node.getAttribute(SELECTED_ATTR) ?? "";
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function optionElement(doc: Document, material: SheetMaterial | PickedMaterial, checked: boolean): HTMLElement {
  const label = doc.createElement("label");
  label.className = OPTION_CLASS;
  if (material.id) label.setAttribute("data-material-id", material.id);
  label.setAttribute("data-material-name", material.name);
  if ("brand" in material) {
    label.setAttribute("data-brand", material.brand ?? "");
    label.setAttribute("data-origin", material.origin ?? "");
    label.setAttribute("data-warranty", material.warranty ?? "");
    label.title = t("Patient:MedRecord:Material:EditHint");
  }

  const box = doc.createElement("input");
  box.type = "checkbox";
  // Styled as the form's boxes; told apart so a form's own boxes can still be counted.
  box.className = "nfc-medical-record-checkbox nfc-material-box";
  box.checked = checked;
  if (checked) box.setAttribute("checked", "checked");
  label.append(box, doc.createTextNode(` ${material.name}`));
  return label;
}

/**
 * Draws the blank: every type of its kind, ticked where the sheet says so, then
 * any ticked type Danh mục no longer offers; and the ⊕ on a sheet being written
 * on.
 */
export function showMaterials(
  node: Element,
  catalog: readonly SheetMaterial[],
  picked: readonly PickedMaterial[],
  editable: boolean,
): void {
  const doc = node.ownerDocument;
  node.replaceChildren();

  const isPicked = (material: SheetMaterial) =>
    picked.some((item) => (item.id ? item.id === material.id : sameName(item.name, material.name)));
  for (const material of catalog) node.append(optionElement(doc, material, isPicked(material)));

  for (const item of picked) {
    const offered = catalog.some((material) => (item.id ? item.id === material.id : sameName(item.name, material.name)));
    if (!offered) node.append(optionElement(doc, item, true));
  }

  writeSelection(node);

  if (!editable) return;
  const add = doc.createElement("button");
  add.type = "button";
  add.className = "nfc-material-add";
  add.setAttribute(ACTION_ATTR, "add");
  add.setAttribute("aria-label", t("Patient:MedRecord:Material:Add"));
  add.setAttribute("data-tooltip", t("Patient:MedRecord:Material:Add"));
  node.append(add);
}

/** The ticked options, in the order they are drawn. */
function checkedOptions(node: Element): HTMLElement[] {
  return Array.from(node.querySelectorAll<HTMLElement>(`.${OPTION_CLASS}`)).filter(
    (option) => option.querySelector("input")?.checked,
  );
}

/** Reads the ticks back into the blank's value. */
function writeSelection(node: Element) {
  const picked: PickedMaterial[] = checkedOptions(node).map((option) => {
    const id = option.getAttribute("data-material-id");
    return { ...(id ? { id } : {}), name: option.getAttribute("data-material-name") ?? "" };
  });
  if (picked.length) node.setAttribute(SELECTED_ATTR, JSON.stringify(picked));
  else node.removeAttribute(SELECTED_ATTR);
}

/**
 * Hãng / Xuất xứ / Bảo hành from the ticked types: the value alone for one,
 * "value (type)" joined by "; " for several; a type with no value adds nothing.
 */
function fillDetails(node: Element) {
  const doc = node.ownerDocument;
  const targets = (node.getAttribute("data-material-fills") ?? "").split(",").filter(Boolean);
  const options = checkedOptions(node);

  ["data-brand", "data-origin", "data-warranty"].forEach((attr, at) => {
    const target = targets[at] ? doc.querySelector(`[data-medical-record-field="${targets[at]}"]`) : null;
    if (!target) return;
    const values = options
      .map((option) => ({ value: option.getAttribute(attr)?.trim() ?? "", name: option.getAttribute("data-material-name") ?? "" }))
      .filter((item) => item.value);
    target.textContent =
      options.length === 1 ? (values[0]?.value ?? "") : values.map((item) => `${item.value} (${item.name})`).join("; ");
  });
}

export interface MaterialRequest {
  fieldId: string;
  kind: number;
  /** The type to correct; null to add one. */
  materialId: string | null;
}

/**
 * Listens on an open sheet: a tick refills the details, ⊕ asks to add a type, a
 * double click on a type asks to correct it. Returns the call that stops.
 */
export function attachMaterialControls(
  doc: Document,
  onRequest: (request: MaterialRequest) => void,
  onChanged: () => void,
): () => void {
  const fieldOf = (target: EventTarget | null) =>
    (target as Element | null)?.closest?.(`[data-field-type="${MATERIAL_FIELD_TYPE}"]`) ?? null;

  const onChange = (event: Event) => {
    const field = fieldOf(event.target);
    if (!field || !(event.target as Element).closest(`.${OPTION_CLASS}`)) return;
    const box = event.target as HTMLInputElement;
    if (box.checked) box.setAttribute("checked", "checked");
    else box.removeAttribute("checked");
    writeSelection(field);
    fillDetails(field);
    onChanged();
  };

  const onClick = (event: MouseEvent) => {
    const button = (event.target as Element | null)?.closest?.(`[${ACTION_ATTR}="add"]`);
    const field = fieldOf(button ?? null);
    if (!button || !field) return;
    event.preventDefault();
    onRequest({ fieldId: field.getAttribute("data-medical-record-field") ?? "", kind: materialKindOf(field), materialId: null });
  };

  const onDoubleClick = (event: MouseEvent) => {
    const option = (event.target as Element | null)?.closest?.(`.${OPTION_CLASS}[data-material-id][data-brand]`);
    const field = fieldOf(option ?? null);
    if (!option || !field || !field.querySelector(`[${ACTION_ATTR}]`)) return;
    event.preventDefault();
    onRequest({
      fieldId: field.getAttribute("data-medical-record-field") ?? "",
      kind: materialKindOf(field),
      materialId: option.getAttribute("data-material-id"),
    });
  };

  doc.addEventListener("change", onChange);
  doc.addEventListener("click", onClick);
  doc.addEventListener("dblclick", onDoubleClick);
  return () => {
    doc.removeEventListener("change", onChange);
    doc.removeEventListener("click", onClick);
    doc.removeEventListener("dblclick", onDoubleClick);
  };
}

/**
 * A type just added or corrected in the dialog, put onto the open sheet at
 * once — the catalog's refetch redraws it a moment later. A new type is ticked;
 * either way the details below are filled again.
 */
export function putMaterial(doc: Document, fieldId: string, material: SheetMaterial, isNew: boolean) {
  const field = doc.querySelector(`[data-medical-record-field="${fieldId}"]`);
  if (!field) return;

  const existing = field.querySelector(`.${OPTION_CLASS}[data-material-id="${material.id}"]`);
  const checked = isNew || Boolean(existing?.querySelector("input")?.checked);
  const option = optionElement(doc, material, checked);
  if (existing) existing.replaceWith(option);
  else field.insertBefore(option, field.querySelector(`[${ACTION_ATTR}]`));

  writeSelection(field);
  fillDetails(field);
}

/**
 * Sheets written before the types came from Danh mục ticked fixed boxes —
 * Zirconia, Cercon HT, Lava, E.max, Khác — and typed the implant's type. Read
 * those back as picks by name, so an old sheet opens with the same ticks.
 */
const LEGACY_CROWN_BOXES: Array<[string, string]> = [
  ["consultation.checkbox.10", "Zirconia"],
  ["consultation.checkbox.11", "Cercon HT"],
  ["consultation.checkbox.12", "Lava"],
  ["consultation.checkbox.13", "E.max"],
];

export function legacyPicks(fieldId: string, stored: Record<string, unknown>): PickedMaterial[] {
  const text = (key: string) => (typeof stored[key] === "string" ? (stored[key] as string).trim() : "");
  if (fieldId === "consultation.crown.types") {
    const picks = LEGACY_CROWN_BOXES.filter(([key]) => stored[key] === true).map(([, name]) => ({ name }));
    if (stored["consultation.checkbox.14"] === true) picks.push({ name: text("consultation.text.11") || "Khác" });
    return picks;
  }
  if (fieldId === "consultation.implant.types") {
    const typed = text("consultation.text.17");
    return typed ? [{ name: typed }] : [];
  }
  return [];
}
