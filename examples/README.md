# Example .d2i Files

Pre-built `.d2i` item files for testing and single-player use. Import via [D2RuneWizard Hero Editor](https://d2runewizard.com/hero-editor) (raw format) or read with the CLI:

```bash
npx tsx cli/src/index.ts --read examples/cheats/god-charm.d2i
```

## cheats/

Items with stats beyond game-possible ranges (**IMPOSSIBLE** class). Useful for testing or messing around in single-player.

### god-charm.d2i

A magic Small Charm with every stat pushed to its bit-field maximum.

| Stat | Value | Notes |
|------|-------|-------|
| All Skills | +7 | sB=3, max 7 |
| Strength | +223 | sB=8 + sA=32 |
| Dexterity | +95 | sB=7 + sA=32 |
| Vitality | +95 | sB=7 + sA=32 |
| Energy | +95 | sB=7 + sA=32 |
| Life | +479 | sB=9 + sA=32 |
| Mana | +223 | sB=8 + sA=32 |
| Fire/Light/Cold/Poison Resist | +311% each | sB=9 + sA=40 |
| Magic Find | +155% | sB=8 + sA=28 |
| Experience | +461% | sB=9 + sA=50 |
| IAS / FRW / FHR / FCR | +107% each | sB=7 + sA=20 |
| Enhanced Damage | +511% | sB=9 |
| Attack Rating | +1023 | sB=10 |
| Deadly Strike | 127% | sB=7 |
| Ignore Target Defense | Yes | — |
| Life Leech | 127% | sB=7 + sA=0 |
| Mana Leech | 127% | sB=7 + sA=0 |
| Defense | +2037 | sB=11 + sA=10 |
| Half Freeze Duration | Yes | — |
| Freezes Target | +31 | sB=5 + sA=0 |

**Format**: raw (for D2RuneWizard Hero Editor import)
