import { loadData } from "./data-fetcher";
import type { IConstantData } from "@dschu012/d2s/lib/d2/types";

export interface ResolvedStat {
  id: number;
  values: number[];
}

export interface ResolvedItemInfo {
  stats: ResolvedStat[];
  sockets: number;
  ethereal: boolean;
  indestructible: boolean;
}

export interface ResolvedRuneword {
  runes: string[];
  stats: ResolvedStat[];
  baseTypes: string[];
}

let _statIdMap: Record<string, number> | null = null;
function buildStatIdMap(): Record<string, number> {
  if (_statIdMap) return _statIdMap;
  const isc = loadData("itemstatcost.json");
  const map: Record<string, number> = {};
  for (const [, entry] of Object.entries(isc) as [string, any][]) {
    if (entry?.Stat && entry["*ID"] != null) {
      map[entry.Stat] = parseInt(entry["*ID"]);
    }
  }
  _statIdMap = map;
  return map;
}

let _propMap: Record<string, any> | null = null;
function buildPropMap(): Record<string, any> {
  if (_propMap) return _propMap;
  const props = loadData("properties.json");
  const map: Record<string, any> = {};
  for (const [, entry] of Object.entries(props) as [string, any][]) {
    if (entry?.code) map[entry.code] = entry;
  }
  _propMap = map;
  return map;
}

function findItemEntry(quality: "unique" | "set", itemId: number): { entry: any; maxProps: number } | null {
  if (quality === "unique") {
    const uniques = loadData("uniqueitems.json");
    const entry = uniques[String(itemId)];
    return entry ? { entry, maxProps: 12 } : null;
  } else {
    const setItems = loadData("setitems.json");
    const entry = Object.values(setItems).find(
      (e: any) => e && parseInt(e["*ID"]) === itemId,
    );
    return entry ? { entry, maxProps: 9 } : null;
  }
}

function getBaseMaxSockets(itemCode: string): number {
  const trimmed = itemCode.trim();
  for (const file of ["armor.json", "weapons.json"] as const) {
    const data = loadData(file);
    for (const [, v] of Object.entries(data) as [string, any][]) {
      if (v && v.code === trimmed) {
        return parseInt(v.gemsockets) || 0;
      }
    }
  }
  return 0;
}

/**
 * Resolve all d2data properties for a unique/set item into d2s stat entries.
 * Uses max values for variable-roll stats (= perfect roll).
 */
export function resolveItemStats(
  quality: "unique" | "set",
  itemId: number,
  constants: IConstantData,
): ResolvedStat[] {
  return resolveItem(quality, itemId, constants).stats;
}

/**
 * Resolve stats AND sockets for a unique/set item.
 * Sockets: uses max value from "sock" property, or base item gemsockets if sock has no explicit value.
 */
export function resolveItem(
  quality: "unique" | "set",
  itemId: number,
  constants: IConstantData,
): ResolvedItemInfo {
  const statIdMap = buildStatIdMap();
  const propMap = buildPropMap();

  const found = findItemEntry(quality, itemId);
  if (!found) return { stats: [], sockets: 0, ethereal: false, indestructible: false };

  const { entry: itemEntry, maxProps } = found;
  const stats: ResolvedStat[] = [];
  let sockets = 0;
  let ethereal = false;
  let indestructible = false;

  for (let i = 1; i <= maxProps; i++) {
    const propCode: string | undefined = itemEntry[`prop${i}`];
    if (!propCode || propCode === "" || propCode === "0") continue;

    // Handle sockets separately (structural, not a stat)
    if (propCode === "sock") {
      const sockMax = parseInt(itemEntry[`max${i}`]);
      if (sockMax > 0) {
        sockets = sockMax;
      } else {
        // sock with undefined value → use base item max sockets
        const code = itemEntry.code || itemEntry.item || "";
        sockets = getBaseMaxSockets(code);
      }
      continue;
    }

    // Handle structural flags (no stat, just item flags)
    if (propCode === "indestruct") {
      indestructible = true;
      continue;
    }
    if (propCode === "ethereal") {
      ethereal = true;
      continue;
    }

    const par = itemEntry[`par${i}`];
    const min = parseInt(itemEntry[`min${i}`]) || 0;
    const max = parseInt(itemEntry[`max${i}`]) || 0;

    const propDef = propMap[propCode];
    if (!propDef) continue;

    const resolved = resolveProperty(propDef, par, min, max, statIdMap, constants);
    stats.push(...resolved);
  }

  return { stats, sockets, ethereal, indestructible };
}

