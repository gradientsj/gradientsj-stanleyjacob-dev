"""Measured H100 numbers for the coursework articles.

Everything the systems/parallel-computing pages quote as a measurement comes
from this script, so the numbers on the site are reproducible rather than
remembered. Run from the repo root:

    python classes/data/bench_h100.py > classes/data/h100.json

Covers: HBM bandwidth from a streaming kernel, matmul throughput at fp32 /
tf32 / bf16 / fp16, attention (naive materialized scores vs the fused
FlashAttention path) across sequence lengths, an end-to-end multi-head
attention block, reduction throughput, and occupancy-relevant device limits.
"""

import json
import sys
import time

import torch

DEV = "cuda"


def sync():
    torch.cuda.synchronize()


def timed(fn, warmup=10, iters=50):
    """Median wall time in seconds over `iters` runs, after warmup."""
    for _ in range(warmup):
        fn()
    sync()
    ts = []
    for _ in range(iters):
        t0 = time.perf_counter()
        fn()
        sync()
        ts.append(time.perf_counter() - t0)
    ts.sort()
    return ts[len(ts) // 2]


def device_info():
    p = torch.cuda.get_device_properties(0)
    return {
        "name": p.name,
        "sm_count": p.multi_processor_count,
        "total_mem_gb": round(p.total_memory / 1e9, 1),
        "compute_capability": f"{p.major}.{p.minor}",
        "max_threads_per_sm": getattr(p, "max_threads_per_multi_processor", None),
        "shared_mem_per_block_kb": round(getattr(p, "shared_memory_per_block", 0) / 1024, 1),
        "regs_per_sm": getattr(p, "regs_per_multiprocessor", None),
        "torch": torch.__version__,
        "cuda": torch.version.cuda,
    }


def bandwidth():
    """Streaming kernels: bytes moved / time. Pure HBM-bound, no reuse."""
    out = {}
    n = 1 << 28  # 268M elements = 1.07 GB per fp32 buffer
    for dtype, name in [(torch.float32, "fp32"), (torch.bfloat16, "bf16")]:
        a = torch.randn(n, device=DEV, dtype=dtype)
        b = torch.randn(n, device=DEV, dtype=dtype)
        itemsize = a.element_size()
        # copy: 1 read + 1 write
        t = timed(lambda: a.copy_(b))
        out[f"copy_{name}_gbs"] = round(2 * n * itemsize / t / 1e9, 1)
        # add: 2 reads + 1 write
        c = torch.empty_like(a)
        t = timed(lambda: torch.add(a, b, out=c))
        out[f"add_{name}_gbs"] = round(3 * n * itemsize / t / 1e9, 1)
        # sum reduction: 1 read
        t = timed(lambda: a.sum())
        out[f"sum_{name}_gbs"] = round(n * itemsize / t / 1e9, 1)
        del a, b, c
        torch.cuda.empty_cache()
    return out


def matmul():
    """2*M*N*K FLOPs / time, across precisions and sizes."""
    out = {}
    for n in [1024, 2048, 4096, 8192]:
        for dtype, name, tf32 in [
            (torch.float32, "fp32", False),
            (torch.float32, "tf32", True),
            (torch.bfloat16, "bf16", False),
            (torch.float16, "fp16", False),
        ]:
            torch.backends.cuda.matmul.allow_tf32 = tf32
            torch.backends.cudnn.allow_tf32 = tf32
            a = torch.randn(n, n, device=DEV, dtype=dtype)
            b = torch.randn(n, n, device=DEV, dtype=dtype)
            t = timed(lambda: a @ b, warmup=5, iters=20)
            out[f"n{n}_{name}_tflops"] = round(2 * n**3 / t / 1e12, 1)
            del a, b
            torch.cuda.empty_cache()
    torch.backends.cuda.matmul.allow_tf32 = False
    return out


def attention():
    """Naive (materialize the S x S score matrix) vs fused SDPA.

    The naive path is exactly the math on the attention page; the fused path
    computes the same function with tiled online softmax and never writes the
    score matrix to HBM. The interesting columns are the memory ratio and the
    sequence length at which naive OOMs.
    """
    out = {}
    B, H, D = 8, 16, 64  # 1024-wide model, 16 heads
    scale = D ** -0.5

    def naive(q, k, v, causal):
        s = (q @ k.transpose(-2, -1)) * scale
        if causal:
            L = q.shape[-2]
            mask = torch.ones(L, L, device=DEV, dtype=torch.bool).tril()
            s = s.masked_fill(~mask, float("-inf"))
        return torch.softmax(s, dim=-1) @ v

    for L in [512, 1024, 2048, 4096, 8192, 16384]:
        rec = {}
        try:
            q, k, v = (torch.randn(B, H, L, D, device=DEV, dtype=torch.bfloat16) for _ in range(3))
        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()
            out[f"L{L}"] = {"error": "oom_allocating_qkv"}
            continue

        # FLOPs: QK^T (2*B*H*L*L*D) + PV (2*B*H*L*L*D); causal does ~half the work
        flops = 4 * B * H * L * L * D

        try:
            torch.cuda.reset_peak_memory_stats()
            t = timed(lambda: naive(q, k, v, True), warmup=3, iters=10)
            rec["naive_ms"] = round(t * 1e3, 3)
            rec["naive_tflops"] = round(flops / t / 1e12, 1)
            rec["naive_peak_gb"] = round(torch.cuda.max_memory_allocated() / 1e9, 2)
        except torch.cuda.OutOfMemoryError:
            torch.cuda.empty_cache()
            rec["naive_ms"] = None
            rec["naive_note"] = "OOM: score matrix does not fit"

        torch.cuda.reset_peak_memory_stats()
        t = timed(
            lambda: torch.nn.functional.scaled_dot_product_attention(q, k, v, is_causal=True),
            warmup=3,
            iters=10,
        )
        rec["flash_ms"] = round(t * 1e3, 3)
        rec["flash_tflops"] = round(flops / t / 1e12, 1)
        rec["flash_peak_gb"] = round(torch.cuda.max_memory_allocated() / 1e9, 2)
        if rec.get("naive_ms"):
            rec["speedup"] = round(rec["naive_ms"] / rec["flash_ms"], 2)
            rec["mem_ratio"] = round(rec["naive_peak_gb"] / rec["flash_peak_gb"], 2)
        # score matrix bytes the naive path must write and re-read
        rec["score_matrix_gb"] = round(B * H * L * L * 2 / 1e9, 2)
        out[f"L{L}"] = rec
        del q, k, v
        torch.cuda.empty_cache()
    return out


def mha_block():
    """A full multi-head attention module: projections + attention + output."""
    out = {}
    B, L, d_model, H = 8, 2048, 1024, 16
    x = torch.randn(B, L, d_model, device=DEV, dtype=torch.bfloat16)
    wq, wk, wv, wo = (
        torch.randn(d_model, d_model, device=DEV, dtype=torch.bfloat16) for _ in range(4)
    )

    def block():
        q = (x @ wq).view(B, L, H, -1).transpose(1, 2)
        k = (x @ wk).view(B, L, H, -1).transpose(1, 2)
        v = (x @ wv).view(B, L, H, -1).transpose(1, 2)
        o = torch.nn.functional.scaled_dot_product_attention(q, k, v, is_causal=True)
        return o.transpose(1, 2).reshape(B, L, d_model) @ wo

    t = timed(block, warmup=5, iters=30)
    proj_flops = 4 * 2 * B * L * d_model * d_model
    attn_flops = 4 * B * H * L * L * (d_model // H)
    out["config"] = {"batch": B, "seq_len": L, "d_model": d_model, "heads": H}
    out["ms"] = round(t * 1e3, 3)
    out["tflops"] = round((proj_flops + attn_flops) / t / 1e12, 1)
    out["proj_flop_share"] = round(proj_flops / (proj_flops + attn_flops), 3)
    del x, wq, wk, wv, wo
    torch.cuda.empty_cache()
    return out


def elementwise_fusion():
    """Why fusion matters: unfused chain vs torch.compile'd fused version."""
    out = {}
    n = 1 << 26
    x = torch.randn(n, device=DEV)

    def unfused(t):
        return torch.tanh(torch.relu(t * 2.0 + 1.0)) * 0.5

    out["unfused_ms"] = round(timed(lambda: unfused(x)) * 1e3, 3)
    try:
        fused = torch.compile(unfused)
        out["fused_ms"] = round(timed(lambda: fused(x), warmup=15) * 1e3, 3)
        out["speedup"] = round(out["unfused_ms"] / out["fused_ms"], 2)
    except Exception as e:  # compile unavailable / backend failure
        out["fused_error"] = str(e)[:200]
    del x
    torch.cuda.empty_cache()
    return out


def main():
    torch.manual_seed(0)
    results = {"device": device_info()}
    for name, fn in [
        ("bandwidth", bandwidth),
        ("matmul", matmul),
        ("attention", attention),
        ("mha_block", mha_block),
        ("fusion", elementwise_fusion),
    ]:
        try:
            results[name] = fn()
        except Exception as e:
            results[name] = {"error": f"{type(e).__name__}: {e}"}
        print(f"done: {name}", file=sys.stderr)
    json.dump(results, sys.stdout, indent=2)
    print()


if __name__ == "__main__":
    main()
