# Super Dario World

A browser-based retro platformer about the AI race, made for fun. It's an
**unofficial, non-commercial fan parody**. It isn't affiliated with or endorsed
by Nintendo, Anthropic, OpenAI, NVIDIA, DeepSeek, Meta, or anyone portrayed.

Dario hasn't slept in 400 days. Help him run, stomp and code his way through
eight worlds, with a pair-programming buddy, a GPU shop that raises its prices
every time you buy something, and a final showdown with **The Hype-Man**.

## Play

There's no build step. Serve the folder and open it in a browser:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It works on phones too: on-screen controls appear automatically (a slide-able
d-pad plus JUMP and ZAP buttons). Portrait puts the controller under the game;
landscape puts it at the sides. On Android there's a fullscreen button.

### Controls

| Action | Keyboard | Gamepad | Phone |
| --- | --- | --- | --- |
| Move | Arrow keys / WASD | D-pad / left stick | D-pad |
| Jump (hold for higher) | Z / Space / K | A / B | JUMP |
| Zap (when powered up) | X / Shift / J | X / Y | ZAP |
| Duck | Down | D-pad down | D-pad down |
| Pause | Enter / P / Esc | Start | II |
| Mute | M | | |

The race, the 3D maze and the puzzle show their own controls before they start.

### The worlds

| # | World | What happens |
| --- | --- | --- |
| 1 | Prompt Plains | The tutorial. Bugs, prompt blocks, and a paperclip farm. |
| 2 | Data Center Depths | A dark server cave. A locked cooling door switches to **Rack Stack**, a falling-block puzzle where you stack GPU blades. |
| $ | GPU Shop | Spend tokens on power-ups. Every purchase raises every price. "The more you buy, the more you save!" |
| 3 | The AI Race | Switches to a **pseudo-3D kart race** against The Whale, The Llama and The Hype-Man's hypercar. Dodge export controls and tariffs. |
| 4 | Nvidious Foundry | Conveyor belts, "429" rate-limit gates, then **The Leather Jacket's keynote**: you can't beat him, only survive until the earnings call ends. |
| 5 | Cloud Cluster | Moving platforms above the clouds. ("Serverless: there are servers.") |
| 6 | The Weekend | Switches to a **first-person 3D maze**. The Hype-Man got fired on Friday. Collect the letter before Monday. |
| 7 | Hype Castle | Lava, spikes, and the Hallucination King. |
| 8 | AGI Summit | The final boss: **The Hype-Man**, who throws "AGI SOON" bubbles and rains $7T money bags. Stomp him when he sits down to record a podcast. |

### Things to know

- **Prompt blocks** (purple `>_`): bonk them from below for tokens and power-ups.
- **Compute Chip**: Dario grows bigger and can take one extra hit.
- **Spark Bolt**: Dario suits up and can zap enemies.
- **Clawd**: a little orange buddy who follows you, zaps nearby enemies, and takes one hit for you.
- **Backup Disk**: extra life. So are 100 tokens.
- **Server blocks** (grey): big Dario can break them.
- **Bugs**: stomp them. **Hoppers** lose their wings first. **Paperclips** slowly make more of themselves.
- **Robots**: stomp one to shut it down, then touch it to kick it into other enemies.
- **Hallucinations** drift toward you. Stomp or zap them.
- **Conveyor belts** carry you along. **429 gates** switch on and off.
- **Checkpoint flags** save your spot mid-level (and power you up).
- Run through the **SHIP IT** gate to finish a level.

Progress (cleared levels, best score) is saved in your browser's local storage.

## Project layout

