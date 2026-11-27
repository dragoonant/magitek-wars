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
reference sheet itself is **not** training data and is not attached to generation prompts: its provenance is
unknown and some of its figures are recognisable designs from a published series. Dataset renders are prompted
from the measurements in section 4a and judged against them.

## 3. Dataset
**Allowed sources only:**
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
