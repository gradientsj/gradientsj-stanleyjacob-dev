"""Measurements for classes/deep-learning-genomics.

Everything here runs offline on synthetic data: no genome, no ENCODE track, no
UniProt dump is downloaded. That is a real limitation and the page says so.
What synthetic data can still establish, honestly, is the mechanical claims:
that a PWM scan is a convolution, that a dilated stack has the receptive field
the arithmetic predicts, that a CNN trained only on labels recovers the motif
that generated them, that random splits over homologous sequence inflate
accuracy, that log-likelihood ratios from an unsupervised sequence model track
motif disruption, and what attention costs at genomic sequence lengths on an
H100.

    python classes/data/bench_genomics.py            # writes classes/data/genomics.json
"""

import json
import math
import os
import pathlib
import time

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

OUT = pathlib.Path(__file__).resolve().parent / "genomics.json"
DEV = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
ALPHA = "ACGT"
COMP = {0: 3, 1: 2, 2: 1, 3: 0}  # A<->T, C<->G

R = {}


def seed_all(s):
    np.random.seed(s)
    torch.manual_seed(s)
    torch.cuda.manual_seed_all(s)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def onehot(idx, L=None):
    """idx: (N, L) int array -> (N, 4, L) float32 one-hot, channels-first."""
    idx = np.asarray(idx)
    N, L = idx.shape
    x = np.zeros((N, 4, L), dtype=np.float32)
    n = np.arange(N)[:, None]
    p = np.arange(L)[None, :]
    x[n, idx, p] = 1.0
    return x


def revcomp_idx(idx):
    """Reverse complement in index space: reverse positions, complement bases."""
    return 3 - np.asarray(idx)[..., ::-1]


def revcomp_onehot(x):
    """(N,4,L) -> reverse complement: flip both the channel and length axes."""
    return torch.flip(x, dims=(1, 2))


def sample_pwm(ppm, n, rng):
    """Sample n motif instances (n, w) from a position probability matrix (4, w)."""
    w = ppm.shape[1]
    out = np.zeros((n, w), dtype=np.int64)
    for j in range(w):
        out[:, j] = rng.choice(4, size=n, p=ppm[:, j])
    return out


def make_ppm(w, conc, rng):
    """A motif with informative columns: Dirichlet with small concentration."""
    m = rng.dirichlet(np.full(4, conc), size=w).T  # (4, w)
    return m / m.sum(0, keepdims=True)


def info_content(ppm):
    p = np.clip(ppm, 1e-9, 1)
    return float(np.sum(2.0 + np.sum(p * np.log2(p), axis=0)))


def best_match(a, b):
    """Max Pearson r between two 4xW matrices over all offsets and both strands.

    Columns are mean-centered per matrix; overlap must be at least 4 columns.
    """
    def rc(m):
        return m[::-1, ::-1]

    best = -2.0
    for cand in (b, rc(b)):
        wa, wb = a.shape[1], cand.shape[1]
        for off in range(-wb + 4, wa - 3):
            lo = max(0, off)
            hi = min(wa, off + wb)
            if hi - lo < 4:
                continue
            u = a[:, lo:hi].ravel()
            v = cand[:, lo - off:hi - off].ravel()
            if u.std() < 1e-8 or v.std() < 1e-8:
                continue
            r = float(np.corrcoef(u, v)[0, 1])
            best = max(best, r)
    return best


# --------------------------------------------------------------------------
# 1. PWM scan == convolution
# --------------------------------------------------------------------------
def exp_pwm_conv():
    rng = np.random.default_rng(0)
    w = 8
    ppm = make_ppm(w, 0.35, rng)
    bg = np.full(4, 0.25)
    W = np.log2(ppm / bg[:, None])            # log-odds, (4, w)

    L, N = 512, 64
    seq = rng.integers(0, 4, size=(N, L))
    X = onehot(seq)                            # (N, 4, L)

    # explicit scan: for each window, sum W[base, j]
    t0 = time.time()
    scan = np.zeros((N, L - w + 1), dtype=np.float64)
    for i in range(N):
        for s in range(L - w + 1):
            scan[i, s] = sum(W[seq[i, s + j], j] for j in range(w))
    loop_s = time.time() - t0

    xt = torch.from_numpy(X)
    wt = torch.from_numpy(W.astype(np.float32))[None]   # (1, 4, w)
    t0 = time.time()
    conv = F.conv1d(xt, wt).numpy()[:, 0]
    conv_s = time.time() - t0

    # reverse-complement scan == convolution with the RC'd filter
    wrc = torch.flip(wt, dims=(1, 2))
    conv_rc = F.conv1d(xt, wrc).numpy()[:, 0]
    xrc = torch.from_numpy(onehot(revcomp_idx(seq)))
    conv_on_rc_seq = F.conv1d(xrc, wt).numpy()[:, 0]

    return {
        "motif_width": w,
        "n_seqs": N,
        "seq_len": L,
        "planted_info_content_bits": round(info_content(ppm), 3),
        "max_abs_diff_scan_vs_conv1d": float(np.abs(scan - conv).max()),
        "max_rel_diff_scan_vs_conv1d": float(
            np.abs(scan - conv).max() / np.abs(scan).max()),
        "python_loop_seconds": round(loop_s, 4),
        "conv1d_seconds": round(conv_s, 6),
        "loop_over_conv_speedup": round(loop_s / conv_s, 1),
        "max_abs_diff_rc_filter_vs_rc_sequence": float(
            np.abs(conv_rc[:, ::-1] - conv_on_rc_seq).max()),
        "note": ("conv1d weight = log2(ppm/background); the RC identity is "
                 "flip along both the channel and the position axis"),
    }


