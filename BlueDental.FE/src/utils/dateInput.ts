/**
 * The format every editable day picker uses: shown as DD/MM/YYYY, and in mask
 * mode, so digits typed bare ("24081997") fill in as 24/08/1997 while they are
 * typed and the open calendar jumps to that day (BA request 2026-09-30).
 */
export const DATE_INPUT_FORMAT = { format: "DD/MM/YYYY", type: "mask" } as const;

/** The same with the hour: DD/MM/YYYY HH:mm, digits typed bare fill the mask. */
export const DATE_TIME_INPUT_FORMAT = { format: "DD/MM/YYYY HH:mm", type: "mask" } as const;
