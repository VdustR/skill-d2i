import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { initConstants, D2R_VERSION, D2R_WRITE_VERSION } from "./constants-loader";
import { buildItem, ItemSpec } from "./item-builder";
import { writeD2i, D2iFormat } from "./d2i-writer";
import { readItems } from "@dschu012/d2s/lib/d2/items";
import { BitReader } from "@dschu012/d2s/lib/binary/bitreader";
import { setup as fetchData, isCached, loadData } from "./data-fetcher";
import { search, SearchFilters } from "./search";
import { resolveItemStats, resolveItem, resolveRuneword } from "./prop-resolver";
import type { IConstantData } from "@dschu012/d2s/lib/d2/types";

function fatal(error: string, code: string): never {
  process.stderr.write(JSON.stringify({ success: false, error, code }) + "\n");
  process.exit(1);
}

// --lookup: fuzzy search constants by name (no d2data needed)
interface LookupResult {
  name: string;
  code: string;
  id: number;
  category: "unique" | "set" | "runeword" | "armor" | "weapon" | "other";
}

function lookup(query: string, constants: IConstantData): LookupResult[] {
  const q = query.toLowerCase();
  const results: LookupResult[] = [];

  for (const [id, v] of Object.entries(constants.unq_items)) {
    if (v && (v as any).n?.toLowerCase().includes(q)) {
      results.push({ name: (v as any).n, code: (v as any).c, id: parseInt(id), category: "unique" });
    }
  }
  for (const [id, v] of Object.entries(constants.set_items)) {
    if (v && (v as any).n?.toLowerCase().includes(q)) {
      results.push({ name: (v as any).n, code: (v as any).c, id: parseInt(id), category: "set" });
    }
  }
  for (const [id, v] of Object.entries(constants.runewords)) {
    if (v && (v as any).n?.toLowerCase().includes(q)) {
      results.push({ name: (v as any).n, code: "", id: parseInt(id), category: "runeword" });
    }
  }
  for (const [code, v] of Object.entries(constants.armor_items as Record<string, any>)) {
    if (v?.n?.toLowerCase().includes(q)) {
      results.push({ name: v.n, code, id: 0, category: "armor" });
    }
  }
  for (const [code, v] of Object.entries(constants.weapon_items as Record<string, any>)) {
    if (v?.n?.toLowerCase().includes(q)) {
      results.push({ name: v.n, code, id: 0, category: "weapon" });
    }
  }
  for (const [code, v] of Object.entries(constants.other_items as Record<string, any>)) {
    if (v?.n?.toLowerCase().includes(q)) {
      results.push({ name: v.n, code, id: 0, category: "other" });
    }
  }
  return results;
}

function parseSpec(args: string[]): ItemSpec | ItemSpec[] {
  let raw: string;
  if (args[0] === "--file") {
    const filePath = args[1];
    if (!filePath) fatal("Missing file path after --file", "MISSING_ARG");
    if (!fs.existsSync(filePath)) fatal(`File not found: ${filePath}`, "FILE_NOT_FOUND");
    raw = fs.readFileSync(filePath, "utf-8");
  } else if (args[0]) {
    raw = args[0];
  } else {
    fatal("Usage: node dist/index.js [--setup | --lookup <name> | --search <filters> | --read <file.d2i> | --file <spec.json>]", "MISSING_ARG");
  }
  try {
    return JSON.parse(raw);
  } catch {
    fatal("Invalid JSON input", "INVALID_JSON");
  }
}

function resolveOutputPath(spec: ItemSpec): string {
  if (spec.outputPath) {
    const resolved = path.resolve(spec.outputPath);
    if (!resolved.endsWith(".d2i")) {
      fatal("outputPath must end with .d2i", "INVALID_OUTPUT_PATH");
    }
    return resolved;
  }
  const dir = path.join(os.tmpdir(), "d2r-items");
  fs.mkdirSync(dir, { recursive: true });
  const code = spec.itemCode.trim().replace(/[^a-zA-Z0-9_-]/g, "");
  const ts = Date.now();
  return path.join(dir, `${code}-${ts}.d2i`);
}

