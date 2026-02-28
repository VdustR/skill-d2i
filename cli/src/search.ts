import { loadData, DataFileName, isCached } from "./data-fetcher";
import type { IConstantData } from "@dschu012/d2s/lib/d2/types";

export interface SearchFilters {
  query?: string;
  class?: string;
  type?: string; // "weapon", "armor", "helm", "shield", etc.
  quality?: "unique" | "set" | "runeword" | "base" | "magic-prefix" | "magic-suffix";
  minLevel?: number;
  maxLevel?: number;
  limit?: number;
}

export interface SearchResult {
  name: string;
  code: string;
  id: number;
  category: "unique" | "set" | "runeword" | "base" | "magic-prefix" | "magic-suffix";
  baseName?: string;
  levelReq?: number;
  strReq?: number;
  dexReq?: number;
  props?: string[];
  modCode?: string;
  modMin?: number;
  modMax?: number;
  itemTypes?: string[];
  classSpecific?: string;
}

let baseReqCache: Map<string, { strReq: number; dexReq: number }> | null = null;

function getBaseReqMap(): Map<string, { strReq: number; dexReq: number }> {
  if (baseReqCache) return baseReqCache;
  baseReqCache = new Map();
  if (!isCached()) return baseReqCache;
  for (const file of ["armor.json", "weapons.json"] as const) {
    const data = loadData(file);
    for (const entry of Object.values(data) as any[]) {
      if (entry?.code) {
        baseReqCache.set(entry.code.trim(), {
          strReq: parseInt(entry.reqstr) || 0,
          dexReq: parseInt(entry.reqdex) || 0,
        });
      }
    }
  }
  return baseReqCache;
}

function matchesClass(categories: string[] | undefined, className: string): boolean {
  if (!categories) return false;
  const cl = className.toLowerCase();
  const classMap: Record<string, string> = {
    amazon: "Amazon Item",
    ama: "Amazon Item",
    sorceress: "Sorceress Item",
    sor: "Sorceress Item",
    necromancer: "Necromancer Item",
    nec: "Necromancer Item",
    paladin: "Paladin Item",
    pal: "Paladin Item",
    barbarian: "Barbarian Item",
    bar: "Barbarian Item",
    druid: "Druid Item",
    dru: "Druid Item",
    assassin: "Assassin Item",
    ass: "Assassin Item",
    warlock: "Warlock Item",
    war: "Warlock Item",
  };
  const target = classMap[cl];
  if (target) return categories.includes(target);
  return categories.some((c) => c.toLowerCase().includes(cl));
}

function matchesType(categories: string[] | undefined, typeName: string): boolean {
  if (!categories) return false;
  const t = typeName.toLowerCase();
  return categories.some((c) => c.toLowerCase().includes(t));
}

function getBaseCategories(code: string, constants: IConstantData): string[] {
  const trimmed = code.trim();
  const entry =
    (constants.armor_items as Record<string, any>)[trimmed] ||
    (constants.weapon_items as Record<string, any>)[trimmed] ||
    (constants.other_items as Record<string, any>)[trimmed];
  return entry?.c || [];
}

function extractProps(entry: any): string[] {
  const props: string[] = [];
  for (let i = 1; i <= 12; i++) {
    const prop = entry[`prop${i}`];
    const min = entry[`min${i}`];
    const max = entry[`max${i}`];
    if (prop && prop !== "" && prop !== "0") {
      if (min !== undefined && max !== undefined && min !== "" && max !== "") {
        props.push(min === max ? `${prop}: ${min}` : `${prop}: ${min}-${max}`);
      } else {
        props.push(prop);
      }
    }
  }
  return props;
}

