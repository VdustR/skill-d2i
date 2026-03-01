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

> "Build me a Necromancer loadout, level 50-60"

### Phase 1: Build Identity

Ask the user (via `AskUserQuestion` or conversation):

1. **Class** + **level range**
2. **Build direction / skill focus** — present known archetypes for the class (e.g., Necromancer: Bone, Summon, Poison, CE) and let the user pick or describe their own
   - If the user is unsure → offer to **research online** (web search for popular builds at the target level/class), then return with recommendations
   - This determines: which +skills matter, caster vs melee vs summon, FCR vs IAS breakpoints
3. **Max block?** — if the build uses a shield, ask whether to pursue 75% max block. This has a large hidden dex cost (see Max Block Dex Cost section). Default: no for casters, ask for melee/hybrids.
4. **Target difficulty** — Normal / Nightmare / Hell. Affects resistance penalty (0 / -40 / -100) and resistance coverage verification.
5. **Unlimited stat points?** — ask whether the user is using a Hero Editor with unlimited stat points.
   - **Yes (Editor mode)** → skip stat budget validation entirely, recommend BiS gear without budget constraints, still output "Ideal Stats" as reference
   - **No (Legit mode)** → existing budget validation flow
   - When Editor mode is selected, Q6 and Q7 are still asked (quest bonuses affect resistance and skill point totals), but stat budget validation is skipped
6. **Quest progress** — how many difficulties' worth of permanent-bonus quests have been completed? (See Quest Reward Reference section for what each completion grants.)
   - Smart defaults based on target difficulty + level:
     - Target Normal → default N = 0
     - Target Nightmare → default N = 1
     - Target Hell, level < 75 → default N = 2
     - Target Hell, level ≥ 75 → default N = 3
   - Present the default and let the user accept or manually set 0/1/2/3
   - N applies uniformly to all quest rewards — the assumption is that players complete all permanent-bonus quests within each difficulty (standard practice)
7. **Equipment bonus trust level** — how much to trust equipment +str/+dex bonuses for stat planning?
   - **Full trust (100%)** — greedy algorithm counts all equipment bonuses
   - **Conservative trust (75%)** — equipment bonuses discounted to 75%, provides swap safety margin **(Recommended)**
   - **Self-sufficient (0%)** — base stats + invested points alone must meet the highest requirement. ⚠️ Very expensive, most builds will be NOT FEASIBLE
   - **Conflict guard**: if the user selects both Self-sufficient (0%) AND Max block (Q3), warn immediately: "Self-sufficient + max block is extremely expensive and almost always NOT FEASIBLE. Max block requires very high Dex investment that consumes most of the stat budget even with equipment bonuses. Recommend switching to Conservative trust (75%) or disabling max block." Present options: switch to 75%, disable max block, or proceed anyway.

### Phase 2: Discovery (subagents preferred)

Prefer dispatching subagents in parallel for speed; fall back to sequential search if subagents are unavailable:

- **Subagent A — Sets**: `--search --quality set --class <class> --max-level <lvl>` — find available sets for the class
- **Subagent B — Uniques per slot**: run `--search --quality unique --type <slot-type> --max-level <lvl>` for each slot category (helm, armor, boots, gloves, belt, ring, amulet, weapon, shield)

Subagents return raw candidate lists. Main agent does NOT search itself — it focuses on analyzing results.

### Phase 3: Strategy Selection

Present findings and ask the user to choose (via `AskUserQuestion`):

1. **Set core + unique fill** — show which sets are available, how many pieces fit the level range, key set bonuses. User picks a set as core; remaining slots filled with uniques.
2. **All uniques** — best-in-slot per slot, no set dependency.

### Phase 4: Batch Recommendation & Selective Drill-Down

**Restate build direction** at the start (from Phase 1) to prevent drift.

Main agent evaluates all candidates and presents a **single batch recommendation table** covering all slots:

| Slot | Recommended | Req Lvl | Req Str | Req Dex | Key Stats | Why |
|------|-------------|---------|---------|---------|-----------|-----|
| Helm | Harlequin Crest | 62 | 50 | — | +2 Skills, DR 10% | BiS for caster |
| Boots | Sandstorm Trek | 64 | 91 | — | +Str/Vit | ⚠️ Str may be tight |
| ... | ... | ... | ... | ... | ... | ... |

