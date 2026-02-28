---
name: d2r-loadout
description: >-
  Build a complete D2R character equipment loadout. This skill should be used
  when the user asks to "build a loadout", "配裝", "full equipment",
  "build a Pitzerker", "equip a character", "gear up my Sorceress",
  "complete build", "full gear set", or mentions wanting to create a full
  set of Diablo II: Resurrected items for a character build.
  For individual items or searches, use the d2r-items skill instead.
---

# D2R Loadout Builder

Build complete character equipment sets for Diablo II: Resurrected. Uses the `d2r-items` skill's CLI for item generation.

## Equipment Slots

| Slot | Field | Notes |
|------|-------|-------|
| Helm | Head | |
| Armor | Body | |
| Weapon | Primary Hand (right) | See weapon slot rules below |
| Off-hand | Secondary Hand (left) | Shield, second weapon, or blocked by two-handed weapon |
| Gloves | Hands | |
| Boots | Feet | |
| Belt | Waist | |
| Ring 1 | Left Ring | |
| Ring 2 | Right Ring | |
| Amulet | Neck | |
| Charms | Inventory (optional) | |

## Loadout Workflow

> "Build me a Necromancer loadout, level 50-60, prefer sets, fill with uniques"

**Steps:**

1. **Determine constraints** — class, level range, play style, priorities (set > unique, etc.)
2. **Search for set items first** (if preferred):
   - `--search --class <class> --quality set --max-level <lvl>`
   - Identify which sets can be partially or fully equipped
   - Select the best set combo covering the most slots
3. **Fill remaining slots with uniques**:
   - `--search --quality unique --type <slot-type> --max-level <lvl>` per slot
   - Pick best-in-slot for each remaining slot
4. **Name the loadout** — derive a short, descriptive English name in kebab-case from the build (e.g., `cold-sorc-endgame`, `natalya-assassin`, `barb-mf`). This name becomes the output folder.
5. **Present the full loadout** as a table:
   - Slot | Item Name | Type | Quality | Key Stats | Level Req
   - Show the loadout name at the top
6. **Confirm with user** — ask if they want adjustments (including the loadout name)
7. **Generate all items** — use batch mode (JSON array in spec file). Set each item's `outputPath` to `$TMPDIR/d2r-items/<loadout-name>/<slot>-<item-name>.d2i` (e.g., `$TMPDIR/d2r-items/cold-sorc-endgame/helm-griffons-eye.d2i`). Report the folder path and all output paths.
8. **Verify required levels** — for level-restricted loadouts, run `--read` on the generated charm `.d2i` files to confirm `requiredLevel` fits the target range. Do **not** rely on D2RuneWizard Hero Editor's "Required Level" display for magic items (it has a known bug). Use proper affix IDs (`magicPrefix`/`magicSuffix`) with `levelreq` within the target range rather than defaulting to `0, 0`.

## Weapon Slot Rules

Characters have two hand slots: Primary (right) and Off-Hand (left).

- **One-handed** weapons use only the primary slot — off-hand can hold a shield, a second weapon (if the class allows dual-wielding), or remain empty.
- **Two-handed** weapons normally occupy both slots — no off-hand allowed.
- Some classes can **dual-wield** specific weapon types, or wield **two-handed weapons one-handed**. These rules vary by class and may change with game patches.

**Do not assume weapon behavior per class from memory.** When building a loadout, determine the weapon setup first — it dictates whether a shield/off-hand slot is available. If unsure about a class's weapon mechanics (dual-wield eligibility, one-hand vs two-hand, class-specific weapon types), either ask the user or research online before proceeding.

## Socket Strategy Guidance

When building a loadout, ask the user about their preferred socket strategy. The `socketFill` field supports:

| Strategy | Best for | Description |
|----------|----------|-------------|
| `"mf"` | Magic Find builds | Ist in weapons/shields, Ptopaz in armor/helm |
| `"resist"` | Survivability | Um runes across the board |
| `"damage"` | Physical DPS | Ohm in weapons, Ber in armor |
| `"caster"` | Caster builds | Ist runes (use `socketedItems` for facets) |
| `"ias"` | Attack speed | Shael runes |
| `"cbf"` | Cannot Be Frozen | Cham runes |

For builds that mix strategies (e.g., MF on helm + resist on shield), use manual `socketedItems` per item.

## Sunder Charms (破免)

Sunder Charms break monster immunity. Variants: original, Latent (internal name: PreCrafted), and Crafted.

| Element | Sunder Charm |
|---------|-------------|
| Cold | Cold Rupture |
| Fire | Flame Rift |
| Lightning | Crack of the Heavens |
| Poison | Rotting Fissure |
| Magic | Black Cleft |
| Physical | Bone Break |

## Tips

- Consider synergy between items (e.g., +skills for the class, resistance coverage)
- Note when a set bonus requires N pieces — warn if only using partial set
- For class-specific items, verify the item can be equipped by the target class
- Charms are optional — offer to add them for extra stats
- Unique items: Larzuk gives exactly 1 socket to unique items
- Use `statOverrides` when auto-resolved stats need correction (e.g., Hellfire Torch class)
- **Terminology**: when the user uses non-English gaming terms, verify the item mapping before selecting — see `d2r-items` skill "Terminology & Translation" section and `references/zh-tw-terms.md`
- **Data freshness**: the CLI data source may not cover the latest patches — see `d2r-items` skill "Data Source & Limitations" section

## CLI Reference

All commands use: `npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" <command>`

Key commands for loadout building:

| Command | Purpose |
|---------|---------|
| `--search --class <c> --quality set` | Find class set items |
| `--search --quality unique --type <t>` | Find unique items by slot type |
| `--search --quality magic-prefix -c <c>` | Find class-specific magic prefixes |
| `--lookup "<name>"` | Get item code and ID |
| `--resolve-stats --quality <q> --id <n>` | Preview auto-resolved stats |
| `--file /tmp/d2r-spec.json` | Generate items (single or batch array) |
