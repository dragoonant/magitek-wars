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
- **Owner's verdict:** pending (contact sheet sent 2026-11-26).