**Selection criteria per slot:**

1. **Class restriction** — class-specific items must match target class
2. **Stat budget** — run the Stat Budget Verification algorithm (including max block dex if applicable). If ❌ NOT FEASIBLE, run auto-fix before presenting to user. If ⚠️ TIGHT, note it in the table. Include a stat budget summary below the table
3. **Build synergy** — prioritize stats that match Phase 1 direction (+skills, FCR, etc.)
4. **Level requirement** — must fit target level range (including socketed item requirements)
5. **No duplicate uniques** — the same unique item cannot appear in two slots (e.g., dual Stone of Jordan is not legit). If a unique is recommended for two slots, replace one with the next-best alternative
6. **Resistance coverage** — sum all +resistance from the loadout and compare against the difficulty penalty. Flag ⚠️ if any element is negative after penalty (see Resistance Coverage Check)
7. **Breakpoint check** — sum FCR/FHR/IAS from items and identify the nearest breakpoints. Flag if 1-5 points short of a beneficial breakpoint — swapping one item might be worthwhile (see Breakpoint Awareness)

**Phase 4 Gate** — all must pass before presenting the table:

1. [ ] Class restriction — no wrong-class items
2. [ ] No duplicate uniques across slots
3. [ ] All items within level range
4. [ ] Stat budget ✅/⚠️/❌ (with max block if applicable)
5. [ ] Resistance coverage ✅/⚠️/❌
6. [ ] Breakpoint gaps flagged (≤5 from next)
7. [ ] Auto-fix applied if ❌ NOT FEASIBLE on stat budget. If ❌ Dangerous on resistance, flag with swap recommendations (see Resistance Coverage Check) — do not auto-replace items for resistance, present options to user

**User reviews the batch table**, then:
- **Approve all** → proceed to Phase 5
- **Contest specific slots** → main agent expands those slots into a comparison table (2-4 candidates with trade-offs), user picks, then proceed

**Verification summaries** (include below the table):
```
**Stat Budget**: <Class> Lv<L> | Base str=<X>, dex=<Y> | Budget=(<L>-1)×5 + <N>×5 = <budget> pts | Trust: <100%/75%/0%>
Str invested: <A> | Dex invested: <B> (includes max block: <C>) | Total: <A+B>/<budget> (<pct>%)
Remaining for <vit/energy/split>: <budget-A-B>
Verdict: ✅ OK / ⚠️ TIGHT / ❌ NOT FEASIBLE

**Resistance** (<difficulty>, <penalty>, quest +<N×10>): Fire +<X> | Cold +<Y> | Ltng +<Z> | Poison +<W>
Verdict: ✅ Adequate / ⚠️ Gaps / ❌ Dangerous

**Breakpoints**: FCR <current>/<next> | FHR <current>/<next> | IAS <current>/<next>
```

### Phase 5: Confirm & Generate

