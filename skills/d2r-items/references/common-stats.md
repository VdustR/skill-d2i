# Common Stat IDs Reference

Frequently used stat IDs for D2R item generation. Values are game-display values — the CLI handles save-add (sA) encoding automatically.

## Value Format Legend

- `[value]` — single value
- `[min, max]` — np:2, two values written consecutively
- `[min, max, length]` — np:3, three values (e.g., cold/poison damage)
- `[level, skillId]` — sP param + value (param written first)
- `[tabId, classId, value]` — skill tab with encoded param

## Attributes

| ID | Name | Description | Values | Range | Notes |
|----|------|-------------|--------|-------|-------|
| 0 | strength | +X to Strength | `[value]` | -32 to 223 | sB:8, sA:32 |
| 1 | energy | +X to Energy | `[value]` | -32 to 95 | sB:7, sA:32 |
| 2 | dexterity | +X to Dexterity | `[value]` | -32 to 95 | sB:7, sA:32 |
| 3 | vitality | +X to Vitality | `[value]` | -32 to 95 | sB:7, sA:32 |
| 7 | maxhp | +X to Life | `[value]` | -32 to 479 | sB:9, sA:32 |
| 9 | maxmana | +X to Mana | `[value]` | -32 to 223 | sB:8, sA:32 |

## Enhanced Damage / Defense

| ID | Name | Description | Values | Range | Notes |
|----|------|-------------|--------|-------|-------|
| 16 | item_armor_percent | +X% Enhanced Defense | `[value]` | 0-511 | sB:9 |
| 17 | item_maxdamage_percent | +X% Enhanced Damage | `[ed, maxDmgBonus]` | 0-511 each | **np:2** — second value is usually 0 |
| 19 | tohit | +X to Attack Rating | `[value]` | 0-1023 | sB:10 |
| 21 | mindamage | +X Min Damage | `[value]` | 0-63 | sB:6 |
| 22 | maxdamage | +X Max Damage | `[value]` | 0-127 | sB:7 |
| 23 | secondary_mindamage | +X Min Throw Damage | `[value]` | 0-63 | sB:6 |
| 24 | secondary_maxdamage | +X Max Throw Damage | `[value]` | 0-127 | sB:7 |
| 25 | damagepercent | +X% Damage | `[value]` | 0-255 | sB:8 |

## Resistances

| ID | Name | Description | Values | Range | Notes |
|----|------|-------------|--------|-------|-------|
| 39 | fireresist | +X% Fire Resist | `[value]` | -200 to 311 | sB:9, sA:200 |
| 41 | lightresist | +X% Lightning Resist | `[value]` | -200 to 311 | sB:9, sA:200 |
| 43 | coldresist | +X% Cold Resist | `[value]` | -200 to 311 | sB:9, sA:200 |
| 45 | poisonresist | +X% Poison Resist | `[value]` | -200 to 311 | sB:9, sA:200 |

## Elemental Damage

| ID | Name | Description | Values | Notes |
|----|------|-------------|--------|-------|
| 48 | firemindam | +X-Y Fire Damage | `[min, max]` | **np:2** |
| 50 | lightmindam | +X-Y Lightning Damage | `[min, max]` | **np:2** |
| 52 | magicmindam | +X-Y Magic Damage | `[min, max]` | **np:2** |
| 54 | coldmindam | +X-Y Cold Damage | `[min, max, length]` | **np:3** — length in frames (25 frames = 1 sec) |
| 57 | poisonmindam | +X-Y Poison Damage over Z | `[min, max, length]` | **np:3** — length in frames, damage per frame (divide total by length) |

## Leech & Recovery

| ID | Name | Description | Values | Range |
|----|------|-------------|--------|-------|
| 60 | lifedrainmindam | X% Life Stolen Per Hit | `[value]` | 0-127 |
| 62 | manadrainmindam | X% Mana Stolen Per Hit | `[value]` | 0-127 |
| 74 | hpregen | Replenish Life +X | `[value]` | -30 to 33 |
| 27 | manarecoverybonus | +X% Mana Regeneration | `[value]` | 0-255 |
| 138 | item_manaafterkill | +X Mana After Each Kill | `[value]` | 0-127 |

## Speed Modifiers

| ID | Name | Description | Values | Range | Notes |
|----|------|-------------|--------|-------|-------|
| 93 | item_fasterattackrate | +X% IAS | `[value]` | -20 to 107 | sA:20 |
| 96 | item_fastermovevelocity | +X% FRW | `[value]` | -20 to 107 | sA:20 |
| 99 | item_fastergethitrate | +X% FHR | `[value]` | -20 to 107 | sA:20 |
| 105 | item_fastercastrate | +X% FCR | `[value]` | -20 to 107 | sA:20 |