function resolveProperty(
  propDef: any,
  par: any,
  min: number,
  max: number,
  statIdMap: Record<string, number>,
  constants: IConstantData,
): ResolvedStat[] {
  const results: ResolvedStat[] = [];

  // Track whether primary stat has np>1 (elemental damage grouping)
  let primaryHandledNp = false;

  for (let fi = 1; fi <= 7; fi++) {
    const func: number | undefined = propDef[`func${fi}`];
    const statName: string | undefined = propDef[`stat${fi}`];
    const val: any = propDef[`val${fi}`];

    if (!func) break;
    if (primaryHandledNp && (func === 16 || func === 18)) continue;

    const statId = statName ? statIdMap[statName] : undefined;

    switch (func) {
      case 1: // Direct stat
      case 2: // Direct stat (used by ac%, mindamage, etc.)
      case 3: // Same as 1 (multi-stat property secondary)
      case 8: // Speed modifier
        if (statId == null) break;
        results.push(makeDirectStat(statId, par, min, max, val, constants));
        break;

      case 5: // Min damage (hardcoded)
        results.push({ id: statIdMap["mindamage"] ?? 21, values: [max] });
        break;

      case 6: // Max damage (hardcoded)
        results.push({ id: statIdMap["maxdamage"] ?? 22, values: [max] });
        break;

      case 7: { // Enhanced damage → item_maxdamage_percent
        const edId = statIdMap["item_maxdamage_percent"] ?? 17;
        const np = constants.magical_properties[edId]?.np || 1;
        const values = [max];
        for (let j = 1; j < np; j++) values.push(0);
        results.push({ id: edId, values });
        break;
      }

      case 10: { // Skill tab → item_addskill_tab
        const tabId = statIdMap["item_addskill_tab"] ?? 188;
        const tabIdx = parseInt(par) || 0;
        const tab = tabIdx % 3;
        const classId = Math.floor(tabIdx / 3);
        results.push({ id: tabId, values: [tab, classId, max] });
        break;
      }

      case 11: { // Skill on event (gethit-skill, hit-skill, etc.)
        // e=2 encoding: values = [level, skillId, chance]
        if (statId == null) break;
        const skillId = parseInt(par) || 0;
        results.push({ id: statId, values: [max, skillId, min] });
        break;
      }

      case 15: { // Elemental min damage
        if (statId == null) break;
        const np = constants.magical_properties[statId]?.np || 1;
        if (np >= 2) {
          primaryHandledNp = true;
          if (np === 3) {
            // cold/poison: [min, max, length]
            const length = parseInt(par) || 0;
            results.push({ id: statId, values: [min, max, length] });
          } else {
            // fire/lightning/magic/normal: [min, max]
            results.push({ id: statId, values: [min, max] });
          }
        } else {
          results.push({ id: statId, values: [max] });
        }
        break;
      }

      case 16: // Elemental max damage — handled by np of func 15's stat
      case 18: // Elemental length — handled by np
        break;

      case 17: { // Per-level stat (ac/lvl, hp/lvl, etc.) — value is in par, not min/max
        if (statId == null) break;
        const perLvlVal = parseInt(par) || max || 0;
        results.push({ id: statId, values: [perLvlVal] });
        break;
      }

      case 19: { // Charged skill
        const chargedId = statIdMap["item_charged_skill"] ?? 204;
        const skill = parseInt(par) || 0;
        // e=3: values = [level, skillId, currentCharges, maxCharges]
        results.push({ id: chargedId, values: [max, skill, min, min] });
        break;
      }

      case 22: { // Skill / aura / oskill — sP encoding: values = [skillId, level]
        if (statId == null) break;
        const skill = parseInt(par) || 0;
        results.push({ id: statId, values: [skill, max] });
        break;
      }

      case 36: { // Random class skill (randclassskill)
        if (statId == null) break;
        // sP=3: classId param, sB=3: level value
        const classIdVal = parseInt(val) || 0;
        results.push({ id: statId, values: [classIdVal, max] });
        break;
      }

      case 12: { // Random skill (skill-rand) — not resolvable, skip
        break;
      }

      case 13: { // Durability percent (dur%)
        if (statId == null) break;
        results.push({ id: statId, values: [max] });
        break;
      }

      case 21: { // Class skills (pal, sor, nec, bar, ama, dru, ass, war) or element skills (fireskill)
        if (statId == null) break;
        const classOrElemId = parseInt(val) || 0;
        results.push({ id: statId, values: [classOrElemId, max] });
        break;
      }

      case 24: { // Monster-type stats (att-mon%, dmg-mon%, reanimate, state)
        if (statId == null) break;
        const monParam = parseInt(par) || 0;
        results.push({ id: statId, values: [monParam, max] });
        break;
      }

      default:
        // Unhandled func type, skip
        break;
    }
  }

  return results;
}