1. **Name the loadout** — derive a short, descriptive English name in kebab-case from the build (e.g., `bone-necro-50`, `natalya-assassin`, `cold-sorc-endgame`). This name becomes the output folder.
2. **Present final loadout table**: Slot | Item | Quality | Req Lvl | Req Str | Req Dex | Key Stats
3. **Confirm with user** — including the loadout name
4. **Generate all items** — use batch mode (JSON array in spec file). Set each item's `outputPath` to `$TMPDIR/d2r-items/<loadout-name>/<slot>-<item-name>.d2i` (e.g., `$TMPDIR/d2r-items/bone-necro-50/helm-harlequin-crest.d2i`). Report the folder path and all output paths.
5. **Verify required levels** — run `--read` on the generated `.d2i` files to confirm `requiredLevel` fits the target range (this includes socketed items). Do **not** rely on D2RuneWizard Hero Editor's "Required Level" display for magic items (it has a known bug). Use proper affix IDs (`magicPrefix`/`magicSuffix`) with `levelreq` within the target range rather than defaulting to `0, 0`.
6. **Verify stat requirements** — run `--read` to confirm `requiredStr`/`requiredDex` from generated files. Re-run the stat budget algorithm on the final loadout. Report the stat budget summary and verdict. If the verdict changed (e.g., due to socketFill adding items with level requirements), run auto-fix.
7. **Output stat allocation recommendation** — present the recommended stat point distribution:

   **Summary table:**
   ```
   ## Stat Allocation

   | Attribute | Base | Invested | Equipment | Quest | Total | Purpose |
   |-----------|------|----------|-----------|-------|-------|---------|
   | Strength  | 15   | 141      | +40 (×75%=30) | —  | 186   | Spirit Monarch (156 req) |
   | Dexterity | 25   | 0        | +20 (×75%=15) | —  | 40    | No max block |
   | Vitality  | 25   | 259      | —         | —     | 284   | Remaining points |
   | Energy    | 25   | 0        | —         | —     | 25    | — |

   Budget: (79-1)×5 + 2×5 = 400 pts | Used: 141+0=141 | Remaining for Vit: 259
   Verdict: 141/400 = 35% ≤ 60% → ✅ OK
   Quest bonuses: +10 stat pts, +20 all res, +40 life
   Trust factor: 75% (conservative)
   ```

   **ES build variant** — remaining points go to Energy (or split per user choice):
   ```
   | Vitality  | 15   | 50       | —         | —     | 65    | Safety net |
   | Energy    | 25   | 209      | —         | —     | 234   | ES mana pool |
   ```

   **Detailed breakdown** (include below the summary):
   ```
   ### Calculation Details
   1. Base stats: <Class> Str=<X>, Dex=<Y>
   2. Quest bonus: <N>× completions = +<N×5> stat points → budget = <total>
   3. Greedy equipping order (trust factor: <pct>%):
      - <item>: req <str>/<dex>, grants +<str>/+<dex> → invested <str>/<dex>
      - ...
   4. Equipment bonuses (actual full): +str <X>, +dex <Y>
   5. Equipment bonuses (at <pct>% for simulation): +str <X'>, +dex <Y'>
   6. Ethereal items: <list or "none">
   7. Max block: <dex cost or "N/A">
   8. Final: Str <A> + Dex <B> = <total> / <budget>
   9. Verdict: <pct>% <operator> 60% → <verdict>
   10. Remaining <R> → <destination> (<reason>)
   ```

8. **Unlimited mode** (Editor mode from Phase 1 Q5): if the user selected Editor mode, skip steps 1-6 (stat budget validation, auto-fix) and instead:
   - Recommend BiS items without budget constraints
   - Output an "Ideal Stats" section using the same table format but with header: **"Editor Mode — no budget constraint"** and without a verdict line
   - Str/Dex: just enough for highest gear requirement (+ max block if chosen)
   - Remaining: all Vitality (or Energy for ES builds)

**Phase 5 Gate** — all must pass before declaring the loadout complete:

1. [ ] `--read` confirms `requiredLevel` within target range for every item
2. [ ] `--read` confirms `requiredStr`/`requiredDex` match expectations
3. [ ] Stat budget re-verified with actual generated values (verdict unchanged or improved)
4. [ ] Resistance coverage re-verified after socketFill (verdict unchanged or improved)
5. [ ] Breakpoint gaps re-checked after socketFill (IAS/resist runes may shift totals)
6. [ ] All verification summaries (stat budget + resistance + breakpoints) included in output
7. [ ] Stat allocation recommendation output included (summary table + detailed breakdown)
8. [ ] If Editor mode: Ideal Stats section output instead of budget verification

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

## Quest Reward Reference

Permanent quest rewards available once per difficulty (Normal / Nightmare / Hell). N = number of difficulties completed (from Phase 1 Q6).

### Stat Points (affects budget formula)

| Quest | Reward | ×1 | ×2 | ×3 |
|-------|--------|-----|-----|-----|
| Lam Esen's Tome (A3) | +5 Stat Points | +5 | +10 | +15 |

### Resistance (affects resistance check)