# --------------------------------------------------------------------------
# 2. Receptive field of a Basenji-style dilated stack
# --------------------------------------------------------------------------
class DilatedTrunk(nn.Module):
    """Stem conv, four pooled conv blocks, then a dilated residual tower."""

    def __init__(self, ch=64, dilations=(1, 2, 4, 8, 16, 32, 64)):
        super().__init__()
        self.stem = nn.Conv1d(4, ch, 11, padding=5)
        self.blocks = nn.ModuleList(
            [nn.Conv1d(ch, ch, 5, padding=2) for _ in range(4)])
        self.dil = nn.ModuleList(
            [nn.Conv1d(ch, ch, 3, padding=d, dilation=d) for d in dilations])
        self.head = nn.Conv1d(ch, 1, 1)
        self.dilations = dilations

    def forward(self, x):
        h = F.relu(self.stem(x))
        h = F.max_pool1d(h, 2)
        for b in self.blocks:
            h = F.relu(b(h))
            h = F.max_pool1d(h, 2)
        for d in self.dil:
            h = h + F.relu(d(h))
        return self.head(h)


def exp_receptive_field():
    dil = (1, 2, 4, 8, 16, 32, 64)
    # analytic: r_l = r_{l-1} + (k_l - 1) * d_l * j_{l-1}; j_l = j_{l-1} * s_l
    r, j = 1, 1
    trace = []
    def step(k, s, d, name):
        nonlocal r, j
        r = r + (k - 1) * d * j
        j = j * s
        trace.append({"layer": name, "k": k, "stride": s, "dilation": d,
                      "rf": r, "jump": j})
    step(11, 1, 1, "stem conv k=11")
    step(2, 2, 1, "maxpool /2")
    for i in range(4):
        step(5, 1, 1, f"conv{i+1} k=5")
        step(2, 2, 1, f"maxpool /2 ({i+2})")
    for d in dil:
        step(3, 1, d, f"dilated conv k=3 d={d}")
    analytic_rf, bin_size = r, j

    model = DilatedTrunk(ch=16, dilations=dil).to(DEV).double()
    for p in model.parameters():
        nn.init.normal_(p, 0.0, 0.5)
    L = 4096
    x = torch.zeros(1, 4, L, dtype=torch.float64, device=DEV, requires_grad=True)
    x.data.uniform_(0.2, 0.8)
    out = model(x)
    center = out.shape[-1] // 2
    out[0, 0, center].backward()
    g = x.grad.abs().sum(1)[0].detach().cpu().numpy()
    nz = np.nonzero(g > 1e-14)[0]
    measured = int(nz[-1] - nz[0] + 1)

    return {
        "dilations": list(dil),
        "analytic_receptive_field_bp": analytic_rf,
        "output_bin_size_bp": bin_size,
        "measured_receptive_field_bp": measured,
        "measured_matches_analytic": bool(measured == analytic_rf),
        "input_len": L,
        "output_len": int(out.shape[-1]),
        "layer_trace": trace,
        "method": ("gradient of one output unit w.r.t. a float input, count "
                   "positions with |grad| > 1e-14 in float64"),
    }


# --------------------------------------------------------------------------
# 3. Synthetic regulatory task: does a CNN recover the planted motif?
# --------------------------------------------------------------------------
def build_motif_dataset(n, L, ppm, rng, p_pos=0.5):
    w = ppm.shape[1]
    seq = rng.integers(0, 4, size=(n, L))
    y = (rng.random(n) < p_pos).astype(np.int64)
    pos_idx = np.where(y == 1)[0]
    inst = sample_pwm(ppm, len(pos_idx), rng)
    starts = rng.integers(0, L - w, size=len(pos_idx))
    for k, i in enumerate(pos_idx):
        seq[i, starts[k]:starts[k] + w] = inst[k]
    pos_start = np.full(n, -1, dtype=np.int64)
    pos_start[pos_idx] = starts
    return seq, y, pos_start


class MotifCNN(nn.Module):
    def __init__(self, nf=32, k=12, rc=False):
        super().__init__()
        self.conv = nn.Conv1d(4, nf, k)
        self.fc = nn.Linear(nf, 1)
        self.rc = rc

    def _score(self, x):
        h = F.relu(self.conv(x))
        h = h.max(dim=-1).values
        return self.fc(h)[:, 0]

    def forward(self, x):
        if self.rc:
            return 0.5 * (self._score(x) + self._score(revcomp_onehot(x)))
        return self._score(x)


def train_binary(model, Xtr, ytr, Xte, yte, epochs=25, bs=128, lr=3e-3, wd=1e-5):
    opt = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=wd)
    n = Xtr.shape[0]
    for _ in range(epochs):
        perm = torch.randperm(n, device=Xtr.device)
        for i in range(0, n, bs):
            b = perm[i:i + bs]
            loss = F.binary_cross_entropy_with_logits(model(Xtr[b]), ytr[b])
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
    model.eval()
    with torch.no_grad():
        s = model(Xte).cpu().numpy()
    return auroc(yte.cpu().numpy(), s), s


