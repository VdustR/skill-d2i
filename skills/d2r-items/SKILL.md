---
name: d2r-items
description: >-
  Generate D2R .d2i item files via natural language for single-player use.
  This skill should be used when the user asks to "generate a d2i item",
  "create a d2r item", "give me a Windforce", "generate a legit Shako",
  "make a 6-socket Grandfather", "find Amazon set items", "make a 7% MF
  small charm", "search magic prefix", "d2i", or mentions wanting to create
  Diablo II: Resurrected items for single-player / Hero Editor import.
  For full character loadouts / builds, use the d2r-loadout skill instead.
---

# D2R Item Generator

Generate `.d2i` item files for Diablo II: Resurrected single-player use. Uses `@dschu012/d2s` for binary encoding (D2R version 99 / 0x63).

Data source: [blizzhackers/d2data](https://github.com/blizzhackers/d2data) (master branch, cached locally via `--setup`).

## Data Source & Limitations

- **Source**: master branch tarball from [blizzhackers/d2data](https://github.com/blizzhackers/d2data)
- **Coverage**: depends on when the repo was last updated — check the commit history for the actual D2R patch version
- **Check freshness**: `gh api "repos/blizzhackers/d2data/commits?per_page=3&path=json/uniqueitems.json" --jq '.[] | "\(.commit.committer.date) | \(.commit.message)"'`
- **Local cache metadata**: `~/.cache/game-d2i-skills/d2data/_meta.json` records `fetchedAt` timestamp
- **Display name mismatch**: some items have different internal names (`index` field) vs in-game display names (from `allstrings-eng.json`). For example, "Latent Cold Rupture" is stored as "PreCrafted Cold Rupture". When a lookup returns no results, the item may exist under a different internal name — check `allstrings-eng.json` or search the web to find the mapping.
- **Refresh**: run `--update-data` to re-download from the repo

## Terminology & Translation

When the user uses non-English item names, slang, or abbreviations, **do not assume the mapping** — verify first:

1. **Search or lookup** the translated term in the CLI to confirm it exists
2. If no match, **check the reference files** (e.g., `references/zh-tw-terms.md` for Traditional Chinese)
3. If still no match, **search the web** for the community term to identify the correct item
4. If still ambiguous, **ask the user** to clarify before proceeding

## First-Time Setup

Before any search or generation, ensure d2data is cached locally:

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --setup
```

This downloads the full d2data repository (tarball) to `~/.cache/game-d2i-skills/d2data/`. Run `--update-data` to refresh after a game patch.

## Output Format

Before generating items, ask the user which tool they will use to import the `.d2i` file:

| Tool | Format | Description |
|------|--------|-------------|
| [D2RuneWizard Hero Editor](https://d2runewizard.com/hero-editor) | `"raw"` | Raw item bytes only (no container header) |
| Other / General | `"d2"` | Standard D2I container: `JM` header + uint16 count + item bytes |

Set the `format` field in ItemSpec JSON accordingly. Once the user answers, remember their choice for the rest of the session — do not ask again.

## Legitimacy Classification

Before generating, classify the request:

| Class | Definition | Example |
|-------|-----------|---------|
| **LEGIT** | Stats within game-possible ranges | Windforce with 250% ED |
| **MODIFIED** | Valid base with impossible stats | 6-socket Monarch (normally max 4) |
| **IMPOSSIBLE** | Cannot exist in-game at all | +5 All Skills Small Charm |

Always inform the user which class before generating.

---

## Three Workflows

### Workflow 1 — Single Item

> "Give me a Windforce" / "幫我做一個暗金頭"

1. Translate the item name to English if needed
2. **Lookup** — `--lookup "<name>"` to get code and uniqueId/setId
3. Build ItemSpec JSON with `itemCode`, `quality`, `uniqueId`/`setId` — **omit `stats` to auto-resolve from d2data** (uses max rolls = perfect item)
4. Write to `/tmp/d2r-spec.json`, **Generate** — `--file /tmp/d2r-spec.json`
5. Report output path, file size, and legitimacy class

**Auto-resolve**: when the item has a `uniqueId` or `setId`, the CLI automatically resolves from d2data (`--setup` required):
- **Stats** — omit or leave `stats` empty to auto-resolve (max rolls = perfect item). Provide `stats` explicitly to override (for modified/impossible items).
- **Sockets** — omit `sockets` to auto-resolve from d2data. The resolved value is the item's max socket count. Set `sockets` explicitly to override.

**statOverrides**: selectively override specific auto-resolved stats without losing the rest. Useful when auto-resolve gives wrong values (e.g., Hellfire Torch class/level).

```json
{"itemCode":"rin","quality":"unique","level":85,"uniqueId":400,"stats":[],"statOverrides":{"83":[4,3]}}
```
This auto-resolves all Hellfire Torch stats, then overrides stat 83 (`item_addclassskills`) to `[4, 3]` → `[classId=4 (Barbarian), value=3 (+3 skills)]`.

**Runeword auto-resolve**: when `runewordId` is set, the CLI also auto-resolves:
- **socketedItems** — the correct runes in order (e.g., Jah-Ith-Ber for Enigma)
- **sockets** — number of runes needed
- **runewordAttributes** — runeword bonus stats (max rolls)

Minimal runeword spec — only `itemCode`, `quality`, `level`, and `runewordId` needed:
```json
{"itemCode":"utp","quality":"normal","level":85,"runewordId":59,"stats":[]}
```

**Socket fill strategy**: for non-runeword socketed items, **ask the user** which socketing strategy they prefer before generating. Set `socketFill` in the spec:

| `socketFill` | Weapon | Shield | Armor/Helm | Use case |
|-------------|--------|--------|------------|----------|
| `"mf"` | Ist (+30% MF) | Ist (+30% MF) | Ptopaz (+24% MF) | Magic Find builds |
| `"resist"` | Um (+15 res) | Um (+22 res) | Um (+15 res) | Survivability |
| `"damage"` | Ohm (+50% ED) | Ber (+8% DR) | Ber (+8% DR) | Physical DPS |
| `"caster"` | Ist | Ist | Ist | Caster builds (use `socketedItems` for facets) |
| `"ias"` | Shael (+20 IAS) | Shael | Shael | Attack speed |
| `"cbf"` | Cham (CBF) | Cham | Cham | Cannot Be Frozen |

Ask like: "How would you like the sockets filled? MF (Ist/Ptopaz), resist (Um), damage (Ohm/Ber), or something else?"

If the user has specific requirements, use manual `socketedItems` instead. Each entry needs only `itemCode` for runes (`r01`-`r33`) and gems (`gXX`). For jewels (`jew`), also set `quality` and `stats`.

```json
{
  "itemCode":"uar","quality":"superior","level":85,"sockets":3,"stats":[],
  "socketedItems":[{"itemCode":"gpr"},{"itemCode":"gpr"},{"itemCode":"gpr"}]
}
```

### Workflow 2 — Condition Search

> "Find Amazon-exclusive set items" / "Show me all unique polearms"

1. Identify search criteria (class, item type, quality, level range)
2. **Search** — `--search` with appropriate filters
3. Present results as a table (name, base, key stats, level req)
4. Ask user which items to generate
5. Generate selected items via Workflow 1

### Workflow 3 — Magic Item

> "Make a 7% MF small charm" / "找 Barbarian 技能魔法前綴"

Magic items need a prefix ID, suffix ID, or both. Use the magic affix search to find the right IDs.

**Required level**: the game calculates `reqLvl = max(base_item_levelreq, prefix_levelreq, suffix_levelreq)` using d2data's `levelreq` field. Use the CLI's `--read` command to verify the calculated `requiredLevel` from d2data — this matches the actual game value.

**D2RuneWizard Hero Editor reqLvl bug**: the hero editor displays **incorrect** required levels for magic items due to two bugs in its JavaScript: (1) its prefix data array uses different indexing than the game binary, and (2) it uses the prefix data array for suffix lookups too. **Ignore the hero editor's "Required Level" for magic items** — verify with `--read` or in-game instead.

**Choosing affixes for level-restricted builds**: when the user specifies a level range (e.g., "level 10-20"), select affixes whose `levelreq` fits within that range. Use `--max-level` in search to filter. Prefer using proper affix IDs over `magicPrefix: 0, magicSuffix: 0` so items display correct names (e.g., "Bronze Small Charm of Life" instead of just "Small Charm"). Only use `0, 0` when the level budget is extremely tight (reqLvl must be 1) or the user explicitly requests no affix names.

**Steps:**

1. **Search for affixes** — `--search --quality magic-prefix` or `--search --quality magic-suffix` with filters:
   - `-q <name>` — name substring (e.g., "Shimmering" for resistance prefix)
   - `-c <class>` — class-specific affixes (e.g., `-c bar` for Barbarian skill tab prefixes)
   - `-t <type>` — itype code filter (matches affix `itype` fields in d2data, e.g., `scha` for small charms, `mcha` for medium charms, `lcha` for large charms, `weap` for weapons). **Not the item code** (`cm1`).
   - `--min-level` / `--max-level` — affix level range
2. **Present matches** — show name, ID, mod code, mod range, item types, class restriction
3. **Build ItemSpec** with `quality: "magic"`, `magicPrefix` and/or `magicSuffix` set to the chosen affix IDs
4. **Provide stats** — magic items require explicit `stats` (no auto-resolve for magic quality). Use the mod info from the affix search to set appropriate stat values.
5. **Generate** via `--file`

**Example**: 7% MF Small Charm
```json
{
  "itemCode": "cm1",
  "quality": "magic",
  "level": 85,
  "magicPrefix": 0,
  "magicSuffix": 290,
  "stats": [{"id": 80, "values": [7]}]
}
```
Note: suffix 290 = "of Fortune" (MF 3-5% on small charms). Search result IDs can be used directly in the spec.

---

## CLI Reference

All commands use: `npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" <command>`

### --setup / --update-data

Download d2data JSON files to local cache. Required before `--search`.

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --setup
```

### --lookup \<name\>

Fast fuzzy name search from d2s constants (no d2data cache needed):

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --lookup "windforce"
```

```json
{"success":true,"query":"windforce","count":1,"results":[
  {"name":"Windforce","code":"6lw","id":266,"category":"unique"}
]}
```

- `category`: `unique` | `set` | `runeword` | `armor` | `weapon` | `other`
- For unique/set: `id` = uniqueId/setId for ItemSpec
- For runeword: `id` = runewordId, `code` is empty (use base item code)

### --search [filters]

Rich search across cached d2data (requires `--setup` first):

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --search [filters]
```

**Filters:**

| Flag | Short | Description | Example |
|------|-------|-------------|---------|
| `--query` | `-q` | Name substring | `-q "windforce"` |
| `--class` | `-c` | Class filter (matches base item categories + set UIClass) | `-c amazon` |
| `--type` | `-t` | Item type (helm, sword, shield, belt, etc.) | `-t helm` |
| `--quality` | | `unique`, `set`, `runeword`, `base`, `magic-prefix`, `magic-suffix` | `--quality set` |
| `--min-level` | | Minimum level requirement | `--min-level 40` |
| `--max-level` | | Maximum level requirement | `--max-level 60` |
| `--limit` | | Max results (default 50) | `--limit 20` |

**Result includes** `name`, `code`, `id`, `category`, `baseName`, `levelReq`, `props` (stat summary).

For unique, set, and base results: also includes `strReq`, `dexReq` (omitted when 0). These are base item values — ethereal discount is not applied at search time.

For magic affix results, also includes: `modCode`, `modMin`, `modMax`, `itemTypes[]`, `classSpecific`.

**Examples:**

```bash
# Amazon set items
--search --class amazon --quality set

# Unique helms under level 60
--search --quality unique --type helm --max-level 60

# All items named "Tal Rasha"
--search -q "tal rasha"

# Barbarian skill tab magic prefixes
--search --quality magic-prefix --class bar

# MF-related magic suffixes
--search --quality magic-suffix -q "fortune"
```

### --resolve-stats --quality unique|set --id \<numericId\>

Preview the auto-resolved stats for an item (useful for debugging):

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --resolve-stats --quality set --id 80
```

```json
{"success":true,"quality":"set","id":80,"count":9,"stats":[{"id":9,"values":[30]},{"id":7,"values":[60]},...]}
```

### --file \<spec.json\> [--format d2|raw]

Generate .d2i file(s) from an ItemSpec JSON. Accepts a single object or a JSON array for batch generation.

```bash
# Single item
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --file /tmp/d2r-spec.json

# Single item with format override
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --file /tmp/d2r-spec.json --format raw
```

**Single item output:**
```json
{"success":true,"outputPath":"/tmp/.../d2r-items/6lw-1708912345000.d2i","fileSize":36,"format":"raw"}
```

**Batch output** (when spec is a JSON array):
```json
{"success":true,"count":3,"results":[
  {"outputPath":"/tmp/.../cm1-1708912345001.d2i","fileSize":24,"format":"raw"},
  {"outputPath":"/tmp/.../cm1-1708912345002.d2i","fileSize":24,"format":"raw"},
  {"outputPath":"/tmp/.../cm1-1708912345003.d2i","fileSize":24,"format":"raw"}
]}
```

The format can be set via `--format` flag or `"format"` field in the spec JSON (spec field takes precedence).

When `outputPath` is set per item in the spec array, each item is written to that path instead of the default timestamp-based name.

---

## ItemSpec JSON Format

```jsonc
{
  "itemCode": "6lw",          // 3-4 char code (from --lookup or --search)
  "quality": "unique",         // low | normal | superior | magic | set | rare | unique | craft
  "level": 85,                 // item level (ilvl)
  "identified": true,          // default: true
  "ethereal": false,           // default: false
  "sockets": 0,                // omit to auto-resolve from d2data; set explicitly to override
  "uniqueId": 266,             // required for unique quality
  "setId": 80,                 // required for set quality
  "magicPrefix": 0,            // for magic quality (0 = no prefix, 0-indexed row in d2data)
  "magicSuffix": 0,            // for magic quality (0 = no suffix, 0-indexed row in d2data)
  "rareNameId": 0,             // for rare/craft quality
  "rareNameId2": 0,            // for rare/craft quality
  "magicalNameIds": [null,null,null,null,null,null], // for rare/craft
  "runewordId": 59,            // for runeword items
  "runewordAttributes": [],    // auto-resolved from d2data; provide to override
  "socketedItems": [],          // auto-resolved for runewords; manual for gems/jewels
  "socketFill": "mf",           // auto-fill strategy: mf | resist | damage | caster | ias | cbf
  "statOverrides": {"83": [4, 3]}, // override specific auto-resolved stats by stat ID
  "stats": [],                   // omit or [] for auto-resolve from d2data (max rolls)
  // "stats": [{"id": 17, "values": [250, 0]}],  // explicit stats override auto-resolve
  "defense": 0,                // base defense (armor/shields)
  "maxDurability": 40,         // max durability (armor/weapons)
  "currentDurability": 40,     // current durability
  "quantity": 0,               // stackable items
  "outputPath": "",             // optional custom path
  "format": "raw"              // "d2" (default, JM container) | "raw" (for D2RuneWizard Hero Editor)
}
```

### Stat Value Notes

- Values are **game-display values** — the CLI handles save-add (sA) encoding automatically
- Multi-property stats (np > 1): `item_maxdamage_percent` (id:17, np:2) = `[ed, maxDmgBonus]`
- Param stats (sP): `item_singleskill` (id:107) = `[skillId, level]`
- Elemental: `firemindam` (48, np:2) = `[min, max]`; `coldmindam` (54, np:3) = `[min, max, length]`
- See `references/common-stats.md` for full value format reference

---

## Quality Types

| Quality | Value | Required Fields |
|---------|-------|----------------|
| low | 1 | — |
| normal | 2 | — |
| superior | 3 | — |
| magic | 4 | magicPrefix, magicSuffix |
| set | 5 | setId |
| rare | 6 | rareNameId, rareNameId2, magicalNameIds |
| unique | 7 | uniqueId |
| craft | 8 | rareNameId, rareNameId2, magicalNameIds |

## Notes

- **Single item** output defaults to `$TMPDIR/d2r-items/<code>-<timestamp>.d2i`
- **Loadout** output uses a named folder: `$TMPDIR/d2r-items/<loadout-name>/<slot>-<item-name>.d2i` (set via `outputPath` per spec)
- Only D2R version 99 (latest patch)
- For single-player / Hero Editor import only
- For runeword items: set base item code + `runewordId` — runes, sockets, and `runewordAttributes` are auto-resolved from d2data
- Unique items: Larzuk gives exactly 1 socket to unique items
- Reference: `references/common-stats.md` for stat IDs and value formats
- **Magic item required level**: `reqLvl = max(base_levelreq, prefix_levelreq, suffix_levelreq)` using d2data `levelreq` fields. The `--read` command calculates this automatically. Note: D2RuneWizard Hero Editor shows incorrect reqLvl for magic items (see Workflow 3 notes)
- **Stat bit field limits**: each stat has a max value determined by its save bits (sB) and save-add (sA). Exceeding the limit causes **wrap-around** (overflow), not corruption — the value silently wraps to the opposite extreme (e.g., +224 Str → -32 Str). See `references/common-stats.md` for per-stat ranges
