# Style LoRA plan

Goal (PLAN D3): a small LoRA that pushes Flux toward the house 16-bit look in `docs/ART-STYLE.md`, so new art needs
less cleanup. It teaches a **style**, not characters: subjects come from the prompt.

## 1. Where it runs
- **EVILAEGIS** (RTX 5080, 16 GB VRAM), next to Flux Studio. Announce GPU work first, one GPU job at a time, and stop
  Flux Studio while training (they share the card). Stop the trainer when done (KB rules 10 and 17).
- Nothing trained is committed. Checkpoints (`*.safetensors`) and the working dataset stay in gitignored
  `lora/work/`. Only captions, the source ledger and run notes are committed.

## 2. Base model
**FLUX.2 klein** (Apache-2.0, already in Flux Studio). Owner, 2026-11-26: "Flux.2 KLEIN is fine." Check on the box
that the trainer build supports klein before the first run; if none does, stop and ask rather than switching base.

## 2a. Target look
The character look is ART-STYLE section 4a (the owner's reference sheet, PLAN D11), measured in plain numbers. The
owner's sheets are Gemini generations made by the owner, so they are training data, minus the figures that copy a
published series (ART-STYLE section 8).

## 2b. v1 run (2026-11-26)
- Trainer: ostris ai-toolkit (commit 89680b0), torch 2.13.0+cu130, in a `lora-trainer` folder next to the project
  folders on EVILAEGIS (outside every repo). Config `mkw16_v1.yaml`: FLUX.2-klein-base-4B, LoRA rank 16 / alpha 16,
  AdamW 8-bit, lr 1e-4, 2000 steps, batch 1, buckets 512/768, horizontal flip, fp8 quantized base and text encoder,
  low-VRAM mode, EMA 0.99, save and sample every 250 steps.
- Dataset: each sprite cut from its sheet (`cut.mjs`: nine-column grid, neighbours' slivers painted out), enlarged x2
  with nearest neighbour onto a 512 x 512 navy ground, one caption each starting `mkw16 pixel art, a 16-bit game
  character sprite, standing, three-quarter view, plain navy background, ...`. Three owner sheets (A, B, C; 54
  sprites); three of sheet A's figures are excluded (`lora/SOURCES.csv`), so v1 trains on 51.
- In the repo: `tools/lora/cut.mjs` and `grid.mjs`, the config `lora/mkw16_v1.yaml`, every caption in
  `lora/captions/`, and the source ledger `lora/SOURCES.csv` (sha256 of each sheet). The images stay on EVILAEGIS.
- Results go in `lora/RUNS.md`.

## 3. Dataset
**Allowed sources only:**
0. **The owner's own Gemini generations** (PLAN D3, amended 2026-11-26): sprite sheets of 18 figures on a flat navy
   ground. Figures that copy a published game's designs are cut out first (ART-STYLE section 8). v1 trains on these.
1. **Our own Flux renders**, made on EVILAEGIS for this project, cleaned to the pixel grid (ART-STYLE section 9) and
   approved by the owner on a contact sheet.
2. **CC0 or permissively licensed pixel art** (for example CC0 packs on OpenGameArt or Kenney), each image checked
   at its source page and recorded in `lora/SOURCES.csv`: file, sha256, source URL, author, licence, date checked,
   who checked. Attribution-required licences are allowed only if we can carry the credit in `NOTICE.md`.

**Never:** sprites or screenshots from any published game (including rip sites and fan rips), art by a named living
artist, images found by search with no licence, or prompts naming a game, studio or artist.

**Shape of the set:** 40-80 images, spread across people (battle sprites and portraits), gloamwork machines,
buildings and city skylines, landscapes and skies, items and icons, and interface frames. No single subject over 20%.

**Preparation** (script to be written in `tools/lora/prep.ts`):
1. Downscale each approved render to its logical size (for example 64 x 64 or 128 x 96) with a box filter.
2. Quantize to the house palette, no dithering; hand-fix.
3. Upscale x4 or x8 with nearest neighbour to about 1024 px, so the model sees crisp, uniform pixel blocks.
4. Reject any image whose blocks are not uniform after step 3 (grid check).

## 4. Captions
- Start with the trigger phrase **`mkw16 pixel art`**, then describe the content plainly: subject, pose, setting,
  main colours, framing. Example: `mkw16 pixel art, a soldier in a riveted brass breastplate and long grey coat,
  standing, side view, plain dark background, brass and iron colours`.
- No style adjectives beyond the trigger, no game, studio or artist names, no proper nouns from our world (they invite
  lettering), and none of the owner's banned words (PLAN D7). Figures are described in measurements and materials.
- One `.txt` per image, same base name. Captions are reviewed with the contact sheet.

## 5. Trainer and settings (starting point)
- Trainer: **ostris ai-toolkit** (Flux LoRA, low-VRAM mode for 16 GB) or **kohya-ss sd-scripts** (Flux branch, fp8
  base, block swap). Pick whichever supports the chosen base model on the box; record the version in `lora/RUNS.md`.

| Setting | Value |
|---|---|
| Network | LoRA, rank 16, alpha 16 |
| Optimizer | AdamW 8-bit, learning rate 1e-4, constant with 100 warm-up steps |
| Steps | 2000 at batch 1 (raise to 3000 if samples at 2000 still drift) |
| Resolution | buckets 512 / 768 / 1024 |
| Precision | bf16, gradient checkpointing, base quantized to fp8 if VRAM needs it |
| Caption dropout | 0.05 |
| Save and sample | every 250 steps, six fixed prompts, fixed seeds |

Measure the first run's time per step and peak VRAM and write them into `lora/RUNS.md`.

## 6. How we judge it
For each saved checkpoint, render **12 validation prompts** (6 subjects like the dataset, 6 held-out subjects) at
LoRA strength 0, 0.6, 0.8 and 1.0, fixed seeds. Then:
1. **Grid fidelity:** after downscaling to logical size and back, the share of blocks that stay uniform. Higher is
   better; compare against strength 0.
2. **Palette:** distinct colours before quantizing (fewer is better) and mean distance to the house palette.
3. **Cleanup time:** minutes of hand fixing per image on a sample of 4.
4. **No copying:** each held-out render's perceptual hash against the whole dataset; anything near a training image
   is a fail.
5. **No lettering or logos** in any render.
6. **The owner's eye:** a labelled contact sheet of LoRA vs no LoRA. The owner picks; the pick, the numbers and the
   rejected checkpoints all go into `lora/RUNS.md` (negative results are kept).

## 7. Using it
Flux Studio's `POST /api/jobs` would need a `lora` and `loraStrength` field; check `flux-studio/server.js` on
EVILAEGIS and add it there (in the studio repo, not here) once a checkpoint is picked.