## Skills

| ID | Name | Description | Values | Notes |
|----|------|-------------|--------|-------|
| 127 | item_allskills | +X to All Skills | `[value]` | 0-7, sB:3 |
| 83 | item_addclassskills | +X to Class Skills | `[classId, value]` | sP:3 — classId: 0=Ama,1=Sor,2=Nec,3=Pal,4=Bar,5=Dru,6=Ass |
| 188 | item_addskill_tab | +X to Skill Tab | `[tabId, classId, value]` | sP:16 — encoded param, dF:14 |
| 107 | item_singleskill | +X to Specific Skill | `[skillId, value]` | sP:9 |
| 97 | item_nonclassskill | Level X Skill | `[skillId, value]` | sP:9 |
| 151 | item_aura | Level X Aura When Equipped | `[skillId, value]` | sP:9 |
| 198 | item_skillonhit | X% Chance to Cast Lvl Y on Hit | `[chance, skillId, level]` | sP:16, e:2 |

## Combat

| ID | Name | Description | Values | Range |
|----|------|-------------|--------|-------|
| 115 | item_ignoretargetac | Ignore Target's Defense | `[1]` | 0-1 (flag) |
| 117 | item_preventheal | Prevent Monster Heal | `[value]` | 0-127 |
| 119 | item_tohit_percent | +X% AR (Enhanced) | `[value]` | -20 to 491 |
| 120 | item_damagetargetac | -X% Target Defense | `[value]` | 0-127 |
| 134 | item_freeze | Freezes Target +X | `[value]` | 0-31 |
| 141 | item_deadlystrike | +X% Deadly Strike | `[value]` | 0-127 |
| 150 | item_slow | Slows Target by X% | `[value]` | 0-127 |

## Defense & Durability

| ID | Name | Description | Values | Range | Notes |
|----|------|-------------|--------|-------|-------|
| 31 | armorclass | +X Defense | `[value]` | -10 to 2037 | sB:11, sA:10 |
| 20 | toblock | +X% Increased Chance of Blocking | `[value]` | 0-63 | |
| 75 | item_maxdurability_percent | +X% Durability | `[value]` | -20 to 107 | |
| 72 | durability | +X Durability (current) | `[value]` | 0-511 | |
| 73 | maxdurability | +X Durability (max) | `[value]` | 0-255 | |

## Miscellaneous

| ID | Name | Description | Values | Range |
|----|------|-------------|--------|-------|
| 76 | item_maxhp_percent | +X% to Life | `[value]` | -10 to 53 |
| 77 | item_maxmana_percent | +X% to Mana | `[value]` | -10 to 53 |
| 78 | item_attackertakesdamage | Attacker Takes Damage of X | `[value]` | 0-127 |
| 80 | item_magicbonus | +X% Better Chance of MF | `[value]` | -100 to 155 |
| 85 | item_addexperience | +X% Experience Gained | `[value]` | -50 to 461 |
| 89 | item_lightradius | +X to Light Radius | `[value]` | -4 to 11 |
| 108 | item_restinpeace | Slain Monsters Rest in Peace | `[1]` | 0-1 (flag) |
| 110 | item_poisonlengthresist | +X% Poison Length Reduced | `[value]` | -20 to 235 |
| 114 | item_damagetomana | +X% Damage Taken Goes to Mana | `[value]` | 0-63 |
| 118 | item_halffreezeduration | Half Freeze Duration | `[1]` | 0-1 (flag) |
| 194 | item_numsockets | +X Sockets | `[value]` | 0-15 |

## Per-Level Stats

| ID | Name | Description | Values | Notes |
|----|------|-------------|--------|-------|
| 214 | item_armor_perlevel | +X Defense per Level | `[value]` | value × 0.125 per clvl |

## Mastery Stats

| ID | Name | Description | Values | Range |
|----|------|-------------|--------|-------|
| 329 | passive_fire_mastery | +X% to Fire Skill Damage | `[value]` | -50 to 461 |
| 330 | passive_ltng_mastery | +X% to Lightning Skill Damage | `[value]` | -50 to 461 |
| 331 | passive_cold_mastery | +X% to Cold Skill Damage | `[value]` | -50 to 461 |
| 357 | passive_mag_mastery | +X% to Magic Skill Damage | `[value]` | -50 to 461 |

## Class IDs (for skill stats)

| ID | Class |
|----|-------|
| 0 | Amazon |
| 1 | Sorceress |
| 2 | Necromancer |
| 3 | Paladin |
| 4 | Barbarian |
| 5 | Druid |
| 6 | Assassin |
| 7 | Warlock |