def auroc(y, s):
    order = np.argsort(s)
    ranks = np.empty(len(s), dtype=np.float64)
    ranks[order] = np.arange(1, len(s) + 1)
    # average ranks for ties
    sv = np.sort(s)
    i = 0
    while i < len(sv):
        j = i
        while j + 1 < len(sv) and sv[j + 1] == sv[i]:
            j += 1
        if j > i:
            ranks[order[i:j + 1]] = (i + j + 2) / 2.0
        i = j + 1
    npos, nneg = int(y.sum()), int((1 - y).sum())
    if npos == 0 or nneg == 0:
        return float("nan")
    return float((ranks[y == 1].sum() - npos * (npos + 1) / 2) / (npos * nneg))


def exp_motif_recovery():
    seed_all(1)
    rng = np.random.default_rng(7)
    L, w = 200, 8
    ppm = make_ppm(w, 0.30, rng)
    ic = info_content(ppm)

    ntr, nte = 20000, 4000
    str_, ytr_, _ = build_motif_dataset(ntr, L, ppm, rng)
    ste, yte_, pos_te = build_motif_dataset(nte, L, ppm, rng)

    Xtr = torch.from_numpy(onehot(str_)).to(DEV)
    Xte = torch.from_numpy(onehot(ste)).to(DEV)
    ytr = torch.from_numpy(ytr_.astype(np.float32)).to(DEV)
    yte = torch.from_numpy(yte_.astype(np.float32)).to(DEV)

    t0 = time.time()
    model = MotifCNN(nf=32, k=12).to(DEV)
    auc, _ = train_binary(model, Xtr, ytr, Xte, yte)
    train_s = time.time() - t0

    # shuffled-label control
    seed_all(2)
    ysh = ytr[torch.randperm(ntr, device=DEV)]
    ctrl = MotifCNN(nf=32, k=12).to(DEV)
    auc_ctrl, _ = train_binary(ctrl, Xtr, ysh, Xte, yte)

    # --- filter -> PFM by averaging activating subsequences
    conv_w = model.conv.weight.detach()               # (nf, 4, k)
    k = conv_w.shape[-1]
    with torch.no_grad():
        act = F.relu(F.conv1d(Xte, conv_w))           # (N, nf, L-k+1)
    sims, best = [], None
    for f in range(conv_w.shape[0]):
        a = act[:, f]
        thr = 0.5 * a.max()
        if thr <= 0:
            sims.append(-1.0)
            continue
        ii, jj = torch.nonzero(a > thr, as_tuple=True)
        if len(ii) < 20:
            sims.append(-1.0)
            continue
        sel = torch.randperm(len(ii), device=DEV)[:4000]
        ii, jj = ii[sel], jj[sel]
        wins = torch.stack([Xte[i, :, j:j + k] for i, j in zip(ii.tolist(), jj.tolist())])
        pfm = wins.mean(0).cpu().numpy()              # (4, k)
        s = best_match(pfm - pfm.mean(0, keepdims=True),
                       ppm - ppm.mean(0, keepdims=True))
        sims.append(s)
        if best is None or s > best[0]:
            best = (s, pfm, f)
    sims = np.array(sims)

    # --- in-silico mutagenesis, averaged over positives, aligned on the insert
    sub = np.where(yte_ == 1)[0][:1500]
    ism_acc = np.zeros((4, w))
    with torch.no_grad():
        for i in sub:
            x = Xte[i:i + 1]
            ref = model(x).item()
            st = int(pos_te[i])
            block = x.repeat(4 * w, 1, 1)
            for j in range(w):
                for b in range(4):
                    r = j * 4 + b
                    block[r, :, st + j] = 0.0
                    block[r, b, st + j] = 1.0
            d = (model(block) - ref).view(w, 4).cpu().numpy().T
            ism_acc += d
    ism = ism_acc / len(sub)
    lo = np.log2(np.clip(ppm, 1e-6, 1) / 0.25)
    ism_c = ism - ism.mean(0, keepdims=True)
    lo_c = lo - lo.mean(0, keepdims=True)
    ism_r = float(np.corrcoef(ism_c.ravel(), lo_c.ravel())[0, 1])

    # --- k-mer logistic regression baseline (the pre-2015 way)
    from sklearn.linear_model import LogisticRegression
    K = 6
    def kmer_feats(seqs, K=6):
        n, L = seqs.shape
        pw = 4 ** np.arange(K - 1, -1, -1)
        codes = np.zeros((n, L - K + 1), dtype=np.int64)
        for j in range(K):
            codes += seqs[:, j:L - K + 1 + j] * pw[j]
        M = np.zeros((n, 4 ** K), dtype=np.float32)
        for i in range(n):
            np.add.at(M[i], codes[i], 1.0)
        return M
    Ftr = kmer_feats(str_[:8000], K)
    Fte = kmer_feats(ste, K)
    t0 = time.time()
    lr = LogisticRegression(max_iter=300, C=0.05)
    lr.fit(Ftr, ytr_[:8000])
    kmer_s = time.time() - t0
    auc_kmer = auroc(yte_, lr.decision_function(Fte))

    return {
        "task": "binary: sequence contains one draw from a planted 8bp PWM",
        "seq_len": L,
        "motif_width": w,
        "motif_info_content_bits": round(ic, 3),
        "n_train": ntr, "n_test": nte,
        "cnn": {"filters": 32, "filter_width": 12,
                "params": sum(p.numel() for p in model.parameters()),
                "test_auroc": round(auc, 4),
                "train_seconds": round(train_s, 1)},
        "shuffled_label_control_auroc": round(auc_ctrl, 4),
        "kmer_logreg_baseline": {"k": K, "features": 4 ** K,
                                 "n_train": 8000,
                                 "test_auroc": round(auc_kmer, 4),
                                 "fit_seconds": round(kmer_s, 1)},
        "best_filter_vs_planted_pwm_r": round(float(best[0]), 4),
        "n_filters_with_r_above_0.9": int((sims > 0.9).sum()),
        "n_filters_with_r_above_0.7": int((sims > 0.7).sum()),
        "median_filter_similarity": round(float(np.median(sims)), 4),
        "ism_vs_pwm_logodds_r": round(ism_r, 4),
        "recovered_pfm_top_filter": np.round(best[1], 3).tolist(),
        "planted_ppm": np.round(ppm, 3).tolist(),
        "mean_ism_effect_matrix": np.round(ism, 4).tolist(),
    }