function parseSearchArgs(args: string[]): SearchFilters {
  const filters: SearchFilters = {};
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--query":
      case "-q":
        filters.query = args[++i];
        break;
      case "--class":
      case "-c":
        filters.class = args[++i];
        break;
      case "--type":
      case "-t":
        filters.type = args[++i];
        break;
      case "--quality":
        filters.quality = args[++i] as SearchFilters["quality"];
        break;
      case "--min-level": {
        const v = parseInt(args[++i]);
        if (!isNaN(v)) filters.minLevel = v;
        break;
      }
      case "--max-level": {
        const v = parseInt(args[++i]);
        if (!isNaN(v)) filters.maxLevel = v;
        break;
      }
      case "--limit": {
        const v = parseInt(args[++i]);
        if (!isNaN(v)) filters.limit = v;
        break;
      }
      default:
        // Treat remaining as query if no flag
        if (!args[i].startsWith("-") && !filters.query) {
          filters.query = args.slice(i).join(" ");
          i = args.length;
        }
        break;
    }
  }
  return filters;
}

function ensureCached(): void {
  if (!isCached()) {
    fatal("d2data not cached. Run with --setup first.", "NOT_CACHED");
  }
}

type SocketFillStrategy = NonNullable<import("./item-builder").ItemSpec["socketFill"]>;

// Socket fill: item type code per strategy
//              [weapon,   shield,   armor/helm]
const SOCKET_FILL_MAP: Record<SocketFillStrategy, [string, string, string]> = {
  mf:     ["r24", "r24", "gpy"],  // Ist / Ist / Ptopaz
  resist: ["r22", "r22", "r22"],  // Um / Um / Um
  damage: ["r27", "r30", "r30"],  // Ohm / Ber / Ber
  caster: ["r24", "r24", "r24"],  // Ist (fallback; facets need stats — use socketedItems)
  ias:    ["r13", "r13", "r13"],  // Shael
  cbf:    ["r32", "r32", "r32"],  // Cham
};

function resolveSocketFillCode(
  strategy: SocketFillStrategy,
  isWeapon: boolean,
  isShield: boolean,
): string {
  const fillCodes = SOCKET_FILL_MAP[strategy];
  if (!fillCodes) return "";
  const [weapon, shield, armorHelm] = fillCodes;
  if (isWeapon) return weapon;
  if (isShield) return shield;
  return armorHelm;
}

