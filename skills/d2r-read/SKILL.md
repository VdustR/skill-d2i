---
name: d2r-read
description: >-
  Read and decode D2R .d2i item files. This skill should be used when the user
  asks to "read d2i", "decode d2i", "inspect item", "parse d2i", "what's in
  this d2i", "看一下這個 d2i", "dump d2i", or wants to examine the contents of
  a .d2i file for debugging or comparison.
---

# D2R Item Reader

Read and decode `.d2i` item files into human-readable JSON. Useful for inspecting items, debugging generation issues, or comparing files.

## Usage

```bash
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --read <file.d2i>
```

Alias: `--decode` works the same as `--read`.

## Format Auto-Detection

The CLI auto-detects the file format:

| Format | Detection | Description |
|--------|-----------|-------------|
| `d2` | First 2 bytes = `JM` (0x4A 0x4D) | Standard D2I container: JM header + uint16 count + item bytes |
| `raw` | Anything else | Bare item bytes (e.g., from D2RuneWizard Hero Editor) — wrapped with synthetic JM+count=1 header for parsing |

## Output Fields

The output is JSON with these fields per item:

| Field | Description |
|-------|-------------|
| `type` | 3-4 char item code (e.g., `xtp` for Mage Plate) |
| `quality` | Numeric quality: 1=low, 2=normal, 3=superior, 4=magic, 5=set, 6=rare, 7=unique, 8=craft |
| `level` | Item level (ilvl) |
| `version` | Binary version string (`"101"` = D2R v99) |
| `identified` | Whether the item is identified |
| `ethereal` | Whether the item is ethereal |
| `socketed` | Whether the item has sockets |
| `runeword` | Whether the item is a runeword |
| `defense` | Base defense rating (armor/shields) |
| `maxDurability` | Maximum durability |
| `currentDurability` | Current durability |
| `totalSockets` | Total socket count |
| `filledSockets` | Number of items in sockets |
| `uniqueId` | Unique item ID (quality=7 only) |
| `setId` | Set item ID (quality=5 only) |
| `runewordId` | Runeword ID (runeword items only) |
| `magicPrefix` | Magic prefix game ID (quality=4 only) |
| `magicPrefixName` | Magic prefix name from d2s constants |
| `magicSuffix` | Magic suffix game ID (quality=4 only) |
| `magicSuffixName` | Magic suffix name from d2s constants |
| `requiredLevel` | Calculated required level from d2data (requires `--setup`) |
| `magicAttributes[]` | Item stats: `{id, name, values}` |
| `runewordAttributes[]` | Runeword bonus stats (runeword items only) |
| `socketedItems[]` | Socketed items: `{type, simple, quality, attributes[]}` |

## Interpreting Runeword Items

Runeword items have three stat layers:
1. **magicAttributes** — base item stats (usually empty for runewords)
2. **runewordAttributes** — the runeword's bonus stats
3. **socketedItems[].attributes** — individual rune stats (only for non-simple runes)

## Error Handling

On parse failure, the output includes `{ success: false, error: "..." }` with the error message. Common causes:
- Older D2 format (pre-D2R) — only D2R v99 format (`"101"`) is supported
- Corrupted or truncated file
- Wrong file type (not a .d2i)

## Examples

```bash
# Read a generated d2i file
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --read /tmp/d2r-items/xtp-1234567890.d2i

# Decode a downloaded d2i
npx --prefix "${CLAUDE_PLUGIN_ROOT}/cli" tsx "${CLAUDE_PLUGIN_ROOT}/cli/src/index.ts" --decode ~/Downloads/Enigma.d2i
```

## Limitations

- Only supports D2R v99 format (version string `"101"`); older D2 Classic or LoD formats may fail
- Stat names come from `@dschu012/d2s` constants data — some may show empty names if not mapped
- Does not resolve human-readable item or unique names (outputs codes and IDs)
- `requiredLevel` is calculated from d2data (`--setup` required); without d2data cache, the field is omitted
- `requiredLevel` matches the actual in-game required level; D2RuneWizard Hero Editor displays incorrect values for magic items