# --------------------------------------------------------------------------
# 4. Reverse-complement equivariance
# --------------------------------------------------------------------------
def exp_rc_equivariance():
    seed_all(3)
    rng = np.random.default_rng(11)
    L, w = 200, 8
    ppm = make_ppm(w, 0.30, rng)

    # both strands are labeled: half the positives carry the RC of the motif
    def build(n):
        seq, y, _ = build_motif_dataset(n, L, ppm, rng)
        flip = (rng.random(n) < 0.5)
        seq[flip] = revcomp_idx(seq[flip])
        return seq, y

    ntr, nte = 4000, 4000
    str_, ytr_ = build(ntr)
    ste, yte_ = build(nte)
    Xtr = torch.from_numpy(onehot(str_)).to(DEV)
    Xte = torch.from_numpy(onehot(ste)).to(DEV)
    ytr = torch.from_numpy(ytr_.astype(np.float32)).to(DEV)
    yte = torch.from_numpy(yte_.astype(np.float32)).to(DEV)

    out = {}
    for name, rc in (("plain", False), ("rc_siamese", True)):
        seed_all(4)
        m = MotifCNN(nf=32, k=12, rc=rc).to(DEV)
        auc, _ = train_binary(m, Xtr, ytr, Xte, yte, epochs=30)
        with torch.no_grad():
            a = m(Xte)
            b = m(revcomp_onehot(Xte))
        out[name] = {
            "test_auroc": round(auc, 4),
            "max_abs_pred_diff_seq_vs_revcomp": float((a - b).abs().max()),
            "mean_abs_pred_diff_seq_vs_revcomp": float((a - b).abs().mean()),
        }
    out["n_train"] = ntr
    out["note"] = ("labels are strand-symmetric; the siamese model shares one "
                   "conv stack across both strands and averages the logits")
    return out


# --------------------------------------------------------------------------
# 5. Random vs group-aware (chromosome-held-out) splits
# --------------------------------------------------------------------------
def exp_split_leakage():
    seed_all(5)
    rng = np.random.default_rng(13)
    L, w = 200, 8
    ppm = make_ppm(w, 0.30, rng)

    n_fam, per_fam = 400, 25
    mut_rate = 0.05
    flip_frac = 0.20

    founders = rng.integers(0, 4, size=(n_fam, L))
    has_motif = rng.random(n_fam) < 0.5
    for f in np.where(has_motif)[0]:
        inst = sample_pwm(ppm, 1, rng)[0]
        st = rng.integers(0, L - w)
        founders[f, st:st + w] = inst
    label = has_motif.astype(np.int64).copy()
    flipped = rng.random(n_fam) < flip_frac
    label[flipped] = 1 - label[flipped]          # family-level label noise

    seqs, ys, fam = [], [], []
    for f in range(n_fam):
        M = np.tile(founders[f], (per_fam, 1))
        mask = rng.random((per_fam, L)) < mut_rate
        M[mask] = rng.integers(0, 4, size=int(mask.sum()))
        seqs.append(M)
        ys.append(np.full(per_fam, label[f]))
        fam.append(np.full(per_fam, f))
    seqs = np.concatenate(seqs)
    ys = np.concatenate(ys).astype(np.float32)
    fam = np.concatenate(fam)
    n = len(ys)

    # measured sequence identity within and between families
    def ident(a, b):
        return float((seqs[a] == seqs[b]).mean())
    same = np.mean([ident(f * per_fam, f * per_fam + 1) for f in range(n_fam)])
    diff = np.mean([ident(f * per_fam, ((f + 7) % n_fam) * per_fam)
                    for f in range(n_fam)])

    X = torch.from_numpy(onehot(seqs)).to(DEV)
    Y = torch.from_numpy(ys).to(DEV)

    res = {}
    # (a) random split over sequences
    perm = rng.permutation(n)
    cut = int(0.8 * n)
    tr, te = perm[:cut], perm[cut:]
    seed_all(6)
    m = MotifCNN(nf=32, k=12).to(DEV)
    auc_rand, _ = train_binary(m, X[tr], Y[tr], X[te], Y[te], epochs=20)

    # (b) group split: entire families held out ("chromosome" holdout)
    fam_perm = rng.permutation(n_fam)
    test_fams = set(fam_perm[:int(0.2 * n_fam)].tolist())
    te2 = np.array([i for i in range(n) if fam[i] in test_fams])
    tr2 = np.array([i for i in range(n) if fam[i] not in test_fams])
    seed_all(6)
    m2 = MotifCNN(nf=32, k=12).to(DEV)
    auc_group, _ = train_binary(m2, X[tr2], Y[tr2], X[te2], Y[te2], epochs=20)

    # (c) nearest-neighbour lookup: how much of (a) is pure memorization
    with torch.no_grad():
        Xtr_f = X[tr].reshape(len(tr), -1)
        Xte_f = X[te].reshape(len(te), -1)
        preds = []
        for i in range(0, len(te), 256):
            d = torch.cdist(Xte_f[i:i + 256], Xtr_f)
            nn_i = d.argmin(1)
            preds.append(Y[tr][nn_i])
        nn_pred = torch.cat(preds).cpu().numpy()
    nn_acc_random = float((nn_pred == ys[te]).mean())

    with torch.no_grad():
        Xtr_f = X[tr2].reshape(len(tr2), -1)
        Xte_f = X[te2].reshape(len(te2), -1)
        preds = []
        for i in range(0, len(te2), 256):
            d = torch.cdist(Xte_f[i:i + 256], Xtr_f)
            preds.append(Y[tr2][d.argmin(1)])
        nn_pred2 = torch.cat(preds).cpu().numpy()
    nn_acc_group = float((nn_pred2 == ys[te2]).mean())

    res = {
        "n_families": n_fam, "members_per_family": per_fam, "n_total": n,
        "seq_len": L, "per_member_mutation_rate": mut_rate,
        "family_label_flip_fraction": flip_frac,
        "generalizable_ceiling_auroc": 1 - flip_frac,
        "mean_identity_within_family": round(same, 4),
        "mean_identity_between_families": round(diff, 4),
        "random_split_test_auroc": round(auc_rand, 4),
        "family_holdout_test_auroc": round(auc_group, 4),
        "inflation": round(auc_rand - auc_group, 4),
        "nn_lookup_accuracy_random_split": round(nn_acc_random, 4),
        "nn_lookup_accuracy_family_holdout": round(nn_acc_group, 4),
        "note": ("labels are a deterministic motif rule corrupted by noise "
                 "applied at the family level, so memorizing family identity "
                 "buys exactly the corrupted 20% back under a random split"),
    }
    return res