async function generateOne(
  spec: ItemSpec,
  constants: IConstantData,
  formatFlag: D2iFormat,
): Promise<{ outputPath: string; fileSize: number; format: string }> {
  if (typeof spec.itemCode !== "string") {
    fatal("Missing or invalid itemCode", "INVALID_SPEC");
  }
  const trimmed = spec.itemCode.trim();
  const found =
    (constants.armor_items as Record<string, unknown>)[trimmed] ||
    (constants.weapon_items as Record<string, unknown>)[trimmed] ||
    (constants.other_items as Record<string, unknown>)[trimmed];
  if (!found) {
    fatal(`Unknown item code: ${trimmed}`, "INVALID_ITEM_CODE");
  }

  // Auto-resolve base defense and durability from d2data
  if (isCached()) {
    const armor = loadData("armor.json");
    const weapons = loadData("weapons.json");
    const baseEntry =
      armor[Object.keys(armor).find((k) => armor[k]?.code === trimmed) ?? ""] ||
      weapons[Object.keys(weapons).find((k) => weapons[k]?.code === trimmed) ?? ""];
    if (baseEntry) {
      if (spec.defense == null && baseEntry.maxac != null) {
        spec.defense = parseInt(baseEntry.maxac) || 0;
      }
      if (spec.maxDurability == null && baseEntry.durability != null && !parseInt(baseEntry.nodurability)) {
        spec.maxDurability = parseInt(baseEntry.durability) || 0;
        spec.currentDurability = spec.currentDurability ?? spec.maxDurability;
      }
    }
  }

  // Auto-resolve stats and sockets from d2data
  if (isCached()) {
    const quality = spec.quality === "unique" ? "unique" : spec.quality === "set" ? "set" : null;
    const itemId = spec.uniqueId ?? spec.setId;
    if (quality && itemId != null) {
      const resolved = resolveItem(quality, itemId, constants);
      if (!spec.stats || spec.stats.length === 0) {
        spec.stats = resolved.stats;
      }
      if (spec.sockets == null && resolved.sockets > 0) {
        spec.sockets = resolved.sockets;
      }
      if (resolved.indestructible) {
        spec.maxDurability = 0;
        spec.currentDurability = 0;
      }
      if (resolved.ethereal && spec.ethereal == null) {
        spec.ethereal = true;
      }
    }

    // Auto-resolve runeword composition and stats
    if (spec.runewordId != null) {
      const rwName = (constants.runewords[spec.runewordId] as any)?.n;
      if (rwName) {
        const rw = resolveRuneword(rwName, constants);
        if (rw) {
          if (!spec.socketedItems || spec.socketedItems.length === 0) {
            spec.socketedItems = rw.runes.map((code) => ({ itemCode: code }));
          }
          if (spec.sockets == null) {
            spec.sockets = rw.runes.length;
          }
          if (!spec.runewordAttributes || spec.runewordAttributes.length === 0) {
            spec.runewordAttributes = rw.stats;
          }
        }
      }
    }
  }

  // Ensure stats array exists before applying overrides
  spec.stats = spec.stats ?? [];

  // Apply statOverrides after auto-resolve
  if (spec.statOverrides) {
    for (const [idStr, values] of Object.entries(spec.statOverrides)) {
      const id = parseInt(idStr);
      if (isNaN(id)) continue;
      const idx = spec.stats.findIndex((s) => s.id === id);
      if (idx >= 0) spec.stats[idx].values = values;
      else spec.stats.push({ id, values });
    }
  }

  // Auto-fill sockets based on socketFill strategy
  if (spec.socketFill && (spec.sockets ?? 0) > 0 && (!spec.socketedItems || spec.socketedItems.length === 0)) {
    const count = spec.sockets!;
    const isWeapon = !!(constants.weapon_items as Record<string, unknown>)[trimmed];
    const isShield = !!(constants.armor_items as Record<string, any>)[trimmed]?.c?.some(
      (cat: string) => cat.toLowerCase().includes("shield"),
    );
    const fillCode = resolveSocketFillCode(spec.socketFill, isWeapon, isShield);
    if (fillCode) {
      spec.socketedItems = Array.from({ length: count }, () => ({ itemCode: fillCode }));
    }
  }

  // spec.format takes precedence over --format flag
  const finalFormat = spec.format ?? formatFlag;
  const item = buildItem(spec, constants);
  const d2iBytes = await writeD2i([item], constants, finalFormat);
  const outputPath = resolveOutputPath(spec);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, d2iBytes);

  return { outputPath, fileSize: d2iBytes.length, format: finalFormat };
}

// Cached lookup maps — built once on first use, O(1) per lookup after that.
let reqLvlMaps: {
  baseByCode: Map<string, number>;       // item code → base levelreq
  reqStrByCode: Map<string, number>;     // item code → reqstr
  reqDexByCode: Map<string, number>;     // item code → reqdex
  uniqueById: Map<number, number>;       // unique *ID → lvl req
  setById: Map<number, number>;          // set *ID → lvl req
  pfxByGameId: Map<number, number>;      // prefix game ID → levelreq
  sfxByGameId: Map<number, number>;      // suffix game ID → levelreq
  pfxNameByGameId: Map<number, string>;  // prefix game ID → Name
  sfxNameByGameId: Map<number, string>;  // suffix game ID → Name
} | null = null;