export function search(filters: SearchFilters, constants: IConstantData): SearchResult[] {
  const results: SearchResult[] = [];
  const limit = filters.limit ?? 50;
  const q = filters.query?.toLowerCase();

  // Search unique items
  if (!filters.quality || filters.quality === "unique") {
    const uniques = loadData("uniqueitems.json");
    for (const [id, entry] of Object.entries(uniques) as [string, any][]) {
      if (!entry || !entry.index) continue;
      const name: string = entry.index;
      const code: string = entry.code || "";
      const lvlReq: number = parseInt(entry["lvl req"]) || 0;

      if (q && !name.toLowerCase().includes(q)) continue;
      if (filters.minLevel !== undefined && lvlReq < filters.minLevel) continue;
      if (filters.maxLevel !== undefined && lvlReq > filters.maxLevel) continue;

      const cats = getBaseCategories(code, constants);
      if (filters.class && !matchesClass(cats, filters.class)) continue;
      if (filters.type && !matchesType(cats, filters.type)) continue;

      const reqs = getBaseReqMap().get(code.trim());
      const result: SearchResult = {
        name,
        code,
        id: parseInt(id),
        category: "unique",
        baseName: entry["*ItemName"] || "",
        levelReq: lvlReq,
        props: extractProps(entry),
      };
      if (reqs?.strReq) result.strReq = reqs.strReq;
      if (reqs?.dexReq) result.dexReq = reqs.dexReq;
      results.push(result);
      if (results.length >= limit) break;
    }
  }

  // Search set items
  if (results.length >= limit) return results;
  if (!filters.quality || filters.quality === "set") {
    const setItems = loadData("setitems.json");
    const sets = loadData("sets.json");

    // Build set class lookup from sets.json UIClass field
    const setClassMap: Record<string, string> = {}; // set index -> UIClass
    for (const [, s] of Object.entries(sets) as [string, any][]) {
      if (s && s.index && s.UIClass) setClassMap[s.index] = s.UIClass;
    }

    // UIClass short codes -> match against filter
    const classShortMap: Record<string, string[]> = {
      ama: ["amazon", "ama"],
      sor: ["sorceress", "sor"],
      nec: ["necromancer", "nec"],
      pal: ["paladin", "pal"],
      bar: ["barbarian", "bar"],
      war: ["warlock", "war"],
      dru: ["druid", "dru"],
      ass: ["assassin", "ass"],
    };

    function setMatchesClass(setName: string, classFilter: string): boolean {
      const uiClass = setClassMap[setName];
      if (!uiClass) return false;
      const aliases = classShortMap[uiClass] || [];
      return aliases.some((a) => a === classFilter.toLowerCase());
    }

    for (const [, entry] of Object.entries(setItems) as [string, any][]) {
      if (!entry || !entry.index) continue;
      const name: string = entry.index;
      const code: string = entry.item || "";
      const lvlReq: number = parseInt(entry["lvl req"]) || 0;
      const setItemId: number = parseInt(entry["*ID"]) || 0;
      const parentSet: string = entry.set || "";

      if (q && !name.toLowerCase().includes(q)) continue;
      if (filters.minLevel !== undefined && lvlReq < filters.minLevel) continue;
      if (filters.maxLevel !== undefined && lvlReq > filters.maxLevel) continue;

      const cats = getBaseCategories(code, constants);
      // For class filter: match either base item categories OR parent set UIClass
      if (filters.class && !matchesClass(cats, filters.class) && !setMatchesClass(parentSet, filters.class)) continue;
      if (filters.type && !matchesType(cats, filters.type)) continue;

      const setReqs = getBaseReqMap().get(code.trim());
      const setResult: SearchResult = {
        name,
        code,
        id: setItemId,
        category: "set",
        baseName: entry["*ItemName"] || "",
        levelReq: lvlReq,
        props: extractProps(entry),
      };
      if (setReqs?.strReq) setResult.strReq = setReqs.strReq;
      if (setReqs?.dexReq) setResult.dexReq = setReqs.dexReq;
      results.push(setResult);
      if (results.length >= limit) break;
    }
  }

  // Search runewords
  if (results.length >= limit) return results;
  if (!filters.quality || filters.quality === "runeword") {
    const runewords = loadData("runes.json");
    for (const [key, entry] of Object.entries(runewords) as [string, any][]) {
      if (!entry || !entry["*Rune Name"]) continue;
      const name: string = entry["*Rune Name"];

      if (q && !name.toLowerCase().includes(q)) continue;
      // Runewords don't have level req in this file directly
      // They also don't have a single base type - they apply to item types

      results.push({
        name,
        code: "",
        id: entry.lineNumber ?? (parseInt(key) || 0),
        category: "runeword",
        baseName: entry.itype1 || "",
        props: extractProps(entry),
      });
      if (results.length >= limit) break;
    }
  }

  // Search magic affixes
  if (results.length >= limit) return results;
  if (filters.quality === "magic-prefix" || filters.quality === "magic-suffix") {
    const dataFile = filters.quality === "magic-prefix" ? "magicprefix.json" : "magicsuffix.json";
    const category = filters.quality;
    const affixes = loadData(dataFile);

    // d2data JSON keys are 0-indexed TSV row numbers with a gap at the
    // "Expansion" divider row.  The d2s library (game binary format) uses
    // 1-indexed IDs and skips the Expansion row, so:
    //   classic  entries (before gap): game id = d2data key + 1
    //   expansion entries (after gap): game id = d2data key  (the +1 and
    //     the missing gap key cancel out)
    // Find the Expansion gap key so we can apply the +1 fixup for classic.
    const keys = Object.keys(affixes).map(Number).sort((a, b) => a - b);
    let expansionGapKey = Infinity;
    for (let i = 0; i < keys.length - 1; i++) {
      if (keys[i + 1] - keys[i] > 1) {
        expansionGapKey = keys[i] + 1;
        break;
      }
    }

    const classNameMap: Record<string, string> = {
      ama: "amazon", amazon: "amazon",
      sor: "sorceress", sorceress: "sorceress",
      nec: "necromancer", necromancer: "necromancer",
      pal: "paladin", paladin: "paladin",
      bar: "barbarian", barbarian: "barbarian",
      dru: "druid", druid: "druid",
      ass: "assassin", assassin: "assassin",
      war: "warlock", warlock: "warlock",
    };

    for (const [id, entry] of Object.entries(affixes) as [string, any][]) {
      if (!entry || !entry.Name || entry.Name === "Expansion") continue;
      const name: string = entry.Name;
      const levelReq: number = parseInt(entry.levelreq) || 0;

      if (q && !name.toLowerCase().includes(q)) continue;
      if (filters.minLevel !== undefined && levelReq < filters.minLevel) continue;
      if (filters.maxLevel !== undefined && levelReq > filters.maxLevel) continue;

      // Class filter: match classspecific field
      if (filters.class) {
        const targetClass = classNameMap[filters.class.toLowerCase()];
        const entryClass = (entry.classspecific || "").toLowerCase();
        if (targetClass && entryClass && !entryClass.includes(targetClass)) continue;
        if (targetClass && !entryClass) continue; // filter wants class-specific, entry is generic
      }

      // Type filter: match itype1-itype5
      if (filters.type) {
        const t = filters.type.toLowerCase();
        let typeMatch = false;
        for (let i = 1; i <= 5; i++) {
          const itype = (entry[`itype${i}`] || "").toLowerCase();
          if (itype && itype.includes(t)) { typeMatch = true; break; }
        }
        if (!typeMatch) continue;
      }

      // Collect item types
      const itemTypes: string[] = [];
      for (let i = 1; i <= 5; i++) {
        const itype = entry[`itype${i}`];
        if (itype && itype !== "") itemTypes.push(itype);
      }

      const rawKey = parseInt(id);
      const gameId = rawKey < expansionGapKey ? rawKey + 1 : rawKey;

      const result: SearchResult = {
        name,
        code: "",
        id: gameId,
        category,
        levelReq: levelReq,
        props: extractProps(entry),
        itemTypes,
      };

      if (entry.classspecific) result.classSpecific = entry.classspecific;

      // Add first mod details
      if (entry.mod1code) {
        result.modCode = entry.mod1code;
        if (entry.mod1min !== undefined) result.modMin = parseInt(entry.mod1min);
        if (entry.mod1max !== undefined) result.modMax = parseInt(entry.mod1max);
      }

      results.push(result);
      if (results.length >= limit) break;
    }
  }

  // Search base items
  if (results.length >= limit) return results;
  if (filters.quality === "base") {
    for (const [dataFile, category] of [
      ["armor.json", "armor"],
      ["weapons.json", "weapon"],
      ["misc.json", "other"],
    ] as [DataFileName, string][]) {
      const items = loadData(dataFile);
      for (const [, entry] of Object.entries(items) as [string, any][]) {
        if (!entry || !entry.name) continue;
        const name: string = entry.name;
        const code: string = entry.code || "";

        if (q && !name.toLowerCase().includes(q)) continue;

        const cats = getBaseCategories(code, constants);
        if (filters.class && !matchesClass(cats, filters.class)) continue;
        if (filters.type && !matchesType(cats, filters.type)) continue;

        const baseResult: SearchResult = {
          name,
          code,
          id: 0,
          category: "base",
          levelReq: parseInt(entry["levelreq"]) || 0,
        };
        const baseStrReq = parseInt(entry.reqstr) || 0;
        const baseDexReq = parseInt(entry.reqdex) || 0;
        if (baseStrReq > 0) baseResult.strReq = baseStrReq;
        if (baseDexReq > 0) baseResult.dexReq = baseDexReq;
        results.push(baseResult);
        if (results.length >= limit) break;
      }
    }
  }

  return results;
}