# --------------------------------------------------------------------------
# 6. Zero-shot variant scoring from an unsupervised sequence model
# --------------------------------------------------------------------------
class MaskedDNALM(nn.Module):
    def __init__(self, d=128, nhead=4, layers=3, L=64):
        super().__init__()
        self.emb = nn.Embedding(5, d)          # 4 bases + [MASK]
        self.pos = nn.Parameter(torch.zeros(1, L, d))
        layer = nn.TransformerEncoderLayer(d, nhead, 4 * d, dropout=0.0,
                                           batch_first=True, norm_first=True)
        self.enc = nn.TransformerEncoder(layer, layers)
        self.out = nn.Linear(d, 4)

    def forward(self, tok):
        h = self.emb(tok) + self.pos[:, :tok.shape[1]]
        return self.out(self.enc(h))


def exp_zeroshot_llr():
    seed_all(8)
    rng = np.random.default_rng(23)
    L, w = 64, 8
    ppm = make_ppm(w, 0.25, rng)
    lo = np.log2(np.clip(ppm, 1e-6, 1) / 0.25)

    def build(n):
        seq = rng.integers(0, 4, size=(n, L))
        st = rng.integers(8, L - w - 8, size=n)
        inst = sample_pwm(ppm, n, rng)
        for i in range(n):
            seq[i, st[i]:st[i] + w] = inst[i]
        return seq, st

    ntr = 60000
    tr, _ = build(ntr)
    te, st_te = build(400)
    Ttr = torch.from_numpy(tr).to(DEV)
    model = MaskedDNALM(L=L).to(DEV)
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=0.01)
    bs, steps = 256, 3000
    t0 = time.time()
    model.train()
    for s in range(steps):
        b = Ttr[torch.randint(0, ntr, (bs,), device=DEV)]
        mask = torch.rand(b.shape, device=DEV) < 0.15
        mask[:, 0] = mask[:, 0] | (~mask.any(1))
        inp = b.clone()
        inp[mask] = 4
        logits = model(inp)
        loss = F.cross_entropy(logits[mask], b[mask])
        opt.zero_grad(set_to_none=True)
        loss.backward()
        opt.step()
    train_s = time.time() - t0
    final_loss = float(loss.item())
    model.eval()

    # LLR(alt, ref) at every position of every test sequence, mask-in-place
    Tte = torch.from_numpy(te).to(DEV)
    with torch.no_grad():
        inp = Tte.clone()
        lps = []
        for j in range(L):
            q = inp.clone()
            q[:, j] = 4
            lg = model(q)[:, j]
            lps.append(F.log_softmax(lg.float(), -1))
        lp = torch.stack(lps, 1).cpu().numpy()     # (N, L, 4)

    ref = te
    llr = lp - np.take_along_axis(lp, ref[:, :, None], axis=2)  # (N,L,4)

    in_motif, out_motif, true_eff, pred_eff = [], [], [], []
    for i in range(len(te)):
        s = int(st_te[i])
        for j in range(L):
            for b in range(4):
                if b == ref[i, j]:
                    continue
                v = llr[i, j, b]
                if s <= j < s + w:
                    in_motif.append(v)
                    true_eff.append(lo[b, j - s] - lo[ref[i, j], j - s])
                    pred_eff.append(v)
                else:
                    out_motif.append(v)
    in_motif = np.array(in_motif); out_motif = np.array(out_motif)
    true_eff = np.array(true_eff); pred_eff = np.array(pred_eff)

    def spearman(a, b):
        ra = np.argsort(np.argsort(a)).astype(np.float64)
        rb = np.argsort(np.argsort(b)).astype(np.float64)
        return float(np.corrcoef(ra, rb)[0, 1])

    y = np.concatenate([np.ones(len(in_motif)), np.zeros(len(out_motif))])
    s = np.concatenate([-in_motif, -out_motif])
    return {
        "model": "3-layer masked transformer, d=128, 4 heads",
        "params": sum(p.numel() for p in model.parameters()),
        "train_steps": steps, "batch": bs, "train_seconds": round(train_s, 1),
        "final_masked_ce_nats": round(final_loss, 4),
        "uniform_baseline_ce_nats": round(math.log(4), 4),
        "seq_len": L, "motif_width": w,
        "motif_info_content_bits": round(info_content(ppm), 3),
        "n_test_seqs": len(te),
        "mean_llr_in_motif": round(float(in_motif.mean()), 4),
        "mean_llr_outside_motif": round(float(out_motif.mean()), 4),
        "sd_llr_outside_motif": round(float(out_motif.std()), 4),
        "auroc_llr_separates_motif_variants": round(auroc(y, s), 4),
        "pearson_llr_vs_pwm_delta_logodds": round(
            float(np.corrcoef(pred_eff, true_eff)[0, 1]), 4),
        "spearman_llr_vs_pwm_delta_logodds": round(
            spearman(pred_eff, true_eff), 4),
        "note": ("no labels were used: the model only ever saw masked-base "
                 "prediction, and variant effects are read off as "
                 "log p(alt|context) - log p(ref|context)"),
    }


