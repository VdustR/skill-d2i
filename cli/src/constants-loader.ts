import { constants } from "@dschu012/d2s/lib/data/versions/99_constant_data";
import { setConstantData, getConstantData } from "@dschu012/d2s";
import type { IConstantData } from "@dschu012/d2s/lib/d2/types";

export const D2R_VERSION = 99; // 0x63 — reading / game-level version

// CRITICAL: must be 105 (0x69). This is the binary format version passed to
// the d2s writer, NOT the item's version field (which is "100").
// At 105, the patched d2s writer emits v105 structural bits (SkipBit after
// durability, chest_stackable after stats). D2RuneWizard Hero Editor's parser
// requires these bits to correctly align the bit stream — without them, items
// containing non-simple socketed items (e.g. unique jewels) fail to import
// with "Save Bits is undefined" errors due to bit-level misalignment.
export const D2R_WRITE_VERSION = 105;

let initialized = false;
export function initConstants(): IConstantData {
  if (!initialized) {
    // Both versions share the same stat constant data (99_constant_data).
    // D2R_WRITE_VERSION only controls structural format bits in the writer,
    // not stat definitions.
    setConstantData(D2R_VERSION, constants);
    setConstantData(D2R_WRITE_VERSION, constants);
    initialized = true;
  }
  return getConstantData(D2R_VERSION)!;
}