function buildReqLvlMaps(): typeof reqLvlMaps {
  if (reqLvlMaps) return reqLvlMaps;
  if (!isCached()) return null;

  const baseByCode = new Map<string, number>();
  const reqStrByCode = new Map<string, number>();
  const reqDexByCode = new Map<string, number>();
  for (const file of ["misc.json", "armor.json", "weapons.json"] as const) {
    const data = loadData(file);
    for (const entry of Object.values(data) as any[]) {
      if (entry?.code && !baseByCode.has(entry.code)) {
        baseByCode.set(entry.code, parseInt(entry.levelreq) || 0);
        reqStrByCode.set(entry.code, parseInt(entry.reqstr) || 0);
        reqDexByCode.set(entry.code, parseInt(entry.reqdex) || 0);
      }
    }
  }

  const uniqueById = new Map<number, number>();
  for (const entry of Object.values(loadData("uniqueitems.json")) as any[]) {
    if (entry?.["*ID"] != null) {
      uniqueById.set(Number(entry["*ID"]), parseInt(entry["lvl req"]) || 0);
    }
  }

  const setById = new Map<number, number>();
  for (const entry of Object.values(loadData("setitems.json")) as any[]) {
    if (entry?.["*ID"] != null) {
      setById.set(Number(entry["*ID"]), parseInt(entry["lvl req"]) || 0);
    }
  }

  function buildAffixMaps(file: "magicprefix.json" | "magicsuffix.json") {
    const data = loadData(file);
    const keys = Object.keys(data).map(Number).sort((a, b) => a - b);
    let gapKey = Infinity;
    for (let i = 0; i < keys.length - 1; i++) {
      if (keys[i + 1] - keys[i] > 1) { gapKey = keys[i] + 1; break; }
    }
    const lvlMap = new Map<number, number>();
    const nameMap = new Map<number, string>();
    for (const [k, entry] of Object.entries(data) as [string, any][]) {
      if (!entry) continue;
      const d2key = parseInt(k);
      const gameId = d2key < gapKey ? d2key + 1 : d2key;
      lvlMap.set(gameId, parseInt(entry.levelreq) || 0);
      if (entry.Name) nameMap.set(gameId, entry.Name);
    }
    return { lvlMap, nameMap };
  }

  const pfx = buildAffixMaps("magicprefix.json");
  const sfx = buildAffixMaps("magicsuffix.json");

  reqLvlMaps = {
    baseByCode,
    reqStrByCode,
    reqDexByCode,
    uniqueById,
    setById,
    pfxByGameId: pfx.lvlMap,
    sfxByGameId: sfx.lvlMap,
    pfxNameByGameId: pfx.nameMap,
    sfxNameByGameId: sfx.nameMap,
  };
  return reqLvlMaps;
}

function calcRequiredLevel(item: any): number | undefined {
  const maps = buildReqLvlMaps();
  if (!maps) return undefined;

  let reqLvl = 0;

  // Base item levelreq
  const code = item.type?.trim();
  if (code) reqLvl = Math.max(reqLvl, maps.baseByCode.get(code) ?? 0);

  // Unique item levelreq
  if (item.quality === 7 && item.unique_id != null) {
    reqLvl = Math.max(reqLvl, maps.uniqueById.get(item.unique_id) ?? 0);
  }

  // Set item levelreq
  if (item.quality === 5 && item.set_id != null) {
    reqLvl = Math.max(reqLvl, maps.setById.get(item.set_id) ?? 0);
  }

  // Magic prefix/suffix levelreq
  if (item.quality === 4) {
    const pfxId = (item as any).magic_prefix || 0;
    const sfxId = (item as any).magic_suffix || 0;
    if (pfxId > 0) reqLvl = Math.max(reqLvl, maps.pfxByGameId.get(pfxId) ?? 0);
    if (sfxId > 0) reqLvl = Math.max(reqLvl, maps.sfxByGameId.get(sfxId) ?? 0);
  }

  // Socketed items levelreq
  if (item.socketed_items?.length) {
    for (const s of item.socketed_items) {
      const sCode = s.type?.trim();
      if (sCode) reqLvl = Math.max(reqLvl, maps.baseByCode.get(sCode) ?? 0);
    }
  }

  return reqLvl > 0 ? reqLvl : undefined;
}

function calcRequiredStr(item: any): number | undefined {
  const maps = buildReqLvlMaps();
  if (!maps) return undefined;
  const code = item.type?.trim();
  if (!code) return undefined;
  const base = maps.reqStrByCode.get(code);
  if (!base || base <= 0) return undefined;
  const reduction = item.ethereal ? 10 : 0;
  const result = Math.max(0, base - reduction);
  return result > 0 ? result : undefined;
}

