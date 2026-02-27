---
description: Generate D2R .d2i item files for single-player use
argument-hint: <item description or search query>
allowed-tools: Bash(node:*), Bash(mkdir:*), Bash(cat:*), Bash(echo:*), Bash(curl:*)
---

# /d2i

Generate Diablo II: Resurrected `.d2i` item files from natural language descriptions.

## Skill Routing

| Request type | Skill | Examples |
|-------------|-------|---------|
| Single item / search / magic item | `d2r-items` | "give me a Windforce", "find set helms", "make a 7% MF small charm" |
| Full character loadout / build | `d2r-loadout` | "build a Pitzerker for MF runs", "配裝 Necromancer lv80" |
| Read / inspect / decode d2i file | `d2r-read` | "read this d2i", "what's in this file", "看一下這個 d2i" |

## Usage

```
/d2i <item request>
```

## Examples

```
/d2i give me a legit Windforce
/d2i 幫我做一個暗金頭 最高屬性
/d2i find Amazon-exclusive set items
/d2i make a 7% MF small charm
/d2i search magic prefix for Barbarian skill tabs
/d2i build a Pitzerker for MF runs
/d2i build a Necromancer loadout level 50-60, prefer sets, fill with uniques
/d2i make a 6-socket Phase Blade with Grief runeword
/d2i read ~/Downloads/Enigma.d2i
/d2i what's in this d2i file?
```

## How It Works

This command routes to one of three skills:

1. **d2r-items** — generate individual `.d2i` files, search for items/affixes, create magic items
2. **d2r-loadout** — build a complete character equipment set (uses d2r-items CLI under the hood)
3. **d2r-read** — read/decode `.d2i` files into human-readable JSON for inspection and debugging
