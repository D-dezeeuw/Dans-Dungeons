# Dan's Dungeons — Player Manual

A text-based D&D adventure powered by AI. You bring the API key, the game brings the dungeon.

---

## Getting started

1. Open the game in your browser (GitHub Pages or `npm run serve` locally)
2. Paste your **OpenRouter API key** when prompted (free tier works)
3. Create your character: pick a name, class, species, and background
4. Choose whether to enable **scene sketches** and **voice narration**
5. Enter the dungeon

## How to play

Type natural language actions in the input field at the bottom:

- `I go north` — move through an exit
- `I attack the goblin with my longsword` — combat
- `I use Stealth` — skill check
- `I take the brass key` — pick up items
- `I use the key to unlock the door` — unlock locked exits
- `I look around carefully` — investigate
- `I try to talk` — attempt diplomacy

You can also **click the action chips** that appear above the input — they fill in the action for you.

### Slash commands

| Command | Effect |
|---------|--------|
| `/save` | Save game to browser storage |
| `/status` | Show current HP and AC |
| `/settings` | Re-enter API key setup |
| `/restart` | Start a new game |
| `/help` | List available commands |

## The dungeon

Each game generates a unique procedural dungeon with **7-12 rooms**:

- A **main path** (spine) of 4-6 rooms from entrance to vault
- **Branch rooms** with side content (loot, enemies, the key)
- A **locked gate** somewhere on the main path — find the key in a branch room to proceed
- **1-3 enemies** scattered throughout (goblins, skeletons, cultists, rats, corpses, spiders)
- A **treasure** in the final vault — reach it to win

Room types include entrance halls, great halls, corridors, chambers, storage rooms, quarters, shrines, and vaults — each with multiple description variants.

## The action bar

When enabled (toggle in settings), the action bar shows three zones:

- **Compass** — cardinal direction buttons for movement (locked exits shown)
- **Class** — your weapon attacks and class abilities (Second Wind, Sneak Attack, etc.)
- **Skills** — all 18 D&D skills with cooldown timers (3-turn cooldown after use)

Hover over any item for a tooltip with details.

## Character classes

Four starter classes, each with unique abilities:

| Class | Abilities |
|-------|-----------|
| **Fighter** | Second Wind (heal), Action Surge (extra action) |
| **Rogue** | Sneak Attack (bonus damage), Cunning Action (Dash/Disengage/Hide) |
| **Cleric** | Turn Undead (fear undead), Cast Spell |
| **Wizard** | Arcane Recovery (regain spell slots), Cast Spell |

## Voice features

### Text-to-Speech (TTS)
Toggle the volume icon in the transcript to have the GM narrate aloud. Click the speaker icon that appears on hover over any GM entry to re-read it.

### Speech-to-Text (STT)
Click the mic button (or press **Spacebar** when not typing) to record your action by voice.

### Roleplay mode
Click the drama mask icon in the chrome bar for an immersive view — forces TTS on and shows a sand-timer overlay while the GM narrates.

## Autoplay

Click the **recycle arrow icon** next to the mic button to toggle autoplay. When active:

- The AI plays for you — choosing actions based on the scene
- Input is disabled (greyed out)
- Actions appear in the transcript as if you typed them
- Toggle off at any time to resume manual play

The autoplay agent is curious, fights with flair using class abilities, picks up items, and never backtracks.

## Scene sketches

When enabled, the game generates an AI sketch after each turn — a sepia ink-on-parchment style illustration shown as the transcript background. Controls in settings:

- **Minimize** — hide the sketch
- **Windowed** — show at reduced opacity behind text
- **Maximize** — show at full opacity

## Exporting your adventure

The settings sidebar offers four export options:

### Journal (EPUB)
Sends your adventure narrations to an AI storyteller that weaves them into a coherent D&D tale with chapters. Produces an EPUB ebook with:
- Canvas-rendered cover page: "Dan's Dungeons: {adventure title}"
- Styled chapters with scene illustrations
- Table of contents

The story is cached — re-exporting only processes new turns. If the AI fails, falls back to a raw HTML journal.

Progress is shown step-by-step in the transcript:
1. Gathering narrations
2. Sending to storyteller
3. Weaving chapters
4. Building EPUB
5. Download started

### Screenshot
Saves the current scene sketch as a PNG image.

### All Sketches
Downloads all session sketches as an HTML gallery.

### Import
Load a previously exported `.dnd.json` save file.

## Language

The game supports **English** and **Dutch** (Nederlands). Switch via the **EN – NL** toggle in the settings sidebar. The active language is highlighted. Switching reloads the page.

When set to Dutch:
- All UI text, prompts, and action chips are in Dutch
- The AI narrator writes in Dutch
- The classifier understands Dutch player input
- STT passes the Dutch language code for better recognition
- TTS auto-detects Dutch from the narration text

## Settings summary

| Setting | Where | What |
|---------|-------|------|
| Language | Sidebar: EN – NL | Switch between English and Dutch |
| Scene sketch | Sidebar toggle | Generate AI sketches after each turn |
| Sketch view | Sidebar: min/win/max | Control sketch visibility |
| Action bar | Sidebar toggle | Show/hide the footer action bar |
| TTS | Volume icon in transcript | Read narrations aloud |
| Roleplay | Drama mask in chrome | Immersive mode with forced TTS |
| Autoplay | Recycle arrow next to mic | Let AI play automatically |
| STT | Mic button / Spacebar | Voice input for actions |

## How the AI works

The game uses multiple AI calls per turn, each mapped to a **model tier**:

| Step | Tier | What it does |
|------|------|-------------|
| Classify | tiny | Maps your input to a structured intent (attack, move, skill, etc.) |
| Narrate | medium | Writes the GM narration based on resolved mechanics |
| Autoplay | tiny | Picks the next action when autoplay is on |
| Journal | medium | Weaves narrations into a coherent story for export |
| Scene image | image | Generates the ink-on-parchment sketch |
| TTS | tts | Converts narration text to speech |
| STT | stt | Converts your voice recording to text |

All AI calls go to your configured OpenRouter endpoint using your API key. The cost meter in the chrome bar tracks estimated spend.

## Saving and loading

- The game **autosaves** to `localStorage` after every turn
- Use `/save` to force a save
- Use the **Import** button to load a `.dnd.json` save file
- Refreshing the page resumes from the last autosave

## Technical notes

- Runs 100% in the browser — no server, no accounts
- Works offline after first load (service worker caches the shell)
- The service worker auto-updates: on each page load it checks `vendor/app.version` and purges the cache if a new version is deployed
- No npm dependencies are installed at runtime — libraries are vendored or loaded from CDN
- Icons are Lucide SVGs (MIT license), vendored in `vendor/icons/`
