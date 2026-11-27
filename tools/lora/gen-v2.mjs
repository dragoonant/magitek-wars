// Render v2 candidates on distilled FLUX.2 klein 4B through ComfyUI with the v1 LoRA.
// usage: node gen-v2.mjs <lora> <strength> <outdir> <seeds comma list>
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { V2 } from './v2-prompts.mjs';
const [lora, strengthArg, outdir, seedsArg] = process.argv.slice(2);
const strength = Number(strengthArg);
const seeds = seedsArg.split(',').map(Number);
const C = 'http://127.0.0.1:8188';
mkdirSync(outdir, { recursive: true });
function graph(text, w, h, seed) {
  return {
    unet: { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-4b.safetensors', weight_dtype: 'default' } },
    clip: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'flux2', device: 'default' } },
    vae: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
    lora: { class_type: 'LoraLoaderModelOnly', inputs: { model: ['unet', 0], lora_name: lora, strength_model: strength } },
    pos: { class_type: 'CLIPTextEncode', inputs: { text, clip: ['clip', 0] } },
    neg: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['pos', 0] } },
    latent: { class_type: 'EmptyFlux2LatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    sched: { class_type: 'Flux2Scheduler', inputs: { steps: 4, width: w, height: h } },
    sampler: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    noise: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    guider: { class_type: 'CFGGuider', inputs: { model: ['lora', 0], positive: ['pos', 0], negative: ['neg', 0], cfg: 1 } },
    sample: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['noise', 0], guider: ['guider', 0], sampler: ['sampler', 0], sigmas: ['sched', 0], latent_image: ['latent', 0] } },
    decode: { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['vae', 0] } },
    save: { class_type: 'SaveImage', inputs: { images: ['decode', 0], filename_prefix: 'mkw16v2/c' } },
  };
}
let n = 0;
for (const [id, w, h, framing, subject] of V2) {
  for (const seed of seeds) {
    const file = `${outdir}/${id}-s${seed}.png`;
    if (existsSync(file)) continue;
    const text = `mkw16 pixel art, ${framing}, ${subject}.`;
    const r = await fetch(`${C}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: graph(text, w, h, seed) }) });
    const j = await r.json();
    if (!j.prompt_id) throw new Error(JSON.stringify(j).slice(0, 800));
    let hist;
    for (;;) {
      await new Promise((res) => setTimeout(res, 500));
      hist = (await (await fetch(`${C}/history/${j.prompt_id}`)).json())[j.prompt_id];
      if (hist?.status?.completed || hist?.status?.status_str === 'error') break;
    }
    if (hist.status.status_str === 'error') throw new Error(JSON.stringify(hist.status.messages).slice(0, 1200));
    const o = hist.outputs.save.images[0];
    const b = Buffer.from(await (await fetch(`${C}/view?filename=${encodeURIComponent(o.filename)}&subfolder=${encodeURIComponent(o.subfolder)}&type=output`)).arrayBuffer());
    writeFileSync(file, b);
    n++;
  }
  console.log(id, 'done');
}
console.log('rendered', n);