| Quest | Reward | ×1 | ×2 | ×3 |
|-------|--------|-----|-----|-----|
| Prison of Ice / Anya (A5) | +10 All Res | +10 | +20 | +30 |

### Life (informational)

| Quest | Reward | ×1 | ×2 | ×3 |
|-------|--------|-----|-----|-----|
| The Golden Bird (A3) | +20 Life | +20 | +40 | +60 |

### Skill Points (affects skill direction total)

| Quest | Reward | ×1 | ×2 | ×3 |
|-------|--------|-----|-----|-----|
| Den of Evil (A1) | +1 Skill Point | +1 | +2 | +3 |
| Radament's Lair (A2) | +1 Skill Point | +1 | +2 | +3 |
| Izual (A4) | +2 Skill Points | +2 | +4 | +6 |
| **Total** | **+4 per difficulty** | **+4** | **+8** | **+12** |

## Stat Budget Verification

When recommending items, verify that the character can meet all str/dex requirements at the target level.

### Starting Stats

| Class | Base Str | Base Dex |
|-------|----------|----------|
| Amazon | 20 | 25 |
| Assassin | 20 | 20 |
| Barbarian | 30 | 20 |
| Druid | 15 | 20 |
| Necromancer | 15 | 25 |
| Paladin | 25 | 20 |
| Sorceress | 10 | 25 |
| Warlock | 15 | 20 |

### Stat Budget Formula

- **Budget** = `(level - 1) × 5 + N × 5` stat points total, where N = quest completions (0–3) from Phase 1 Q6. N corresponds to Lam Esen's Tome completions (the only quest granting stat points). See Quest Reward Reference for full details.
- **Ethereal discount**: ethereal items reduce str/dex requirement by 10 each (minimum 0). The `--read` output already accounts for this; for `--search` results (which show base item values), apply the -10 manually when the loadout includes ethereal items. **Calculation order**: apply ethereal -10 on the item's own requirement FIRST, then apply the trust factor discount (Q7) on the item's +str/+dex bonuses — these are independent operations on different values.

### Max Block Dex Cost

If the user chose max block (Phase 1 question 3), the shield's `dexReq` is only the **equip threshold** — reaching 75% block requires significantly more dex.

**Formula**: `maxBlockDex = (75 × characterLevel × 2) ÷ blockRating + 15`

Where `blockRating` = shield's base block% + modifiers (e.g., Paladin's Holy Shield adds a large flat bonus). Without Holy Shield, most builds need 200+ dex at high levels.

**Integration with stat budget**: if max block is chosen, after the greedy algorithm computes the equip dex, compare it with the max block dex. Use `max(equipDex, maxBlockDex)` as the final dex investment. This often pushes the verdict from ✅ OK to ⚠️ TIGHT or ❌ NOT FEASIBLE.

**Practical notes**:
- Paladins with Holy Shield (~Lv20) need far less dex than other classes
- Without Holy Shield, max block on Spirit Monarch (52% block) at Lv80 needs ~246 dex — extremely expensive
- If max block makes the budget NOT FEASIBLE, suggest: higher block% shield, or accept lower block

### Greedy Equipping-Order Algorithm

1. Collect all items' `strReq`/`dexReq` (from `--search` results) and `+str`/`+dex` bonuses (stat ID 0 = strength, stat ID 2 = dexterity — from `--resolve-stats` or `props`). **Runewords**: `--search --quality runeword` does not return `strReq`/`dexReq` (they apply to many bases). Use `--search --quality base -q <base-item-name>` or `--read` the generated file to get actual requirements.
2. Sort items: 0-req items first (rings/amulets/charms — free bonuses), then ascending by `max(strReq, dexReq)`
3. Simulate equipping in order: for each item, invest str/dex points as needed to meet requirements, then add `itemBonus × trustFactor` to current totals (where `trustFactor` = 1.0 / 0.75 / 0.0 from Phase 1 Q7). Track `dexFromItemBonuses` = sum of all `+dex × trustFactor` from equipped items (stat ID 2). **The trust factor discount applies only during this simulation** — the final output table shows actual full bonus values with discounted values in parentheses for transparency.
4. **Self-sufficient mode (trustFactor = 0.0)**: skip the greedy simulation entirely. Instead: `strInvested = max(strReq of all items) - baseStr`, `dexInvested = max(dexReq of all items) - baseDex`. If max block is chosen: `dexInvested = max(max(dexReq of all items), maxBlockDex) - baseDex`.
5. If max block is chosen (and trustFactor > 0): `dexInvested = max(dexInvested, maxBlockDex - baseDex - dexFromItemBonuses)` where `maxBlockDex` is from the Max Block Dex Cost formula
6. `totalInvested = strInvested + dexInvested`; compare against budget `(level - 1) × 5 + N × 5`
7. Remaining = budget - totalInvested → for Vitality (or Energy for ES builds, see Energy Shield Build Detection)

