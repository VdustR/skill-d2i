# game-d2i-skills

Claude Code plugin for generating Diablo II: Resurrected `.d2i` item files from natural language.

## Features

- **Single item** — `/d2i give me a legit Windforce`
- **Condition search** — `/d2i find Amazon-exclusive set items`
- **Full loadout** — `/d2i build a Necromancer loadout level 50-60, prefer sets, fill with uniques`
- Auto-resolves stats and sockets from [blizzhackers/d2data](https://github.com/blizzhackers/d2data) for unique/set items
- Supports both standard D2I format and [D2RuneWizard Hero Editor](https://d2runewizard.com/hero-editor) raw format

## Install

### Via [skills](https://skills.sh/)

```bash
npx -y skills add VdustR/game-d2i-skills -g
```

### Via git clone

```bash
git clone https://github.com/VdustR/game-d2i-skills.git
claude --plugin-dir ./game-d2i-skills
```

## Setup

First-time setup downloads ~2MB of game data from [d2data](https://github.com/blizzhackers/d2data):

```
/d2i setup
```

## Output Formats

| Tool | Format | Description |
|------|--------|-------------|
| [D2RuneWizard Hero Editor](https://d2runewizard.com/hero-editor) | `raw` | Raw item bytes (no container header) |
| Other / General | `d2` | Standard D2I: `JM` header + uint16 count + item bytes |

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

# Generate .d2i from spec
npx tsx src/index.ts --file spec.json
npx tsx src/index.ts --file spec.json --format raw
```

## Project Structure

```
.claude-plugin/plugin.json   Plugin manifest
commands/d2i.md              /d2i slash command
skills/d2r-items/
  SKILL.md                   Core skill (workflows, CLI reference, ItemSpec format)
  references/
    common-stats.md          Frequently used stat IDs and value formats
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

## License

[MIT](LICENSE)