```
index.html        page, canvas, touch controls
src/core.js       constants, input (keyboard/touch/gamepad), save data
src/audio.js      WebAudio sound effects and music sequencer (all original tunes)
src/art.js        procedural pixel art: tiles, enemies, items, backgrounds
src/levels.js     level layouts (small builder DSL) and overworld map
src/entities.js   player, enemies, Clawd, items, signs, gates, projectiles
src/bosses.js     The Leather Jacket and The Hype-Man
src/world.js      tile collision, camera, level logic, rendering
src/modes/        the special levels: rackstack.js (puzzle), race.js
                  (pseudo-3D kart race), maze.js (first-person raycaster)
src/shop.js       the GPU shop
src/game.js       game states (title, story, map, shop, level, ending), HUD,
                  main loop
assets/           Dario sprite sheets (see Credits)
```

To add or change a level, edit the builder calls in `src/levels.js`. The tile
legend is documented at the top of that file.

Developer shortcuts (URL parameters): `?play=3` or `?play=race` jumps into a
level, `?mini=rackstack` opens the puzzle, `?state=shop|story|ending` opens a
screen, and `?power=2&buddy=1&tokens=50` sets up Dario.

## Keeping it legally safe

This project steers clear of Nintendo's intellectual property:

- **No Nintendo assets.** No ripped sprites, tiles, sounds, music, fonts, or logos.
  Every tile, enemy, item, and background is original procedural pixel art in
  `src/art.js`.
- **No Nintendo characters or names.** There's no Mario, Yoshi, Goomba, Koopa,
  Boo, mushroom, fire flower, "?" block, warp pipe, or goal tape. The game
  uses its own cast and items: bugs, robots, hallucinations, prompt blocks,
  compute chips, spark bolts, backup disks, and a "SHIP IT" gate.
- **No falling-block trade dress.** Rack Stack uses an 8x14 server rack, GPU
  blade art and its own piece names. It doesn't use the classic 10x20 well,
  colours, or name.
- **Parody names for real people and companies.** Inside the game the
  characters are nicknames (The Hype-Man, The Leather Jacket, The Whale, The
  Llama) and the GPU company is "Nvidious". No real logos are used. Clawd is
  an original pixel drawing in the spirit of the Claude Code mascot.
- **Original music.** Every melody in `src/audio.js` was written for this
  project. None of it is transcribed from any game.
- **Original title treatment.** The logo is plain text in the open-source
  *Press Start 2P* font (SIL Open Font License). It doesn't copy Nintendo's logo.
- **Clear disclaimers** on the title screen, in the ending credits, and in this README.
- **Non-commercial.** Don't sell it, don't run ads on it, and don't put it on a
  storefront.

Remaining gray areas:

- **The title.** "Super Dario World" is a parody of a trademarked name.
  Non-commercial parody is generally low risk. If you ever publish this
  widely or want zero risk, rename it (for example *Dario's Token Quest*). The
  title is just two strings in `src/game.js`, plus `index.html`.
- **Real people's likenesses.** Dario and the parody bosses are caricatures of
  real public figures. Keep it good-natured, don't monetize it, and don't
  imply endorsement. Take it down if asked.
- **Sprite license.** See Credits below. The Dario sprite sheets were shared
  without a stated license.

*This isn't legal advice. It's common-sense hygiene for a fun fan project.*

## Credits

- **Dario sprite sheet** (`assets/dario.png`):
  "Dario" pet by community artist *user-6bb09cf5*.
- **Suited Dario sprite sheet** (`assets/dario-suit.png`): "Yelling Dario" pet
  by community artist *alireza7612*.
  Both come from the [OpenPets](https://openpets.dev) catalog (originally shared
  on [Codex Pets](https://codex-pet-share.pages.dev)). They were downscaled
  to half size for this game. No license was stated, so they're used here for personal,
  non-commercial fun only. Ask the artists before redistributing them. To
  swap in a different character, replace these two PNGs with sheets in the
  same layout (8 columns × 9 rows).
- **Font:** [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P)
  by CodeMan38 (SIL Open Font License 1.1), loaded from Google Fonts.
- **Everything else** (code, art, music, level design) is original to this
  project and released under the MIT License (see `LICENSE`).
