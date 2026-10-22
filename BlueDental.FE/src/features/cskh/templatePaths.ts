/** "Mẫu tin nhắn" is a tab of /cskh-grouping; its editor has a page of its own. */
export const TEMPLATE_LIST_PATH = "/cskh-grouping?tab=template";

/** "new" opens a blank editor; an id opens that template. */
export const templateEditorPath = (id: string) => `/cskh-grouping/templates/${id}`;