# --------------------------------------------------------------------------
# 7. Attention cost at genomic sequence lengths
# --------------------------------------------------------------------------
def exp_attention_cost():
    if DEV.type != "cuda":
        return {"skipped": "no CUDA"}
    H, D = 8, 64
    rows = []
    lengths = [1024, 1536, 4096, 16384, 65536, 196608]
    for L in lengths:
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        q = torch.randn(1, H, L, D, device=DEV, dtype=torch.bfloat16)
        k = torch.randn_like(q)
        v = torch.randn_like(q)
        flops = 4.0 * H * L * L * D
        row = {"L": L, "score_matrix_gb_bf16": round(H * L * L * 2 / 1e9, 3),
               "flops_tflop": round(flops / 1e12, 3)}
        # naive
        try:
            def naive():
                s = (q @ k.transpose(-1, -2)) * (D ** -0.5)
                a = torch.softmax(s.float(), -1).to(q.dtype)
                return a @ v
            for _ in range(2):
                naive()
            torch.cuda.synchronize()
            torch.cuda.reset_peak_memory_stats()
            t0 = time.perf_counter()
            for _ in range(3):
                naive()
            torch.cuda.synchronize()
            ms = (time.perf_counter() - t0) / 3 * 1e3
            row["naive_ms"] = round(ms, 3)
            row["naive_tflops"] = round(flops / (ms * 1e-3) / 1e12, 1)
            row["naive_peak_gb"] = round(torch.cuda.max_memory_allocated() / 1e9, 2)
        except torch.cuda.OutOfMemoryError:
            row["naive_ms"] = None
            row["naive_note"] = "OOM: materializing the score matrix does not fit in 80GB"
            torch.cuda.empty_cache()
        # flash
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        try:
            with torch.nn.attention.sdpa_kernel(
                    torch.nn.attention.SDPBackend.FLASH_ATTENTION):
                for _ in range(2):
                    F.scaled_dot_product_attention(q, k, v)
                torch.cuda.synchronize()
                t0 = time.perf_counter()
                for _ in range(3):
                    F.scaled_dot_product_attention(q, k, v)
                torch.cuda.synchronize()
            ms = (time.perf_counter() - t0) / 3 * 1e3
            row["flash_ms"] = round(ms, 3)
            row["flash_tflops"] = round(flops / (ms * 1e-3) / 1e12, 1)
            row["flash_peak_gb"] = round(torch.cuda.max_memory_allocated() / 1e9, 3)
            if row.get("naive_ms"):
                row["speedup"] = round(row["naive_ms"] / ms, 2)
        except RuntimeError as e:
            row["flash_ms"] = None
            row["flash_note"] = str(e)[:120]
        rows.append(row)
        del q, k, v
        torch.cuda.empty_cache()

    # a dilated-conv trunk at the same length, for comparison
    conv_rows = []
    model = DilatedTrunk(ch=64).to(DEV).to(torch.bfloat16)
    for L in [16384, 65536, 196608]:
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        x = torch.randn(1, 4, L, device=DEV, dtype=torch.bfloat16)
        with torch.no_grad():
            for _ in range(2):
                model(x)
            torch.cuda.synchronize()
            t0 = time.perf_counter()
            for _ in range(3):
                model(x)
            torch.cuda.synchronize()
        ms = (time.perf_counter() - t0) / 3 * 1e3
        conv_rows.append({"L": L, "ms": round(ms, 3),
                          "peak_gb": round(torch.cuda.max_memory_allocated() / 1e9, 3)})
        del x
    return {"config": {"batch": 1, "heads": H, "head_dim": D, "dtype": "bfloat16"},
            "rows": rows,
            "dilated_trunk_ch64_forward": conv_rows}