let _skillNameMap: Record<string, number> | null = null;
function buildSkillNameMap(): Record<string, number> {
  if (_skillNameMap) return _skillNameMap;
  const skills = loadData("skills.json");
  const map: Record<string, number> = {};
  for (const [, entry] of Object.entries(skills) as [string, any][]) {
    if (entry?.skill && entry["*Id"] != null) {
      map[entry.skill.toLowerCase()] = parseInt(entry["*Id"]);
    }
  }
  _skillNameMap = map;
  return map;
}

function resolveParamValue(par: any, skillNameMap: Record<string, number>): number {
  if (par == null || par === "") return 0;
  const num = parseInt(par);
  if (!isNaN(num)) return num;
  // Skill name string → numeric ID
  return skillNameMap[String(par).toLowerCase()] ?? 0;
}

/**
 * Resolve a runeword by name: returns its rune codes, auto-resolved stats, and allowed base types.
 */
export function resolveRuneword(
  runewordName: string,
  constants: IConstantData,
  itemTypeContext?: "weapon" | "helm" | "shield" | "armor",
): ResolvedRuneword | null {
  const runesData = loadData("runes.json");

  // runes.json keys are the runeword display names (e.g., "Enigma")
  let entry: any = null;
  for (const [key, val] of Object.entries(runesData) as [string, any][]) {
    if (key.toLowerCase() === runewordName.toLowerCase()) {
      entry = val;
      break;
    }
  }
  if (!entry || !entry.complete) return null;

  // Extract runes (Rune1-Rune6)
  const runes: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const code = entry[`Rune${i}`];
    if (code) runes.push(code);
  }

  // Extract base types (itype1-itype6)
  const baseTypes: string[] = [];
  for (let i = 1; i <= 6; i++) {
    const itype = entry[`itype${i}`];
    if (itype) baseTypes.push(itype);
  }

  // Resolve stats (T1Code1-T1Code7)
  const statIdMap = buildStatIdMap();
  const propMap = buildPropMap();
  const skillNameMap = buildSkillNameMap();
  const stats: ResolvedStat[] = [];

  for (let i = 1; i <= 7; i++) {
    const propCode: string | undefined = entry[`T1Code${i}`];
    if (!propCode || propCode === "") continue;

    const rawPar = entry[`T1Param${i}`];
    const par = resolveParamValue(rawPar, skillNameMap);
    const min = parseInt(entry[`T1Min${i}`]) || 0;
    const max = parseInt(entry[`T1Max${i}`]) || 0;

    const propDef = propMap[propCode];
    if (!propDef) continue;

    const resolved = resolveProperty(propDef, par, min, max, statIdMap, constants);
    stats.push(...resolved);
  }

  // Resolve individual rune-in-socket bonuses from gems.json
  if (itemTypeContext) {
    const gemsData = loadData("gems.json") as Record<string, any>;
    // gems.json uses helmMod for both helm and body armor categories
    const modPrefix = itemTypeContext === "armor" ? "helm" : itemTypeContext;

    for (const runeCode of runes) {
      const runeEntry = gemsData[runeCode];
      if (!runeEntry) continue;

      for (let i = 1; i <= 3; i++) {
        const propCode = runeEntry[`${modPrefix}Mod${i}Code`];
        if (!propCode || propCode === "") continue;
        const par = runeEntry[`${modPrefix}Mod${i}Param`];
        const min = parseInt(runeEntry[`${modPrefix}Mod${i}Min`]) || 0;
        const max = parseInt(runeEntry[`${modPrefix}Mod${i}Max`]) || 0;

        const propDef = propMap[propCode];
        if (!propDef) continue;
        const resolved = resolveProperty(propDef, par, min, max, statIdMap, constants);
        stats.push(...resolved);
      }
    }
  }

  return { runes, stats, baseTypes };
}

function makeDirectStat(
  statId: number,
  par: any,
  min: number,
  max: number,
  propVal: any,
  constants: IConstantData,
): ResolvedStat {
  const prop = constants.magical_properties[statId];
  if (!prop) return { id: statId, values: [max] };

  const sP = prop.sP || 0;
  const np = prop.np || 1;
  const dF = prop.dF || 0;

  if (sP > 0) {
    if (dF === 14) {
      // Skill tab: par encodes tab index (tab + class*3)
      const tabIdx = parseInt(par) || parseInt(propVal) || 0;
      const tab = tabIdx % 3;
      const classId = Math.floor(tabIdx / 3);
      return { id: statId, values: [tab, classId, max] };
    }
    // Param from d2data item par field or property val field
    const param = parseInt(par) || parseInt(propVal) || 0;
    return { id: statId, values: [param, max] };
  }

  if (np > 1) {
    const values = [max];
    for (let j = 1; j < np; j++) values.push(0);
    return { id: statId, values };
  }

  return { id: statId, values: [max] };
}
