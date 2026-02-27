import type { IItem, IConstantData } from "@dschu012/d2s/lib/d2/types";
import { D2R_WRITE_VERSION } from "./constants-loader";

import { writeItems } from "@dschu012/d2s/lib/d2/items";

export type D2iFormat = "d2" | "raw";

/**
 * Serialize one or more IItem objects into D2I binary format.
 *
 * CRITICAL: must use D2R_WRITE_VERSION (105 / 0x69), not D2R_VERSION (99).
 *
 * The version parameter here controls the binary SERIALIZATION format — it is
 * independent of the item's own version field ("100").  Two things depend on it:
 *
 *   1. SkipBit(1) after the durability section (for non-simple items)
 *   2. chest_stackable(1) after the stats section (for all items)
 *
 * These extra bits are required by D2RuneWizard Hero Editor's parser.  Without
 * them, items containing non-simple socketed items (e.g. Rainbow Facets) cause
 * bit-stream misalignment and fail to import.
 *
 * Do NOT add a 10-bit current_durability (sB=10) patch here.  The v105 writer
 * uses standard 9-bit curDur + the SkipBit, which together occupy 10 bits and
 * match the format expected by D2RuneWizard.  Patching sB to 10 would produce
 * 10 + 1 = 11 bits and break alignment.
 *
 * format:
 *   "d2"  (default) — "JM" header (2 bytes) + uint16 item count + item bytes
 *   "raw" — raw item bytes only (for D2RuneWizard Hero Editor import)
 */
export async function writeD2i(
  items: IItem[],
  constants: IConstantData,
  format: D2iFormat = "d2",
): Promise<Uint8Array> {
  const full: Uint8Array = await writeItems(items, D2R_WRITE_VERSION, constants, { extendedStash: false });
  if (format === "raw") {
    return full.slice(4);
  }
  return full;
}