function calcRequiredDex(item: any): number | undefined {
  const maps = buildReqLvlMaps();
  if (!maps) return undefined;
  const code = item.type?.trim();
  if (!code) return undefined;
  const base = maps.reqDexByCode.get(code);
  if (!base || base <= 0) return undefined;
  const reduction = item.ethereal ? 10 : 0;
  const result = Math.max(0, base - reduction);
  return result > 0 ? result : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  const constants = initConstants();

  switch (cmd) {
    case "--setup":
    case "--update-data": {
      const result = await fetchData();
      const totalKb = (result.totalSize / 1024).toFixed(0);
      process.stdout.write(
        JSON.stringify({ success: true, files: result.cached, totalSize: `${totalKb}KB` }) + "\n"
      );
      return;
    }

    case "--lookup": {
      const query = args.slice(1).join(" ");
      if (!query) fatal("Missing search query after --lookup", "MISSING_ARG");
      const results = lookup(query, constants);
      process.stdout.write(JSON.stringify({ success: true, query, count: results.length, results }) + "\n");
      return;
    }

    case "--search": {
      ensureCached();
      const filters = parseSearchArgs(args.slice(1));
      const results = search(filters, constants);
      process.stdout.write(
        JSON.stringify({ success: true, filters, count: results.length, results }) + "\n"
      );
      return;
    }

    case "--resolve-stats": {
      ensureCached();
      const rsArgs = parseSearchArgs(args.slice(1));
      const quality = rsArgs.quality as "unique" | "set";
      if (quality !== "unique" && quality !== "set") {
        fatal("--resolve-stats requires --quality unique or set", "INVALID_ARG");
      }
      // Accept --id N or extract from search by query
      let itemId: number | undefined;
      for (let i = 1; i < args.length; i++) {
        if (args[i] === "--id") { itemId = parseInt(args[++i]); break; }
      }
      if (itemId == null) fatal("--resolve-stats requires --id <numericId>", "MISSING_ARG");
      const resolved = resolveItem(quality, itemId, constants);
      process.stdout.write(
        JSON.stringify({
          success: true, quality, id: itemId,
          count: resolved.stats.length, stats: resolved.stats,
          sockets: resolved.sockets,
          ...(resolved.ethereal ? { ethereal: true } : {}),
          ...(resolved.indestructible ? { indestructible: true } : {}),
        }) + "\n"
      );
      return;
    }

    case "--read":
    case "--decode": {
      const filePath = args[1];
      if (!filePath) fatal("Missing file path after --read", "MISSING_ARG");
      if (!fs.existsSync(filePath)) fatal(`File not found: ${filePath}`, "FILE_NOT_FOUND");

      try {
        const fileBytes = fs.readFileSync(filePath);
        let buffer: ArrayBuffer;
        let detectedFormat: "d2" | "raw";

        // Auto-detect format: JM header (0x4A, 0x4D) = d2 format
        if (fileBytes.length >= 4 && fileBytes[0] === 0x4a && fileBytes[1] === 0x4d) {
          detectedFormat = "d2";
          buffer = fileBytes.buffer.slice(fileBytes.byteOffset, fileBytes.byteOffset + fileBytes.byteLength);
        } else {
          // Raw format — prepend JM header + count=1
          detectedFormat = "raw";
          const wrapped = new Uint8Array(4 + fileBytes.length);
          wrapped[0] = 0x4a; // J
          wrapped[1] = 0x4d; // M
          wrapped[2] = 1;    // count (little-endian uint16)
          wrapped[3] = 0;
          wrapped.set(fileBytes, 4);
          buffer = wrapped.buffer;
        }

        // Reader version fallback: try v105 first, then v99 with 10-bit curDur.
        //
        // v105 (D2R_WRITE_VERSION): matches our generated items — the v105 reader
        //   expects SkipBit after durability + chest_stackable after stats.
        //
        // v99 fallback with sB=10 for stat 72 (current_durability): handles files
        //   from D2RuneWizard exports and other tools that write 10-bit curDur
        //   without v105 structural bits.
        let items: Awaited<ReturnType<typeof readItems>>;
        try {
          const reader105 = new BitReader(buffer);
          items = await readItems(reader105, D2R_WRITE_VERSION, constants, { extendedStash: false });
        } catch {
          const patchedProps = [...constants.magical_properties];
          patchedProps[72] = { ...patchedProps[72], sB: 10 };
          const patchedConstants = { ...constants, magical_properties: patchedProps };
          const reader99 = new BitReader(buffer);
          items = await readItems(reader99, D2R_VERSION, patchedConstants, { extendedStash: false });
        }

        const result = items.map((item) => {
          const base: Record<string, unknown> = {
            type: item.type?.trim(),
            typeName: item.type_name || undefined,
            quality: item.quality,
            level: item.level,
            version: item.version,
            identified: !!item.identified,
            ethereal: !!item.ethereal,
            socketed: !!item.socketed,
            runeword: !!item.given_runeword,
            defense: item.defense_rating,
            maxDurability: item.max_durability,
            currentDurability: item.current_durability,
            quantity: item.quantity || undefined,
            totalSockets: item.total_nr_of_sockets,
            filledSockets: item.nr_of_items_in_sockets,
          };

          // Quality-specific fields
          if (item.quality === 7) base.uniqueId = item.unique_id;
          if (item.quality === 5) base.setId = item.set_id;
          if (item.given_runeword) base.runewordId = item.runeword_id;
          if (item.quality === 4) {
            const pfxId = (item as any).magic_prefix || 0;
            const sfxId = (item as any).magic_suffix || 0;
            base.magicPrefix = pfxId;
            base.magicSuffix = sfxId;
            // Resolve names: d2s constants first, d2data cache as fallback
            const maps = buildReqLvlMaps();
            const pfxName = (item as any).magic_prefix_name || (maps && pfxId ? maps.pfxNameByGameId.get(pfxId) : undefined);
            const sfxName = (item as any).magic_suffix_name || (maps && sfxId ? maps.sfxNameByGameId.get(sfxId) : undefined);
            if (pfxName) base.magicPrefixName = pfxName;
            if (sfxName) base.magicSuffixName = sfxName;
          }

          // Calculate required level from d2data (if cached)
          const reqLvl = calcRequiredLevel(item);
          if (reqLvl !== undefined) base.requiredLevel = reqLvl;

          const reqStr = calcRequiredStr(item);
          const reqDex = calcRequiredDex(item);
          if (reqStr !== undefined) base.requiredStr = reqStr;
          if (reqDex !== undefined) base.requiredDex = reqDex;

          base.magicAttributes = item.magic_attributes?.map((a) => ({
            id: a.id,
            name: a.name,
            values: a.values,
          })) ?? [];
          base.runewordAttributes = item.given_runeword
            ? item.runeword_attributes?.map((a) => ({
                id: a.id,
                name: a.name,
                values: a.values,
              })) ?? []
            : undefined;
          base.socketedItems = item.socketed_items?.map((s) => {
            try {
              return {
                type: s.type?.trim(),
                simple: !!s.simple_item,
                quality: s.quality,
                attributes: s.magic_attributes?.map((a) => ({
                  id: a.id,
                  name: a.name,
                  values: a.values,
                })) ?? [],
              };
            } catch {
              return { type: s.type?.trim() ?? "???", simple: true, quality: s.quality ?? 0, attributes: [] };
            }
          }) ?? [];

          return base;
        });

        process.stdout.write(
          JSON.stringify({
            success: true,
            file: filePath,
            detectedFormat,
            count: result.length,
            items: result,
          }) + "\n"
        );
      } catch (err: any) {
        process.stderr.write(
          JSON.stringify({
            success: false,
            error: err?.message ?? String(err),
            file: filePath,
          }) + "\n"
        );
      }
      return;
    }

    default: {
      // Generate mode
      // Extract --format flag before parsing spec
      let format: D2iFormat = "d2";
      const genArgs = [...args];
      const fmtIdx = genArgs.indexOf("--format");
      if (fmtIdx !== -1) {
        const fmtVal = genArgs[fmtIdx + 1];
        if (fmtVal === "d2" || fmtVal === "raw") {
          format = fmtVal;
        } else {
          fatal(`Invalid format: ${fmtVal}. Use "d2" or "raw".`, "INVALID_FORMAT");
        }
        genArgs.splice(fmtIdx, 2);
      }

      const parsed = parseSpec(genArgs);
      const specs = Array.isArray(parsed) ? parsed : [parsed];

      const results: Array<{ outputPath: string; fileSize: number; format: string }> = [];
      for (const spec of specs) {
        const result = await generateOne(spec, constants, format);
        results.push(result);
      }

      if (Array.isArray(parsed)) {
        process.stdout.write(
          JSON.stringify({ success: true, count: results.length, results }) + "\n"
        );
      } else {
        process.stdout.write(JSON.stringify({ success: true, ...results[0] }) + "\n");
      }
      return;
    }
  }
}

main().catch((err) => {
  fatal(String(err?.message ?? err), "RUNTIME_ERROR");
});