# --------------------------------------------------------------------------
# 8. Count models for single-cell data
# --------------------------------------------------------------------------
def exp_count_models():
    rng = np.random.default_rng(31)
    n_cells, n_genes = 4000, 200
    theta = 1.5                     # NB inverse dispersion
    depth = rng.lognormal(np.log(8000), 0.4, size=n_cells)
    base = rng.lognormal(-6.0, 1.2, size=n_genes)
    mu = np.outer(depth, base)
    p = theta / (theta + mu)
    counts = rng.negative_binomial(theta, p)

    obs_mean = counts.mean(0)
    obs_var = counts.var(0)
    ok = obs_mean > 0.05
    slope = float(np.polyfit(np.log(obs_mean[ok]), np.log(obs_var[ok]), 1)[0])
    zero_frac = float((counts == 0).mean())
    pois_zero = float(np.mean(np.exp(-mu)))

    tr, te = counts[:3000], counts[3000:]
    mu_hat = tr.mean(0) + 1e-8
    var_hat = tr.var(0) + 1e-8

    from scipy.special import gammaln
    def ll_pois(x, m):
        return float(np.mean(x * np.log(m) - m - gammaln(x + 1)))
    def ll_nb(x, m, th):
        return float(np.mean(gammaln(x + th) - gammaln(th) - gammaln(x + 1)
                             + th * np.log(th / (th + m))
                             + x * np.log(m / (th + m))))
    def ll_gauss(x, m, v):
        return float(np.mean(-0.5 * np.log(2 * np.pi * v) - (x - m) ** 2 / (2 * v)))

    th_hat = np.clip(mu_hat ** 2 / np.maximum(var_hat - mu_hat, 1e-6), 1e-3, 1e6)
    res = {
        "n_cells": n_cells, "n_genes": n_genes,
        "true_nb_inverse_dispersion": theta,
        "zero_fraction_observed": round(zero_frac, 4),
        "zero_fraction_a_poisson_would_give": round(pois_zero, 4),
        "log_var_vs_log_mean_slope": round(slope, 3),
        "poisson_predicts_slope": 1.0,
        "heldout_loglik_per_entry": {
            "gaussian_on_raw_counts": round(ll_gauss(te, mu_hat, var_hat), 3),
            "poisson": round(ll_pois(te, mu_hat), 3),
            "negative_binomial": round(ll_nb(te, mu_hat, th_hat), 3),
        },
        "note": ("Gaussian likelihood on raw counts is reported for the same "
                 "held-out entries; it is a density on the reals, so it is "
                 "only loosely comparable, but the ordering is the point"),
    }
    # log1p + Gaussian, as a variance-stabilization check
    ltr = np.log1p(tr / tr.sum(1, keepdims=True) * 1e4)
    lte = np.log1p(te / te.sum(1, keepdims=True) * 1e4)
    lm, lv = ltr.mean(0), ltr.var(0) + 1e-8
    lok = lm > 0.01
    res["log1p_cpm_log_var_vs_log_mean_slope"] = round(
        float(np.polyfit(np.log(lm[lok]), np.log(lv[lok]), 1)[0]), 3)
    res["log1p_zero_fraction"] = round(float((lte == 0).mean()), 4)
    return res