### Verdict Labels

- `totalInvested <= budget * 0.6` → ✅ OK
- `totalInvested <= budget` → ⚠️ TIGHT (>60% into str/dex, little left for vit)
- `totalInvested > budget` → ❌ NOT FEASIBLE

## Auto-Fix for Stat Budget Failures

When the stat budget verdict is ❌ NOT FEASIBLE or ⚠️ TIGHT, the agent must handle as follows:

### ❌ NOT FEASIBLE — Automatic Fix

1. Identify the **most expensive item** by stat investment (the item that caused the largest `strInvested` or `dexInvested` jump in the simulation)
2. Search for alternatives in the same slot with lower `strReq`/`dexReq`:
   - Run `--search --quality unique --type <slot-type> --max-level <lvl>` (reuse cached results from Phase 2)
   - Filter to candidates with `strReq` ≤ current reachable str (before the offending item)
   - Rank by build synergy (Phase 1 criteria)
3. Replace the offending item with the best fitting alternative
4. Re-run the stat budget verification on the updated loadout
5. Repeat up to 3 iterations if still NOT FEASIBLE — each iteration targets the next most expensive item
6. If still NOT FEASIBLE after 3 iterations, present the situation to the user with the remaining gap and ask for guidance (e.g., accept more str investment, switch to lighter base items, or adjust the build)

### ⚠️ TIGHT — User Choice

- Present the TIGHT verdict with the stat allocation summary
- Offer the user a choice: accept (proceed) or auto-fix (attempt to free up stat points)
- Do NOT silently replace items for TIGHT — only for NOT FEASIBLE

## Resistance Coverage Check

After selecting items, verify that the loadout provides adequate resistance for the target difficulty.

### Difficulty Penalties

| Difficulty | Resistance Penalty |
|------------|-------------------|
| Normal | 0 |
| Nightmare | -40 |
| Hell | -100 |

### Verification Algorithm

1. For each element (Fire, Cold, Lightning, Poison), sum all `+res` from the loadout:
   - Item props: look for `res-fire`, `res-cold`, `res-ltng`, `res-pois`, `res-all` in `--search` results or `--resolve-stats` output
   - Stat IDs: 39 (fire), 43 (cold), 41 (lightning), 45 (poison) for flat res; 36-38/40/42/44 for max res
   - Set bonuses and runeword stats contribute too
