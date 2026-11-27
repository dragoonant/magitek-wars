// Compare LoRAs on distilled FLUX.2 klein 4B through ComfyUI: v1's 12 validation prompts plus 6 held-out subjects
// that are not people (2 scenes, 2 items, a creature, a machine). Fixed seeds.
// usage: node test-v2.mjs <outdir> <strength> <lora file or none>...
import { mkdirSync, writeFileSync } from 'node:fs';
const [outdir, strengthArg, ...loras] = process.argv.slice(2);
const strength = Number(strengthArg);
const C = 'http://127.0.0.1:8188';
mkdirSync(outdir, { recursive: true });
const CH = 'a 16-bit game character sprite, standing, three-quarter view, plain navy background';
const SC = 'a 16-bit game background scene, wide view, no characters';
const IT = 'a 16-bit game item icon, centred, plain navy background';
const CR = 'a 16-bit game creature sprite, three-quarter view, plain navy background';
const MC = 'a 16-bit game machine sprite, three-quarter view, plain navy background';
export const TESTS = [
  [CH, 'a soldier in red-lacquered iron plate armour with a brass helmet, holding a long rifle'],
  [CH, 'a young woman courier in a brown leather coat with brass goggles on her forehead, holding a large wrench'],
  [CH, 'a sky-ship captain in a long blue coat and a black tricorn hat, holding a brass spyglass'],
  [CH, 'a veiled fire priest in grey and white robes, holding a lantern of flame'],
  [CH, 'a smuggler in a black hooded coat, holding a green glowing lantern'],
  [CH, 'a stern grey-haired officer in a long red greatcoat with brass epaulettes, holding a sabre'],
  [CH, 'a tall bark-skinned marsh dweller with moss on the shoulders, holding a staff tipped with a teal glass shard'],
  [CH, 'a walking steam boiler machine on two jointed iron legs with an enclosed cab and a round teal porthole'],
  [CH, 'a railway engineer in oil-stained blue overalls and a peaked cap, holding a coal shovel'],
  [CH, 'a merchant in a striped waistcoat and top hat, holding a ledger and a brass coin purse'],
  [CH, 'a gloam caster with glowing teal veins in a dark military coat, frost forming on her gloves'],
  [CH, 'a small brass clockwork owl perched on a lamp post'],
  [SC, 'a frozen lake below a ruined iron tower at dusk, purple sky', 1024, 576],
  [SC, 'a canyon village of rope bridges and wooden huts lit by lanterns at night', 1024, 576],
  [IT, 'a brass compass with a glowing teal needle'],
  [IT, 'a steel helmet with a brass crest'],
  [CR, 'a giant brass crab with steam pipes on its back'],
  [MC, 'a steam-powered paddle boat on a river'],
];
function graph(text, w, h, seed, lora) {
  const g = {
    unet: { class_type: 'UNETLoader', inputs: { unet_name: 'flux-2-klein-4b.safetensors', weight_dtype: 'default' } },
    clip: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen_3_4b.safetensors', type: 'flux2', device: 'default' } },
    vae: { class_type: 'VAELoader', inputs: { vae_name: 'flux2-vae.safetensors' } },
    pos: { class_type: 'CLIPTextEncode', inputs: { text, clip: ['clip', 0] } },
    neg: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['pos', 0] } },
    latent: { class_type: 'EmptyFlux2LatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    sched: { class_type: 'Flux2Scheduler', inputs: { steps: 4, width: w, height: h } },
    sampler: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
    noise: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
  };
  let model = ['unet', 0];
  if (lora !== 'none') { g.lora = { class_type: 'LoraLoaderModelOnly', inputs: { model, lora_name: lora, strength_model: strength } }; model = ['lora', 0]; }
  g.guider = { class_type: 'CFGGuider', inputs: { model, positive: ['pos', 0], negative: ['neg', 0], cfg: 1 } };
  g.sample = { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['noise', 0], guider: ['guider', 0], sampler: ['sampler', 0], sigmas: ['sched', 0], latent_image: ['latent', 0] } };
  g.decode = { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['vae', 0] } };
  g.save = { class_type: 'SaveImage', inputs: { images: ['decode', 0], filename_prefix: 'mkw16test/v' } };
  return g;
}
for (const lora of loras) {
  const tag = lora === 'none' ? 'none' : lora.replace(/\.safetensors$/, '');
  for (const [i, [framing, subject, w = 768, h = 768]] of TESTS.entries()) {
    const text = `mkw16 pixel art, ${framing}, ${subject}.`;
    const r = await fetch(`${C}/prompt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prompt: graph(text, w, h, 1234 + i, lora) }) });
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
    writeFileSync(`${outdir}/${tag}-${String(i + 1).padStart(2, '0')}.png`, b);
  }
  console.log(tag, 'done');
}
