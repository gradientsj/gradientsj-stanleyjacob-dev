"""Generate hero seascape candidates on the local H100 with SDXL.

Uses the open Stable Diffusion XL base model. Writes a few seeds so the best
composition can be chosen. Wide banner aspect (a native SDXL bucket), ship
biased to the right third, open aurora sky on the left for the intro text.

    python tools/gen_hero.py
"""

import os
import torch
from diffusers import StableDiffusionXLPipeline

OUT = "/tmp/claude-1000/-home-ubuntu/3db8de0c-3c7e-44d9-b10d-fd6ccff81021/scratchpad/ship"
os.makedirs(OUT, exist_ok=True)

PROMPT = (
    "Cinematic wide photograph of an ancient Greek trireme warship sailing "
    "across a dark open ocean at night. A hoplite warrior in a bronze crested "
    "Corinthian helmet with a round shield stands at the stern steering oar. "
    "Above, a vivid aurora borealis glows across the sky in ribbons of violet, "
    "deep blue and warm orange, reflecting on the water. Realistic rolling "
    "ocean waves with foam and moonlit highlights. The ship sits in the right "
    "third of the frame; the left side is open sea and glowing aurora sky with "
    "space for text. Moody, atmospheric, highly detailed, epic, film still, "
    "35mm, cinematic color grade."
)
NEGATIVE = (
    "cartoon, illustration, drawing, sketch, anime, low quality, blurry, "
    "deformed, distorted, extra masts, duplicated ship, two ships, text, "
    "watermark, signature, oversaturated, harsh neon, disco lighting, "
    "modern boat, sails torn, jpeg artifacts"
)

pipe = StableDiffusionXLPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    torch_dtype=torch.float16,
    variant="fp16",
    use_safetensors=True,
)
pipe = pipe.to("cuda")

for seed in [7, 23, 42, 101]:
    g = torch.Generator("cuda").manual_seed(seed)
    img = pipe(
        prompt=PROMPT,
        negative_prompt=NEGATIVE,
        num_inference_steps=40,
        guidance_scale=6.5,
        height=768,
        width=1344,
        generator=g,
    ).images[0]
    path = os.path.join(OUT, f"cand_{seed}.png")
    img.save(path)
    print("wrote", path, flush=True)

print("DONE", flush=True)
