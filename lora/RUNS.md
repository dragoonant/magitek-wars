# LoRA runs

Every run is kept here, including the ones that are not used.

## v1, `mkw16_v1` (2026-11-26)
- **Data:** 51 sprites cut from the owner's three Gemini sheets (`SOURCES.csv`; three figures of sheet A excluded),
  x2 nearest neighbour on a 512 x 512 navy ground, horizontal flip (102 latents). Captions in `captions/`.
- **Settings:** `mkw16_v1.yaml`: FLUX.2-klein-base-4B, ai-toolkit 89680b0, rank 16 / alpha 16, AdamW 8-bit, lr 1e-4,
  2000 steps, batch 1, buckets 512/768, fp8 base and text encoder, low-VRAM, EMA 0.99.
- **Cost on EVILAEGIS (RTX 5080 16 GB):** about 1 s per step; 2000 steps in 32 minutes plus about 3 minutes of
  sampling per 250 steps. Model download about 16 GB (transformer 7.75 GB, Qwen3-4B 8.1 GB).
- **Training samples (klein Base, 28 steps):** the look moves toward the sheets by step 250; by 1500 the outlines,
  saturation and proportions match them.
- **Test on the distilled klein used by Flux Studio** (`tools/lora/test-lora.mjs`, 4 steps, cfg 1, 768 x 768, seeds
  1234-1245, ComfyUI `LoraLoaderModelOnly`): the LoRA trained on Base loads and works on the distilled model. At 1.0,
  all 12 prompts render as 16-bit sprites in the sheets' style, including the six held-out subjects (railway engineer,
  merchant, caster, marsh dweller, steam machine, owl). `runs/v1-compare.webp`: top two rows strength 0, bottom two
  rows strength 1.0.
- **Faults seen:** it leans toward people. The "brass clockwork owl on a lamp post" prompt came back as a man holding
  a lamp post with an owl on it, and the courier grew a second wrench. Every training image is a standing person on
  navy, so scenes, props and creatures will need their own data in v2.
- **Owner's verdict:** "Train v2" (v1 leans toward people).

## v2, `mkw16_v2` (2026-11-26)
- **Data:** v1's 51 owner sprites, repeated twice, plus 121 of our own renders of scenes, buildings, machines,
  creatures, items and people in motion: 64 prompts, three seeds each, on the distilled klein with v1 at 0.9, picked
  on labelled contact sheets and snapped to a 3 px grid with 64 colours (`docs/LORA.md` section 2c, `picks-v2.txt`,
  `captions-v2/`, `SOURCES.csv`). Horizontal flip. People are still the largest group (66 of 172 images, 38%).
- **Settings:** `mkw16_v2.yaml`: v1's settings, 3000 steps, save and sample every 500.
- **Cost on EVILAEGIS:** 192 candidate renders in about 15 minutes; training 3000 steps in 50 minutes plus sampling.
- **Training samples (klein Base, step 500):** already right on all six, including the owl on the lamp post, a wide
  frozen-lake scene, a running courier and a compass icon.
- **Test on the distilled klein** (`tools/lora/test-v2.mjs`, strength 1.0, seeds 1234-1251): v1's 12 prompts plus six
  held-out subjects that are not people (two wide scenes, compass, helmet, steam crab, paddle boat).
  `runs/v2-compare.webp`: rows alternate v1 and v2.
  - **Better:** the clockwork owl now sits on the lamp post (v1 drew a man holding it); the steam boiler machine is
    a boiler on legs rather than a cab; the helmet and boat read more cleanly.
  - **Same:** people are as good as v1. The wide scenes and items were already good with v1 on the distilled model
    once the caption named the kind of image, so v2 adds little there.
  - **Still wrong:** the courier still gets two wrenches and the fire priest a lantern plus a loose flame (props are
    doubled when a hand is free); the paddle boat has no paddle wheel; the compass rim carries letter-like marks.
  - **Pixels:** no crisper than v1 under magnification; the 3 px snapping of the training data did not carry
    through. A true grid still needs the cleanup step (`clean.mjs`) after rendering.
- **Owner's verdict:** pending (comparison sheet sent 2026-11-26).
