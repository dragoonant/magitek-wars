// Render validation prompts on distilled FLUX.2 klein 4B through ComfyUI, with a LoRA at several strengths.
// usage: node test-lora.mjs <lora file in ComfyUI/models/loras or "none"> <outdir> <strengths comma list> [seed]
import { mkdirSync, writeFileSync } from 'node:fs';
const [lora, outdir, strengthsArg, seedArg] = process.argv.slice(2);
const strengths = strengthsArg.split(',').map(Number);
const seed = Number(seedArg ?? 1234);
const C = 'http://127.0.0.1:8188';
mkdirSync(outdir, { recursive: true });
const T = 'mkw16 pixel art, a 16-bit game character sprite, standing, three-quarter view, plain navy background, ';
export const PROMPTS = [
  // like the dataset
  'a soldier in red-lacquered iron plate armour with a brass helmet, holding a long rifle.',
  'a young woman courier in a brown leather coat with brass goggles on her forehead, holding a large wrench.',
  'a sky-ship captain in a long blue coat and a black tricorn hat, holding a brass spyglass.',
  'a veiled fire priest in grey and white robes, holding a lantern of flame.',
  'a smuggler in a black hooded coat, holding a green glowing lantern.',
  'a stern grey-haired officer in a long red greatcoat with brass epaulettes, holding a sabre.',
  // held out: subjects far from the dataset
  'a tall bark-skinned marsh dweller with moss on the shoulders, holding a staff tipped with a teal glass shard.',
  'a walking steam boiler machine on two jointed iron legs with an enclosed cab and a round teal porthole.',
  'a railway engineer in oil-stained blue overalls and a peaked cap, holding a coal shovel.',
  'a merchant in a striped waistcoat and top hat, holding a ledger and a brass coin purse.',
  'a gloam caster with glowing teal veins in a dark military coat, frost forming on her gloves.',
  'a small brass clockwork owl perched on a lamp post.',
];
function graph(prompt, strength, i) {
  const g = {
    unet: { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-4b.safetensors', weight_dtype: 'default' } },
    clip: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'flux2', device: 'default' } },
    vae: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
    pos: { class_type: 'CLIPTextEncode', inputs: { text: T + prompt, clip: ['clip', 0] } },
    neg: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['pos', 0] } },
    latent: { class_type: 'EmptyFlux2LatentImage', inputs: { width: 768, height: 768, batch_size: 1 } },
    sched: { class_type: 'Flux2Scheduler', inputs: { steps: 4, width: 768, height: 768 } },
    sampler: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    noise: { class_type: 'RandomNoise', inputs: { noise_seed: seed + i } },
  };
  let model = ['unet', 0];
  if (lora !== 'none' && strength > 0) {
    g.lora = { class_type: 'LoraLoaderModelOnly', inputs: { model, lora_name: lora, strength_model: strength } };
    model = ['lora', 0];
  }
  g.guider = { class_type: 'CFGGuider', inputs: { model, positive: ['pos', 0], negative: ['neg', 0], cfg: 1 } };
  g.sample = { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['noise', 0], guider: ['guider', 0], sampler: ['sampler', 0], sigmas: ['sched', 0], latent_image: ['latent', 0] } };
  g.decode = { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['vae', 0] } };
  g.save = { class_type: 'SaveImage', inputs: { images: ['decode', 0], filename_prefix: 'mkw16test/t' } };
  return g;
}
for (const s of strengths) {
  for (const [i, p] of PROMPTS.entries()) {
    const r = await fetch(`${C}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: graph(p, s, i) }) });
    const j = await r.json();
    if (!j.prompt_id) throw new Error(JSON.stringify(j).slice(0, 800));
    let h;
    for (;;) {
      await new Promise((res) => setTimeout(res, 700));
      h = (await (await fetch(`${C}/history/${j.prompt_id}`)).json())[j.prompt_id];
      if (h?.status?.completed || h?.status?.status_str === 'error') break;
    }
    if (h.status.status_str === 'error') throw new Error(JSON.stringify(h.status.messages).slice(0, 1200));
    const o = h.outputs.save.images[0];
    const b = Buffer.from(await (await fetch(`${C}/view?filename=${encodeURIComponent(o.filename)}&subfolder=${encodeURIComponent(o.subfolder)}&type=output`)).arrayBuffer());
    writeFileSync(`${outdir}/s${String(s).replace('.', '')}-${String(i + 1).padStart(2, '0')}.png`, b);
  }
  console.log('strength', s, 'done');
}
