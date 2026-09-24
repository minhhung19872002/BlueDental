import { getAllProvinces, getWardsByProvince } from "@/utils/vietnamLocations";
import { isOldWardMap, type AddressSources } from "./cardAddress";
// Emitted as a separate file and fetched on first scan — it is ~300 KB and
// nobody who never scans a card should download it.
import oldWardMapUrl from "./oldWardMap.json?url";

let cached: Promise<AddressSources> | null = null;

async function load(): Promise<AddressSources> {
  const [response, provinces] = await Promise.all([fetch(oldWardMapUrl), getAllProvinces()]);
  if (!response.ok) throw new Error(`oldWardMap: HTTP ${response.status}`);

  const data: unknown = await response.json();
  if (!isOldWardMap(data)) throw new Error("oldWardMap: unexpected shape");

  return { oldWards: data, provinces, loadWards: getWardsByProvince };
}

/** The old→new ward table plus today's provinces, loaded once. */
export function loadAddressSources(): Promise<AddressSources> {
  cached ??= load().catch((error: unknown) => {
    // A failed load is retried on the next scan instead of being cached.
    cached = null;
    throw error;
  });
  return cached;
}