# --------------------------------------------------------------------------
# 9. GWAS: multiple testing, and population stratification
# --------------------------------------------------------------------------
def exp_gwas():
    rng = np.random.default_rng(37)
    # (a) pure-null multiple testing
    m, n = 1_000_000, 5000
    chunk = 50_000
    hits05 = hits_bonf = 0
    minp = 1.0
    from scipy import stats
    y0 = rng.normal(size=n)
    y0 = (y0 - y0.mean()) / y0.std()
    thr = 0.05 / m
    for _ in range(m // chunk):
        f = rng.uniform(0.05, 0.5, size=chunk)
        G = rng.binomial(2, f[None, :], size=(n, chunk)).astype(np.float64)
        G -= G.mean(0)
        sd = G.std(0) + 1e-12
        r = (y0 @ G) / (n * sd)
        t = r * np.sqrt((n - 2) / np.maximum(1 - r ** 2, 1e-12))
        p = 2 * stats.t.sf(np.abs(t), n - 2)
        hits05 += int((p < 0.05).sum())
        hits_bonf += int((p < thr).sum())
        minp = min(minp, float(p.min()))
    null = {
        "n_snps": m, "n_individuals": n,
        "expected_p_below_0.05": m * 0.05,
        "observed_p_below_0.05": hits05,
        "bonferroni_threshold": thr,
        "genome_wide_significance_convention": 5e-8,
        "observed_below_bonferroni": hits_bonf,
        "min_p_over_1e6_null_tests": minp,
    }

    # (b) stratification: two populations, no causal variant anywhere
    n = 6000
    m2 = 20000
    pop = (rng.random(n) < 0.5).astype(np.float64)
    y = 0.6 * pop + rng.normal(size=n)          # environment differs by ancestry
    fst = 0.08
    anc = rng.uniform(0.15, 0.85, size=m2)
    a = anc * (1 - fst) / fst
    b = (1 - anc) * (1 - fst) / fst
    f1 = rng.beta(a, b)
    f2 = rng.beta(a, b)
    G = np.where(pop[:, None] == 1,
                 rng.binomial(2, np.broadcast_to(f1, (n, m2))),
                 rng.binomial(2, np.broadcast_to(f2, (n, m2)))).astype(np.float64)
    Gc = G - G.mean(0)
    sd = Gc.std(0) + 1e-12

    def scan(resid):
        r = (resid @ Gc) / (n * sd * resid.std())
        t = r * np.sqrt((n - 2) / np.maximum(1 - r ** 2, 1e-12))
        p = 2 * stats.t.sf(np.abs(t), n - 2)
        chi2 = t ** 2
        lam = float(np.median(chi2) / stats.chi2.ppf(0.5, 1))
        return p, lam

    p_raw, lam_raw = scan(y - y.mean())
    # correct with the top principal components of the genotype matrix
    Z = Gc / sd
    U, S, Vt = np.linalg.svd(Z[:, :4000] / np.sqrt(n), full_matrices=False)
    PC = U[:, :5]
    beta = np.linalg.lstsq(np.c_[np.ones(n), PC], y, rcond=None)[0]
    resid = y - np.c_[np.ones(n), PC] @ beta
    p_pc, lam_pc = scan(resid)
    strat = {
        "n_individuals": n, "n_snps": m2, "fst": fst,
        "true_causal_snps": 0,
        "trait_shift_between_populations_sd": 0.6,
        "hits_below_5e-8_uncorrected": int((p_raw < 5e-8).sum()),
        "lambda_gc_uncorrected": round(lam_raw, 3),
        "hits_below_5e-8_after_5_genotype_pcs": int((p_pc < 5e-8).sum()),
        "lambda_gc_after_5_genotype_pcs": round(lam_pc, 3),
        "pc1_correlation_with_ancestry": round(
            float(abs(np.corrcoef(PC[:, 0], pop)[0, 1])), 3),
    }
    return {"null_multiple_testing": null, "population_stratification": strat}


# --------------------------------------------------------------------------
# 10. JAX parity
# --------------------------------------------------------------------------
def exp_jax_parity():
    try:
        import jax
        import jax.numpy as jnp
        from jax import lax
    except Exception as e:  # pragma: no cover
        return {"skipped": str(e)[:100]}

    seed_all(9)
    m = DilatedTrunk(ch=16, dilations=(1, 2, 4)).eval()
    x = torch.randn(2, 4, 1024)
    with torch.no_grad():
        ref = m(x).numpy()

    p = {k: jnp.asarray(v.detach().numpy()) for k, v in m.state_dict().items()}

    def conv(h, w, b, pad, dil):
        y = lax.conv_general_dilated(h, w, (1,), [(pad, pad)],
                                     rhs_dilation=(dil,),
                                     dimension_numbers=("NCH", "OIH", "NCH"))
        return y + b[None, :, None]

    def fwd(x):
        h = jax.nn.relu(conv(x, p["stem.weight"], p["stem.bias"], 5, 1))
        h = lax.reduce_window(h, -jnp.inf, lax.max, (1, 1, 2), (1, 1, 2), "VALID")
        for i in range(4):
            h = jax.nn.relu(conv(h, p[f"blocks.{i}.weight"], p[f"blocks.{i}.bias"], 2, 1))
            h = lax.reduce_window(h, -jnp.inf, lax.max, (1, 1, 2), (1, 1, 2), "VALID")
        for i, d in enumerate((1, 2, 4)):
            h = h + jax.nn.relu(conv(h, p[f"dil.{i}.weight"], p[f"dil.{i}.bias"], d, d))
        return conv(h, p["head.weight"], p["head.bias"], 0, 1)

    out = np.asarray(jax.jit(fwd)(jnp.asarray(x.numpy())))
    return {
        "shape": list(out.shape),
        "max_abs_diff_torch_vs_jax": float(np.abs(out - ref).max()),
        "rel_diff": float(np.abs(out - ref).max() / (np.abs(ref).max() + 1e-12)),
        "jax_version": jax.__version__,
        "devices": [str(d) for d in jax.devices()],
    }


# --------------------------------------------------------------------------
def main():
    torch.backends.cuda.matmul.allow_tf32 = True
    R["device"] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"
    R["torch"] = torch.__version__
    R["numpy"] = np.__version__
    R["data_provenance"] = (
        "All experiments run on synthetic sequence and count data generated "
        "in this script. No external genomic dataset was downloaded; the "
        "machine is offline. Absolute accuracies are therefore not comparable "
        "to published benchmarks, but every mechanical claim tested here "
        "(convolution/PWM equivalence, receptive-field arithmetic, motif "
        "recovery, split leakage, attention cost) is exact or architecture-"
        "determined and does not depend on the data source.")

    steps = [
        ("pwm_convolution", exp_pwm_conv),
        ("receptive_field", exp_receptive_field),
        ("motif_recovery", exp_motif_recovery),
        ("rc_equivariance", exp_rc_equivariance),
        ("split_leakage", exp_split_leakage),
        ("zeroshot_llr", exp_zeroshot_llr),
        ("attention_cost", exp_attention_cost),
        ("count_models", exp_count_models),
        ("gwas", exp_gwas),
        ("jax_parity", exp_jax_parity),
    ]
    for name, fn in steps:
        t0 = time.time()
        print(f"[run] {name} ...", flush=True)
        R[name] = fn()
        print(f"[ok ] {name} in {time.time() - t0:.1f}s", flush=True)

    OUT.write_text(json.dumps(R, indent=1))
    print("wrote", OUT)


if __name__ == "__main__":
    main()
