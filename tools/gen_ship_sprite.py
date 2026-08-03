"""Generate an isolated side-profile trireme sprite on the H100 (SDXL).

Produces a ship on a flat background so it can be cut out to a transparent PNG
and floated over the animated p5.js ocean in the hero. Side profile keeps the
2D compositing believable.

    python tools/gen_ship_sprite.py
"""

import os
import torch
from diffusers import StableDiffusionXLPipeline

OUT = "/tmp/claude-1000/-home-ubuntu/3db8de0c-3c7e-44d9-b10d-fd6ccff81021/scratchpad/sprite"
os.makedirs(OUT, exist_ok=True)

PROMPT = (
    "side profile view of a single ancient Greek trireme warship, large square "
    "sail raised, three rows of oars, a bronze ram at the bow, an ornate curved "
    "stern, a painted eye on the hull, weathered wood and bronze, dramatic warm "
    "rim lighting, isolated on a flat plain light grey studio background, the "
    "whole ship centered and fully in frame, highly detailed, realistic, "
    "concept art product shot"
)
NEGATIVE = (
    "water, ocean, sea, waves, foam, sky, clouds, horizon, landscape, "
    "background scenery, two ships, multiple boats, cropped, cut off, text, "
    "watermark, frame, border, blurry, low quality, deformed"
)

pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
).to("cuda")

for seed in [3, 11, 19, 27, 55, 88]:
    g = torch.Generator("cuda").manual_seed(seed)
    img = pipe(
        prompt=PROMPT,
        negative_prompt=NEGATIVE,
        num_inference_steps=44,
        guidance_scale=7.0,
        height=832,
        width=1216,
        generator=g,
    ).images[0]
    path = os.path.join(OUT, f"ship_{seed}.png")
    img.save(path)
    print("wrote", path, flush=True)

print("DONE", flush=True)
