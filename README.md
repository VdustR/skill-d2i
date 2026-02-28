# skill-d2i

Claude Code plugin for generating Diablo II: Resurrected `.d2i` item files from natural language.

> Plugin name in `plugin.json` is `game-d2i-skills`.

## Features

- **Single item** — `/d2i give me a legit Windforce`
- **Condition search** — `/d2i find Amazon-exclusive set items`
- **Full loadout** — `/d2i build a Necromancer loadout level 50-60, prefer sets, fill with uniques`
- Auto-resolves stats and sockets from [blizzhackers/d2data](https://github.com/blizzhackers/d2data) for unique/set items
- Supports both standard D2I format and [D2RuneWizard Hero Editor](https://d2runewizard.com/hero-editor) raw format

## Install

```bash
git clone https://github.com/VdustR/skill-d2i.git
claude --plugin-dir ./skill-d2i
```

> **Note:** This plugin requires `--plugin-dir` (not `skills add`) because the skills depend on the bundled CLI via `${CLAUDE_PLUGIN_ROOT}`.

## Setup

First-time setup downloads ~2 MB of game data from [d2data](https://github.com/blizzhackers/d2data). Required before generating items that use auto-resolved stats (unique/set):

```
/d2i setup
```

## Output Formats

| Tool | Format | Description |
|------|--------|-------------|
| [D2RuneWizard Hero Editor](https://d2runewizard.com/hero-editor) | `raw` | Raw item bytes (no container header) |
| Other / General | `d2` | Standard D2I: `JM` header + uint16 count + item bytes |

Select via `--format raw` on the CLI, or `"format": "raw"` in the ItemSpec JSON (spec field takes precedence).

## CLI

The plugin includes a CLI at `cli/` powered by [@dschu012/d2s](https://github.com/dschu012/d2s) (D2R version 99).

```bash
cd cli && npm install
```

```bash
# Download game data
npx tsx src/index.ts --setup

# Fuzzy name lookup (no setup needed)
npx tsx src/index.ts --lookup "windforce"

# Search with filters
npx tsx src/index.ts --search --quality unique --type helm --max-level 60
npx tsx src/index.ts --search --class amazon --quality set

# Preview auto-resolved stats
npx tsx src/index.ts --resolve-stats --quality unique --id 266

# Read / inspect a .d2i file
npx tsx src/index.ts --read examples/cheats/god-charm.d2i

# Generate .d2i from spec
npx tsx src/index.ts --file spec.json
npx tsx src/index.ts --file spec.json --format raw
```

## Project Structure

```
.claude-plugin/plugin.json   Plugin manifest
commands/d2i.md              /d2i slash command
skills/
  d2r-items/                 Single item generation, search, magic items
    SKILL.md                 Workflows, CLI reference, ItemSpec format
    references/
      common-stats.md        Frequently used stat IDs and value formats
  d2r-loadout/               Full character loadout builder
  d2r-read/                  Read / inspect .d2i files
examples/                    Sample .d2i files
cli/
  src/
    index.ts                 CLI entry point
    item-builder.ts          ItemSpec JSON → IItem
    d2i-writer.ts            IItem → .d2i binary
    prop-resolver.ts         d2data properties → d2s stats + sockets
    data-fetcher.ts          d2data download and cache
    search.ts                Local search across cached d2data
    constants-loader.ts      D2R v99 constants initialization
```

## Examples

Pass these as arguments to `/d2i`:

```
/d2i build a Cold Sorc endgame loadout with conviction break
```

```
/d2i build an Assassin loadout based on Natalya's set, fill remaining slots with best-in-slot uniques
```

```
/d2i build a Barbarian MF loadout
```

```
/d2i build an Amazon leveling loadout for level 10-20
```

```
/d2i generate a cheated small charm with all stats at max values
```

## Known Issues

- **D2RuneWizard Hero Editor** displays incorrect "Required Level" for magic items due to affix data indexing bugs in its JavaScript. The generated `.d2i` files are correct — verify with `--read` or in-game:
  ```bash
  npx tsx cli/src/index.ts --read path/to/item.d2i
  ```

## Tested

Last tested: 2026-02-28

| Component | Detail |
|-----------|--------|
| Diablo II: Resurrected | Patch 3.1.1 (Reign of the Warlock) |
| [blizzhackers/d2data](https://github.com/blizzhackers/d2data) | [`a2b3f47`](https://github.com/blizzhackers/d2data/commit/a2b3f47) (2026-02-27) |

## License

[MIT](LICENSE)