2. Add quest resistance: `questRes = N × 10` where N = quest completions from Phase 1 Q6 (corresponds to Anya's Prison of Ice scroll, +10 all res per difficulty)
3. Apply the difficulty penalty: `netRes = sumRes + questRes + difficultyPenalty`

### Verdict

- All elements ≥ 40 → ✅ Adequate
- Any element 0–39 → ⚠️ Gaps (list which elements are low)
- Any element < 0 → ❌ Dangerous — recommend resistance-focused item swaps or `socketFill: "resist"`

Include a resistance summary below the stat budget summary:
```
**Resistance** (Hell, -100): Fire +42 | Cold +75 | Ltng +55 | Poison +30 ⚠️
```

## Breakpoint Awareness

FCR, FHR, and IAS use breakpoint tables — accumulating points only matters when you cross a threshold. Being 1 point short of a breakpoint wastes all other FCR/FHR/IAS investment.

### Verification

1. Sum the relevant stat from all items in the loadout:
   - FCR: stat ID 105 (`fcr` in props)
   - FHR: stat ID 99 (`fhr` in props)
   - IAS: stat ID 93 (`ias` in props)
2. Look up the class-specific breakpoint table (these vary by class and sometimes by skill/form — e.g., Werewolf Druid has different FCR breakpoints than human form). If exact breakpoints are unknown, research online for the class + build.
3. Identify the current breakpoint and the next one.
4. If within 5 points of the next breakpoint, flag it: `⚠️ FCR 60/63 — 3 short of next breakpoint (63)`

### When to Swap

If a breakpoint gap is ≤ 5 and an alternative item in any slot provides the missing points without losing critical stats, recommend the swap. Breakpoint gains (especially FCR for casters, IAS for melee) often outweigh raw stat differences.

### Common Breakpoint References

Breakpoint tables vary by class, form, and patch version. **Do not hardcode values from memory** — always verify by searching online (e.g., "D2R <class> FCR breakpoints") or checking community resources. Key notes:
- Sorceress and Paladin have the most FCR-dependent builds
- Assassin Burst of Speed affects IAS breakpoints
- Druid shapeshift forms have separate FCR/FHR tables
- Warlock: verify breakpoints from current patch notes (new class, may change between patches)

## Energy Shield Build Detection

ES (Energy Shield) builds invert the normal stat allocation — Energy becomes the primary dump stat instead of Vitality. This applies to Sorceress and Warlock builds using Energy Shield as a core defense.

### Detection

In Phase 1, if the build direction (Q2) includes keywords like "Energy Shield", "ES", "能量護盾", or the user mentions an ES-focused build (e.g., "ES Nova Sorc", "能量盾電法"):

1. **Flag the build as ES-type**
2. **Ask an additional sub-question**:
   - **All Energy (pure ES)** — maximize mana pool for ES absorption (Recommended for ES builds)
   - **Split Energy/Vitality** — invest some in Vit as safety net (user defines ratio, e.g., 50/50)
   - **Mostly Vitality (hybrid)** — ES as supplementary defense only, Vit remains primary

### Impact on Stat Allocation

- In the Stat Allocation output (Phase 5), the "Remaining points" row targets **Energy** (or the user's chosen split) instead of Vitality
- ES builds also benefit from +Energy and +Mana equipment — factor these into item recommendations in Phase 3-4
- The stat budget calculation itself is unchanged — only the destination of remaining points differs

## Skill Direction Guidance

Alongside the item recommendation (Phase 4), provide a brief skill point direction — not a detailed skill tree, but general guidance based on online research.

### How to Research

Search online for current meta builds using site-scoped queries for reliable sources:
```
"D2R <class> <build-keyword> build guide site:maxroll.gg"
"D2R <class> <build-keyword> build guide site:icy-veins.com"
```

Avoid appending the current year to searches — D2R guides are evergreen and most high-quality content was published 2022-2024. Year-scoping returns fewer results.

### Community Resources

When presenting skill direction, mention where to find detailed guides:
- [Maxroll.gg D2R Guides](https://maxroll.gg/d2/guides) — most comprehensive, regularly updated
- [Icy Veins D2R Builds](https://www.icy-veins.com/d2/) — good alternative with tier lists
- [d2jsp Forums](https://forums.d2jsp.org/) — community discussion and theorycrafting
- [PureDiablo](https://purediablo.com/) — detailed mechanics and build guides

### Output Format

```
### Skill Direction (<Build Name>)
Core: 20 <Skill A>, 20 <Skill B>, 20 <Synergy C>, 20 <Synergy D>
Utility: 1 <Skill E>, 1 <Skill F>, 1 <Skill G>
Source: Based on [<Guide Title>](<url>)
Skill points needed: ~<N> (available at Lv<X> with <Q>× quest completions = +<Q×4> quest skills)
```

### Skill Point Budget

Total skill points available = `(level - 1) + N × 4`, where N = quest completions from Phase 1 Q6. The ×4 comes from Den of Evil (+1) + Radament's Lair (+1) + Izual (+2) per difficulty. See Quest Reward Reference for details.

If no clear meta exists for the build direction, note that and provide only general guidance (e.g., "max your main damage skill and its synergies first").

## Tips

- Consider synergy between items (e.g., +skills for the class, resistance coverage)
- Note when a set bonus requires N pieces — warn if only using partial set
- For class-specific items, verify the item can be equipped by the target class
- Charms are optional — offer to add them for extra stats
- Unique items: Larzuk gives exactly 1 socket to unique items
- Use `statOverrides` when auto-resolved stats need correction (e.g., Hellfire Torch class)
- **Terminology**: when the user uses non-English gaming terms, verify the item mapping before selecting — see `d2r-items` skill "Terminology & Translation" section and `references/zh-tw-terms.md`
- **Data freshness**: the CLI data source may not cover the latest patches — see `d2r-items` skill "Data Source & Limitations" section
- **Skills drive gear** — always determine build direction before selecting items
- **Batch recommend, selective drill-down** — present all slots at once; only expand contested slots interactively
- **Equipment bonuses matter** — items with +str/+dex (e.g., Annihilus, +str rings) reduce total stat investment; always account for the full loadout in the greedy equipping-order algorithm
- **Ethereal discount** — ethereal items need 10 less str/dex; note this in recommendations
- **Caster builds** — typically minimal str (just enough for gear), minimal dex (0 unless max block); default to no max block
- **Melee builds** — more flexible with str/dex, but still verify budget; max block is common for melee + shield
- **Quest bonuses** — now configurable via Phase 1 Q6 (quest completions N = 0–3). Budget formula uses `(level-1)×5 + N×5`; resistance adds `N×10`. Smart defaults based on target difficulty + level
- **Duplicate uniques** — never recommend the same unique item in two slots; use the next-best alternative for the second slot
- **Breakpoint near-miss** — if swapping one item gains a breakpoint, present the trade-off to the user even if raw stats are slightly worse
- **Class restriction check** — verify class-specific items match target class before recommending
- **Socketed item level requirements** — `--read` includes socketed items in `requiredLevel`; use for verification
- **Subagents search, main agent decides** — keep strategy reasoning centralized; fall back to sequential search if subagents are unavailable
- **Restate build direction** — at Phase 4 start, re-anchor the build focus to prevent mid-flow drift
- **Trust factor** — equipment +str/+dex bonuses are discounted during stat budget simulation only (not in final output values). Full trust (100%), conservative (75%, recommended), or self-sufficient (0%). The Equipment column shows actual full bonuses with discounted values in parentheses
- **Self-sufficient + max block** — this combination is not recommended. Max block requires very high Dex investment that makes self-sufficient mode almost always NOT FEASIBLE. The skill warns users at Phase 1 if both are selected
- **Energy Shield builds** — ES builds invert normal allocation: remaining points go to Energy instead of Vitality. Detected via build direction keywords in Phase 1 Q2. See Energy Shield Build Detection section
- **Skill direction** — search-based, not hardcoded. Always verify against current patch. Use site-scoped queries (`site:maxroll.gg`) for reliable results. See Skill Direction Guidance section
- **Unlimited mode** — Editor mode skips budget validation but still outputs "Ideal Stats" for reference. Quest progress and equipment trust settings still apply for resistance and skill calculations

## CLI Reference

All commands use: `npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" <command>`

Key commands for loadout building:

| Command | Purpose |
|---------|---------|
| `--search --class <c> --quality set` | Find class set items |
| `--search --quality unique --type <t>` | Find unique items by slot type; results include `strReq`/`dexReq` |
| `--search --quality unique --type <t> --max-level <n>` | Find unique items by slot type within level range |
| `--search --quality magic-prefix -c <c>` | Find class-specific magic prefixes |
| `--lookup "<name>"` | Get item code and ID |
| `--resolve-stats --quality <q> --id <n>` | Preview auto-resolved stats |
| `--file /tmp/d2r-spec.json` | Generate items (single or batch array) |
| `--read <file.d2i>` | Read a generated `.d2i` file and verify `requiredLevel`, `requiredStr`, `requiredDex` |
