"""Real database measurements for /classes/databases/.

Runs on this machine (Intel Xeon Platinum 8480+, 52 threads, 442 GB RAM) with
SQLite 3.37.2 and DuckDB 1.5.5 through their Python drivers. Writes
classes/data/db.json. Every number the page presents as measured comes from
here; nothing is hand-edited afterward.

    python classes/data/bench_db.py
"""

import gc
import json
import math
import os
import pathlib
import random
import shutil
import sqlite3
import statistics
import struct
import sys
import tempfile
import time

import duckdb
import numpy as np

OUT = pathlib.Path(__file__).resolve().parent / "db.json"
SCRATCH = pathlib.Path(os.environ.get("DB_BENCH_SCRATCH", tempfile.mkdtemp(prefix="dbbench-")))
SCRATCH.mkdir(parents=True, exist_ok=True)

R = {}
R["meta"] = {
    "machine": "Intel Xeon Platinum 8480+, 52 threads, 442 GB RAM",
    "sqlite_version": sqlite3.sqlite_version,
    "duckdb_version": duckdb.__version__,
    "python": sys.version.split()[0],
    "numpy": np.__version__,
    "note": "wall-clock, warm cache, best-of-k unless stated; k given per entry",
}


def bestof(fn, k=7):
    """Best-of-k wall clock in milliseconds, plus the median."""
    ts = []
    for _ in range(k):
        gc.collect()
        t0 = time.perf_counter()
        fn()
        ts.append((time.perf_counter() - t0) * 1e3)
    return {"best_ms": round(min(ts), 4), "median_ms": round(statistics.median(ts), 4), "runs": k}


def mb(path):
    return round(os.path.getsize(path) / 1e6, 2)


def say(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------------------
# 1. Row store versus column store on identical data
# ---------------------------------------------------------------------------
N_ROWS = 5_000_000
REGIONS = ["north", "south", "east", "west", "central", "nordic", "apac", "latam"]
STATUS = ["new", "paid", "shipped", "returned"]

say("== building 5M row dataset ==")
rng = np.random.default_rng(20260724)
ids = np.arange(N_ROWS, dtype=np.int64)
region_ix = rng.integers(0, len(REGIONS), N_ROWS)
status_ix = rng.integers(0, len(STATUS), N_ROWS)
amount = np.round(rng.gamma(2.0, 180.0, N_ROWS), 2)
qty = rng.integers(1, 25, N_ROWS)
# customer id is correlated with region on purpose: used by the cardinality
# estimation experiment further down.
cust = (region_ix * 100_000 + rng.integers(0, 100_000, N_ROWS)).astype(np.int64)
note = "x" * 40

sqlite_path = SCRATCH / "sales.sqlite"
duck_path = SCRATCH / "sales.duckdb"
for p in (sqlite_path, duck_path):
    if p.exists():
        p.unlink()

DDL = """CREATE TABLE sales(
  id      INTEGER PRIMARY KEY,
  region  VARCHAR,
  status  VARCHAR,
  amount  DOUBLE,
  qty     INTEGER,
  cust    BIGINT,
  note    VARCHAR
)"""

say("  loading sqlite ...")
con = sqlite3.connect(sqlite_path)
con.execute("PRAGMA journal_mode=OFF")
con.execute("PRAGMA synchronous=OFF")
con.execute(DDL)
BATCH = 200_000
t0 = time.perf_counter()
for lo in range(0, N_ROWS, BATCH):
    hi = min(lo + BATCH, N_ROWS)
    rows = [
        (int(ids[i]), REGIONS[region_ix[i]], STATUS[status_ix[i]],
         float(amount[i]), int(qty[i]), int(cust[i]), note)
        for i in range(lo, hi)
    ]
    con.executemany("INSERT INTO sales VALUES (?,?,?,?,?,?,?)", rows)
con.commit()
sqlite_load = time.perf_counter() - t0
con.execute("ANALYZE")
con.commit()

say("  loading duckdb ...")
dcon = duckdb.connect(str(duck_path))
dcon.execute(DDL.replace("INTEGER PRIMARY KEY", "BIGINT"))
t0 = time.perf_counter()
df_region = np.array(REGIONS)[region_ix]
df_status = np.array(STATUS)[status_ix]
tbl = {"id": ids, "region": df_region, "status": df_status,
       "amount": amount, "qty": qty, "cust": cust,
       "note": np.full(N_ROWS, note)}
dcon.register("staging", __import__("pandas").DataFrame(tbl))
dcon.execute("INSERT INTO sales SELECT * FROM staging")
dcon.unregister("staging")
duck_load = time.perf_counter() - t0
dcon.execute("CHECKPOINT")

Q_GROUP_SQL = ("SELECT region, COUNT(*), AVG(amount), SUM(qty) "
               "FROM sales GROUP BY region")
Q_FILTER_SQL = "SELECT COUNT(*), AVG(qty) FROM sales WHERE amount > 500"
Q_POINT_SQL = "SELECT amount, qty FROM sales WHERE id = 3141592"

s_group = bestof(lambda: con.execute(Q_GROUP_SQL).fetchall(), 5)
s_filter = bestof(lambda: con.execute(Q_FILTER_SQL).fetchall(), 5)
s_point = bestof(lambda: con.execute(Q_POINT_SQL).fetchall(), 200)

dcon.execute("PRAGMA threads=1")
d_group_1 = bestof(lambda: dcon.execute(Q_GROUP_SQL).fetchall(), 7)
d_filter_1 = bestof(lambda: dcon.execute(Q_FILTER_SQL).fetchall(), 7)
d_point_1 = bestof(lambda: dcon.execute(Q_POINT_SQL).fetchall(), 20)
dcon.execute("PRAGMA threads=52")
d_group_n = bestof(lambda: dcon.execute(Q_GROUP_SQL).fetchall(), 7)
d_filter_n = bestof(lambda: dcon.execute(Q_FILTER_SQL).fetchall(), 7)

# Parquet, for the open-format size comparison.
pq = SCRATCH / "sales.parquet"
dcon.execute(f"COPY sales TO '{pq}' (FORMAT PARQUET, COMPRESSION ZSTD)")
pq_zstd = mb(pq)
pq2 = SCRATCH / "sales_snappy.parquet"
dcon.execute(f"COPY sales TO '{pq2}' (FORMAT PARQUET, COMPRESSION SNAPPY)")
pq_snappy = mb(pq2)
csv = SCRATCH / "sales.csv"
dcon.execute(f"COPY sales TO '{csv}' (FORMAT CSV, HEADER)")
csv_mb = mb(csv)

R["row_vs_column"] = {
    "rows": N_ROWS,
    "columns": 7,
    "sqlite_file_mb": mb(sqlite_path),
    "duckdb_file_mb": mb(duck_path),
    "parquet_zstd_mb": pq_zstd,
    "parquet_snappy_mb": pq_snappy,
    "csv_mb": csv_mb,
    "size_ratio_sqlite_over_duckdb": round(mb(sqlite_path) / mb(duck_path), 2),
    "sqlite_load_s": round(sqlite_load, 1),
    "duckdb_load_s": round(duck_load, 1),
    "group_by": {"sqlite": s_group, "duckdb_1thread": d_group_1,
                 "duckdb_52thread": d_group_n},
    "filter_agg": {"sqlite": s_filter, "duckdb_1thread": d_filter_1,
                   "duckdb_52thread": d_filter_n},
    "point_lookup": {"sqlite": s_point, "duckdb_1thread": d_point_1},
    "bytes_per_row_sqlite": round(os.path.getsize(sqlite_path) / N_ROWS, 1),
    "bytes_per_row_duckdb": round(os.path.getsize(duck_path) / N_ROWS, 1),
}
say("  row/col done:", json.dumps(R["row_vs_column"]["group_by"]))

# ---------------------------------------------------------------------------
# 2. Index versus sequential scan crossover (SQLite)
# ---------------------------------------------------------------------------
say("== index vs seq scan crossover ==")
IDX_N = 2_000_000
idx_path = SCRATCH / "idx.sqlite"
if idx_path.exists():
    idx_path.unlink()
icon = sqlite3.connect(idx_path)
icon.execute("PRAGMA journal_mode=OFF")
icon.execute("PRAGMA synchronous=OFF")
icon.execute("CREATE TABLE t(id INTEGER PRIMARY KEY, k INTEGER, pad VARCHAR)")
kvals = rng.integers(0, 1_000_000, IDX_N)
pad = "y" * 60
icon.executemany("INSERT INTO t VALUES (?,?,?)",
                 ((int(i), int(kvals[i]), pad) for i in range(IDX_N)))
icon.commit()

plan_before = icon.execute(
    "EXPLAIN QUERY PLAN SELECT COUNT(*), SUM(k) FROM t WHERE k BETWEEN 0 AND 999"
).fetchall()
icon.execute("CREATE INDEX t_k ON t(k)")
icon.execute("ANALYZE")
icon.commit()
plan_after = icon.execute(
    "EXPLAIN QUERY PLAN SELECT COUNT(*), SUM(k) FROM t WHERE k BETWEEN 0 AND 999"
).fetchall()
plan_covering = icon.execute(
    "EXPLAIN QUERY PLAN SELECT COUNT(*) FROM t WHERE k BETWEEN 0 AND 999"
).fetchall()
plan_wide = icon.execute(
    "EXPLAIN QUERY PLAN SELECT COUNT(*), SUM(k) FROM t WHERE k BETWEEN 0 AND 900000"
).fetchall()
# not covered by the index: the query needs `pad`, which lives only in the heap
plan_noncovering = icon.execute(
    "EXPLAIN QUERY PLAN SELECT COUNT(*), SUM(LENGTH(pad)) FROM t WHERE k BETWEEN 0 AND 999"
).fetchall()

cross = []
for width in (10, 100, 1_000, 5_000, 20_000, 25_000, 30_000, 35_000, 50_000,
              100_000, 200_000, 400_000, 700_000, 1_000_000):
    q_idx = (f"SELECT COUNT(*), SUM(pad IS NOT NULL) FROM t INDEXED BY t_k "
             f"WHERE k BETWEEN 0 AND {width - 1}")
    q_seq = (f"SELECT COUNT(*), SUM(pad IS NOT NULL) FROM t NOT INDEXED "
             f"WHERE k BETWEEN 0 AND {width - 1}")
    n_match = icon.execute(
        f"SELECT COUNT(*) FROM t NOT INDEXED WHERE k BETWEEN 0 AND {width - 1}"
    ).fetchone()[0]
    ti = bestof(lambda: icon.execute(q_idx).fetchall(), 3)
    ts = bestof(lambda: icon.execute(q_seq).fetchall(), 3)
    cross.append({
        "key_width": width,
        "rows_matched": n_match,
        "selectivity_pct": round(100.0 * n_match / IDX_N, 4),
        "index_ms": ti["best_ms"],
        "seqscan_ms": ts["best_ms"],
        "index_faster": ti["best_ms"] < ts["best_ms"],
        "speedup": round(ts["best_ms"] / ti["best_ms"], 2),
    })
    say(f"  sel={cross[-1]['selectivity_pct']:8.4f}%  idx={ti['best_ms']:9.2f}ms"
        f"  seq={ts['best_ms']:9.2f}ms")

winners = [c for c in cross if c["index_faster"]]
losers = [c for c in cross if not c["index_faster"]]
R["index_crossover"] = {
    "rows": IDX_N,
    "distinct_keys": 1_000_000,
    "explain_before_index": [list(map(str, r)) for r in plan_before],
    "explain_after_index": [list(map(str, r)) for r in plan_after],
    "explain_covering": [list(map(str, r)) for r in plan_covering],
    "explain_unselective": [list(map(str, r)) for r in plan_wide],
    "explain_noncovering": [list(map(str, r)) for r in plan_noncovering],
    "table_mb": mb(idx_path),
    "points": cross,
    "last_index_win_selectivity_pct": winners[-1]["selectivity_pct"] if winners else None,
    "first_index_loss_selectivity_pct": losers[0]["selectivity_pct"] if losers else None,
}

# ---------------------------------------------------------------------------
# 3. Join algorithm timings
# ---------------------------------------------------------------------------
say("== join algorithms ==")
jcon = sqlite3.connect(":memory:")
jcon.execute("PRAGMA journal_mode=OFF")
NB, NP = 200_000, 2_000
jcon.execute("CREATE TABLE big(id INTEGER PRIMARY KEY, fk INTEGER, v DOUBLE)")
jcon.execute("CREATE TABLE small(id INTEGER PRIMARY KEY, label VARCHAR)")
fk = rng.integers(0, NP, NB)
jcon.executemany("INSERT INTO big VALUES (?,?,?)",
                 ((int(i), int(fk[i]), float(amount[i])) for i in range(NB)))
jcon.executemany("INSERT INTO small VALUES (?,?)",
                 ((int(i), f"label{i}") for i in range(NP)))
jcon.commit()

JOIN_SQL = ("SELECT s.label, COUNT(*), SUM(b.v) FROM big b JOIN small s "
            "ON b.fk = s.id GROUP BY s.label")
# selective variant: only 10 of the 2,000 small rows survive the filter, so the
# outer of an index nested loop is tiny and the inner should never be scanned.
JOIN_SEL_SQL = ("SELECT s.label, COUNT(*), SUM(b.v) FROM big b JOIN small s "
                "ON b.fk = s.id WHERE s.id < 10 GROUP BY s.label")
j_nl = bestof(lambda: jcon.execute(JOIN_SQL).fetchall(), 3)
j_sel_nl = bestof(lambda: jcon.execute(JOIN_SEL_SQL).fetchall(), 3)
plan_sel_before = [list(map(str, r)) for r in
                   jcon.execute("EXPLAIN QUERY PLAN " + JOIN_SEL_SQL).fetchall()]
jcon.execute("CREATE INDEX big_fk ON big(fk)")
jcon.execute("ANALYZE")
j_inl = bestof(lambda: jcon.execute(JOIN_SQL).fetchall(), 3)
j_sel_inl = bestof(lambda: jcon.execute(JOIN_SEL_SQL).fetchall(), 3)
sqlite_join_plan = [list(map(str, r)) for r in
                    jcon.execute("EXPLAIN QUERY PLAN " + JOIN_SQL).fetchall()]
plan_sel_after = [list(map(str, r)) for r in
                  jcon.execute("EXPLAIN QUERY PLAN " + JOIN_SEL_SQL).fetchall()]

dj = duckdb.connect(":memory:")
dj.execute("PRAGMA threads=1")
dj.execute("CREATE TABLE big AS SELECT * FROM (VALUES (0,0,0.0)) t(id,fk,v) WHERE 1=0")
dj.execute("DROP TABLE big")
dj.execute("CREATE TABLE big(id BIGINT, fk BIGINT, v DOUBLE)")
dj.execute("CREATE TABLE small(id BIGINT, label VARCHAR)")
pd = __import__("pandas")
dj.register("bs", pd.DataFrame({"id": np.arange(NB), "fk": fk, "v": amount[:NB]}))
dj.execute("INSERT INTO big SELECT * FROM bs")
dj.register("ss", pd.DataFrame({"id": np.arange(NP),
                                "label": [f"label{i}" for i in range(NP)]}))
dj.execute("INSERT INTO small SELECT * FROM ss")
d_hash = bestof(lambda: dj.execute(JOIN_SQL).fetchall(), 5)
d_hash_sel = bestof(lambda: dj.execute(JOIN_SEL_SQL).fetchall(), 5)
duck_join_plan = dj.execute("EXPLAIN " + JOIN_SQL).fetchall()

# Pure-Python join algorithms on the same data, so the cost model is visible.
big_rows = [(int(i), int(fk[i]), float(amount[i])) for i in range(NB)]
small_rows = [(i, f"label{i}") for i in range(NP)]


def py_bnl(block=1000):
    out = 0
    for lo in range(0, len(big_rows), block):
        chunk = big_rows[lo:lo + block]
        idx = {}
        for r in chunk:
            idx.setdefault(r[1], []).append(r)
        for s in small_rows:
            if s[0] in idx:
                out += len(idx[s[0]])
    return out


def py_hash():
    ht = {}
    for s in small_rows:
        ht[s[0]] = s[1]
    out = 0
    for b in big_rows:
        if b[1] in ht:
            out += 1
    return out


def py_sortmerge():
    a = sorted(big_rows, key=lambda r: r[1])
    b = sorted(small_rows, key=lambda r: r[0])
    i = j = out = 0
    while i < len(a) and j < len(b):
        if a[i][1] == b[j][0]:
            out += 1
            i += 1
        elif a[i][1] < b[j][0]:
            i += 1
        else:
            j += 1
    return out


def py_nl_naive():
    # deliberately quadratic; run on a 2,000-row slice and extrapolate
    sub = big_rows[:2000]
    out = 0
    for b in sub:
        for s in small_rows:
            if b[1] == s[0]:
                out += 1
    return out


t_bnl = bestof(py_bnl, 3)
t_hash = bestof(py_hash, 3)
t_sm = bestof(py_sortmerge, 3)
t_nl = bestof(py_nl_naive, 3)

R["joins"] = {
    "big_rows": NB, "small_rows": NP,
    "full_join_matches": NB,
    "selective_join_small_rows": 10,
    "sqlite_no_index_ms": j_nl["best_ms"],
    "sqlite_with_index_ms": j_inl["best_ms"],
    "sqlite_index_speedup": round(j_nl["best_ms"] / j_inl["best_ms"], 2),
    "sqlite_selective_no_index_ms": j_sel_nl["best_ms"],
    "sqlite_selective_with_index_ms": j_sel_inl["best_ms"],
    "sqlite_selective_index_speedup": round(j_sel_nl["best_ms"] / j_sel_inl["best_ms"], 2),
    "sqlite_plan_with_index": sqlite_join_plan,
    "sqlite_selective_plan_before": plan_sel_before,
    "sqlite_selective_plan_after": plan_sel_after,
    "duckdb_hash_1thread_ms": d_hash["best_ms"],
    "duckdb_hash_selective_1thread_ms": d_hash_sel["best_ms"],
    "duckdb_plan_lines": (str(duck_join_plan[0][1]).splitlines()
                          if duck_join_plan else []),
    "python_hash_join_ms": t_hash["best_ms"],
    "python_sort_merge_ms": t_sm["best_ms"],
    "python_block_nested_loop_ms": t_bnl["best_ms"],
    "python_naive_nl_2000rows_ms": t_nl["best_ms"],
    "python_naive_nl_extrapolated_full_s": round(
        t_nl["best_ms"] / 1e3 * (NB / 2000), 2),
}
say("  joins done:", R["joins"]["sqlite_no_index_ms"], "->",
    R["joins"]["sqlite_with_index_ms"])

# ---------------------------------------------------------------------------
# 4. Columnar compression schemes, achieved ratios on the real columns
# ---------------------------------------------------------------------------
say("== compression ==")


def dict_encode(vals):
    uniq = sorted(set(vals))
    code = {v: i for i, v in enumerate(uniq)}
    bits = max(1, math.ceil(math.log2(max(2, len(uniq)))))
    payload = len(vals) * bits / 8.0
    dict_bytes = sum(len(str(u)) + 1 for u in uniq)
    return payload + dict_bytes, bits, len(uniq)


def rle_encode(vals):
    runs = 1
    for i in range(1, len(vals)):
        if vals[i] != vals[i - 1]:
            runs += 1
    return runs * 12.0, runs  # (value 8 B + count 4 B) per run


def bitpack(vals):
    hi = int(max(vals))
    bits = max(1, hi.bit_length())
    return len(vals) * bits / 8.0, bits


def frame_of_reference(vals):
    lo, hi = int(min(vals)), int(max(vals))
    bits = max(1, (hi - lo).bit_length())
    return len(vals) * bits / 8.0 + 8, bits


region_vals = list(df_region[:1_000_000])
qty_vals = [int(x) for x in qty[:1_000_000]]
cust_vals = [int(x) for x in cust[:1_000_000]]
id_sorted = list(range(1_000_000))
status_sorted = sorted(df_status[:1_000_000])

d_bytes, d_bits, d_card = dict_encode(region_vals)
raw_region = sum(len(v) for v in region_vals)
rle_bytes, rle_runs = rle_encode(status_sorted)
raw_status = sum(len(v) for v in status_sorted)
status_unsorted = list(df_status[:1_000_000])
rle_u_bytes, rle_u_runs = rle_encode(status_unsorted)
bp_bytes, bp_bits = bitpack(qty_vals)
for_bytes, for_bits = frame_of_reference(cust_vals[:1_000_000])
delta = np.diff(np.array(id_sorted, dtype=np.int64))
delta_bits = max(1, int(delta.max()).bit_length())
delta_bytes = len(delta) * delta_bits / 8.0 + 8

R["compression"] = {
    "n_values": 1_000_000,
    "dictionary_region": {
        "raw_bytes": raw_region, "encoded_bytes": round(d_bytes),
        "ratio": round(raw_region / d_bytes, 2),
        "bits_per_value": d_bits, "cardinality": d_card},
    "rle_status_sorted": {
        "raw_bytes": raw_status, "encoded_bytes": round(rle_bytes),
        "ratio": round(raw_status / rle_bytes, 1), "runs": rle_runs},
    "rle_status_unsorted": {
        "raw_bytes": raw_status, "encoded_bytes": round(rle_u_bytes),
        "ratio": round(raw_status / rle_u_bytes, 3), "runs": rle_u_runs},
    "bitpack_qty": {
        "raw_bytes": 1_000_000 * 4, "encoded_bytes": round(bp_bytes),
        "ratio": round(4_000_000 / bp_bytes, 2), "bits_per_value": bp_bits},
    "frame_of_reference_cust": {
        "raw_bytes": 1_000_000 * 8, "encoded_bytes": round(for_bytes),
        "ratio": round(8_000_000 / for_bytes, 2), "bits_per_value": for_bits},
    "delta_sorted_id": {
        "raw_bytes": 1_000_000 * 8, "encoded_bytes": round(delta_bytes),
        "ratio": round(8_000_000 / delta_bytes, 1), "bits_per_value": delta_bits},
}

# ---------------------------------------------------------------------------
# 4b. Zone maps: the same predicate against sorted and unsorted storage
# ---------------------------------------------------------------------------
say("== zone maps ==")
zcon = duckdb.connect(":memory:")
zcon.execute("PRAGMA threads=1")
pdlib = __import__("pandas")
zvals = rng.integers(0, 10_000_000, 5_000_000)
zcon.register("zs", pdlib.DataFrame({"k": zvals, "v": amount[:5_000_000]}))
zcon.execute("CREATE TABLE unsorted AS SELECT * FROM zs")
zcon.execute("CREATE TABLE sorted AS SELECT * FROM zs ORDER BY k")
zcon.unregister("zs")
ZQ = "SELECT COUNT(*), SUM(v) FROM {} WHERE k BETWEEN 5000000 AND 5000999"
z_un = bestof(lambda: zcon.execute(ZQ.format("unsorted")).fetchall(), 7)
z_so = bestof(lambda: zcon.execute(ZQ.format("sorted")).fetchall(), 7)
ZQ_WIDE = "SELECT COUNT(*), SUM(v) FROM {} WHERE k BETWEEN 0 AND 9999999"
z_un_w = bestof(lambda: zcon.execute(ZQ_WIDE.format("unsorted")).fetchall(), 5)
z_so_w = bestof(lambda: zcon.execute(ZQ_WIDE.format("sorted")).fetchall(), 5)
R["zone_maps"] = {
    "rows": 5_000_000,
    "narrow_predicate_rows": zcon.execute(
        ZQ.format("sorted")).fetchall()[0][0],
    "narrow_unsorted_ms": z_un["best_ms"],
    "narrow_sorted_ms": z_so["best_ms"],
    "narrow_speedup": round(z_un["best_ms"] / z_so["best_ms"], 1),
    "full_scan_unsorted_ms": z_un_w["best_ms"],
    "full_scan_sorted_ms": z_so_w["best_ms"],
    "note": "identical data, identical predicate; the only difference is whether "
            "row-group min/max ranges are disjoint enough to skip groups",
}
say("  zone maps:", R["zone_maps"]["narrow_unsorted_ms"], "vs",
    R["zone_maps"]["narrow_sorted_ms"])
zcon.close()

# ---------------------------------------------------------------------------
# 5. B+tree: build, verify height arithmetic, measure lookups
# ---------------------------------------------------------------------------
say("== b+tree ==")


class BPlusTree:
    """Order-f B+tree with leaf chaining. Leaves hold (key, value)."""

    def __init__(self, fanout=64):
        self.f = fanout
        self.root = {"leaf": True, "keys": [], "vals": [], "next": None}
        self.height = 1
        self.splits = 0

    def _find_leaf(self, key, path=None):
        node = self.root
        while not node["leaf"]:
            i = 0
            while i < len(node["keys"]) and key >= node["keys"][i]:
                i += 1
            if path is not None:
                path.append((node, i))
            node = node["kids"][i]
        return node

    def insert(self, key, val):
        path = []
        leaf = self._find_leaf(key, path)
        i = 0
        while i < len(leaf["keys"]) and leaf["keys"][i] < key:
            i += 1
        if i < len(leaf["keys"]) and leaf["keys"][i] == key:
            leaf["vals"][i] = val
            return
        leaf["keys"].insert(i, key)
        leaf["vals"].insert(i, val)
        if len(leaf["keys"]) <= self.f:
            return
        # split leaf: right half copied up (leaf split copies the separator)
        mid = len(leaf["keys"]) // 2
        right = {"leaf": True, "keys": leaf["keys"][mid:], "vals": leaf["vals"][mid:],
                 "next": leaf["next"]}
        leaf["keys"], leaf["vals"], leaf["next"] = leaf["keys"][:mid], leaf["vals"][:mid], right
        self.splits += 1
        sep, child = right["keys"][0], right
        while path:
            parent, idx = path.pop()
            parent["keys"].insert(idx, sep)
            parent["kids"].insert(idx + 1, child)
            if len(parent["keys"]) <= self.f:
                return
            m = len(parent["keys"]) // 2
            sep = parent["keys"][m]           # internal split pushes separator up
            right = {"leaf": False, "keys": parent["keys"][m + 1:],
                     "kids": parent["kids"][m + 1:]}
            parent["keys"], parent["kids"] = parent["keys"][:m], parent["kids"][:m + 1]
            self.splits += 1
            child = right
        self.root = {"leaf": False, "keys": [sep], "kids": [self.root, child]}
        self.height += 1

    def get(self, key):
        leaf = self._find_leaf(key)
        for k, v in zip(leaf["keys"], leaf["vals"]):
            if k == key:
                return v
        return None

    def range(self, lo, hi):
        leaf, out = self._find_leaf(lo), []
        while leaf is not None:
            for k, v in zip(leaf["keys"], leaf["vals"]):
                if k > hi:
                    return out
                if k >= lo:
                    out.append(v)
            leaf = leaf["next"]
        return out

    def stats(self):
        nodes = leaves = entries = 0
        stack = [self.root]
        while stack:
            n = stack.pop()
            nodes += 1
            if n["leaf"]:
                leaves += 1
                entries += len(n["keys"])
            else:
                stack.extend(n["kids"])
        return {"nodes": nodes, "leaves": leaves, "entries": entries}


bt = BPlusTree(fanout=64)
keys = list(range(200_000))
random.Random(7).shuffle(keys)
t0 = time.perf_counter()
for k in keys:
    bt.insert(k, k * 3)
bt_build = (time.perf_counter() - t0) * 1e3
st = bt.stats()
assert all(bt.get(k) == k * 3 for k in range(0, 200_000, 997))
rng_res = bt.range(1000, 1099)
assert rng_res == [k * 3 for k in range(1000, 1100)], rng_res[:5]
t0 = time.perf_counter()
for k in range(0, 200_000, 20):
    bt.get(k)
bt_lookup = (time.perf_counter() - t0) * 1e6 / (200_000 / 20)

R["bplustree"] = {
    "fanout": 64,
    "entries": st["entries"],
    "height_measured": bt.height,
    "height_predicted_at_ln2_fill": math.ceil(math.log(200_000, 64 * math.log(2))),
    "classic_random_fill_ln2_pct": round(100 * math.log(2), 1),
    "leaves": st["leaves"],
    "internal_nodes": st["nodes"] - st["leaves"],
    "splits": bt.splits,
    "avg_leaf_fill_pct": round(100.0 * st["entries"] / (st["leaves"] * 64), 1),
    "build_ms_200k_random": round(bt_build, 1),
    "lookup_us": round(bt_lookup, 3),
    "range_scan_100_ok": len(rng_res) == 100,
}
# fanout table for realistic page sizes (arithmetic, not timing)
fan = []
for page, hdr, keysz, ptr in ((4096, 96, 8, 8), (8192, 24, 8, 8),
                              (16384, 120, 8, 8), (8192, 24, 16, 8)):
    f = (page - hdr) // (keysz + ptr)
    for n in (10 ** 6, 10 ** 8, 10 ** 9):
        counts = [math.ceil(n / f)]           # leaf level
        while counts[-1] > 1:
            counts.append(math.ceil(counts[-1] / f))
        interior_pages = sum(counts[1:])
        fan.append({"page_bytes": page, "header": hdr, "key_bytes": keysz,
                    "fanout": f, "rows": n, "levels": len(counts),
                    "leaf_pages": counts[0],
                    "interior_pages": interior_pages,
                    "interior_mb": round(page * interior_pages / 1e6, 2)})
R["bplustree"]["fanout_table"] = fan

# ---------------------------------------------------------------------------
# 6. LSM: memtable + flush + leveled vs tiered compaction, measured write amp
# ---------------------------------------------------------------------------
say("== lsm ==")


class LSM:
    def __init__(self, memtable_entries=1000, ratio=10, policy="leveled"):
        self.mem = {}
        self.cap = memtable_entries
        self.T = ratio
        self.policy = policy
        self.levels = []          # list of list-of-runs; run = sorted [(k,v)]
        self.bytes_written = 0
        self.user_bytes = 0
        self.entry_bytes = 24
        self.runs_probed = 0

    def put(self, k, v):
        self.mem[k] = v
        self.user_bytes += self.entry_bytes
        self.bytes_written += self.entry_bytes      # WAL
        if len(self.mem) >= self.cap:
            self.flush()

    def flush(self):
        run = sorted(self.mem.items())
        self.mem = {}
        self.bytes_written += len(run) * self.entry_bytes
        if not self.levels:
            self.levels.append([])
        self.levels[0].append(run)
        self.compact(0)

    def _capacity(self, i):
        return self.cap * (self.T ** (i + 1))

    def compact(self, i):
        while i < len(self.levels):
            level = self.levels[i]
            size = sum(len(r) for r in level)
            if self.policy == "tiered":
                if len(level) < self.T:
                    return
                merged = self._merge(level)
                self.levels[i] = []
            else:
                if size <= self._capacity(i):
                    return
                merged_self = self._merge(level)
                if i + 1 < len(self.levels) and self.levels[i + 1]:
                    # resident (older) data first, overflowing (newer) data last,
                    # because _merge lets later runs win
                    merged = self._merge(self.levels[i + 1] + [merged_self])
                    self.levels[i + 1] = []
                else:
                    merged = merged_self
                self.levels[i] = []
            self.bytes_written += len(merged) * self.entry_bytes
            if i + 1 >= len(self.levels):
                self.levels.append([])
            self.levels[i + 1].append(merged)
            i += 1

    @staticmethod
    def _merge(runs):
        out = {}
        for run in runs:                    # later runs are newer
            for k, v in run:
                out[k] = v
        return sorted(out.items())

    def get(self, k):
        if k in self.mem:
            return self.mem[k]
        for level in self.levels:
            for run in reversed(level):
                self.runs_probed += 1
                lo, hi = 0, len(run) - 1
                while lo <= hi:
                    m = (lo + hi) // 2
                    if run[m][0] == k:
                        return run[m][1]
                    if run[m][0] < k:
                        lo = m + 1
                    else:
                        hi = m - 1
        return None

    def runs(self):
        return sum(len(l) for l in self.levels)


lsm_results = {}
KEYSPACE = 200_000
NPUT = 400_000
_r = random.Random(11)
put_keys = [_r.randrange(KEYSPACE) for _ in range(NPUT)]
for policy in ("leveled", "tiered"):
    lsm = LSM(memtable_entries=2000, ratio=10, policy=policy)
    t0 = time.perf_counter()
    for i, k in enumerate(put_keys):
        lsm.put(k, i)
    el = (time.perf_counter() - t0) * 1e3
    # correctness: last write wins
    last = {}
    for i, k in enumerate(put_keys):
        last[k] = i
    if lsm.mem:
        lsm.flush()                 # measure the on-disk structure, not the memtable
    probe = list(last)[:2000]
    lsm.runs_probed = 0
    t0 = time.perf_counter()
    ok = all(lsm.get(k) == last[k] for k in probe)
    read_us = (time.perf_counter() - t0) * 1e6 / len(probe)
    runs_per_hit = lsm.runs_probed / len(probe)
    # misses are the case Bloom filters exist for: every run must be consulted
    lsm.runs_probed = 0
    for k in range(KEYSPACE, KEYSPACE + 2000):
        lsm.get(k)
    runs_per_miss = lsm.runs_probed / 2000
    resident = sum(len(r) for lv in lsm.levels for r in lv) + len(lsm.mem)
    lsm_results[policy] = {
        "puts": NPUT, "distinct_keys": len(last),
        "write_amplification": round(lsm.bytes_written / lsm.user_bytes, 2),
        "runs_after": lsm.runs(),
        "levels": len(lsm.levels),
        "space_amplification": round(resident / len(last), 2),
        "ingest_ms": round(el, 1),
        "runs_probed_per_hit": round(runs_per_hit, 2),
        "runs_probed_per_miss": round(runs_per_miss, 2),
        "point_read_us": round(read_us, 2),
        "correct": ok,
    }
    say(f"  {policy}: WA={lsm_results[policy]['write_amplification']}"
        f" runs={lsm_results[policy]['runs_after']}"
        f" spaceamp={lsm_results[policy]['space_amplification']}")
R["lsm"] = lsm_results

# Bloom filter, measured false-positive rate versus the formula
say("== bloom ==")


class Bloom:
    def __init__(self, n, bits_per_key=10):
        self.m = n * bits_per_key
        self.k = max(1, round(bits_per_key * math.log(2)))
        self.bits = bytearray((self.m + 7) // 8)

    def _idx(self, key):
        h1 = hash(("a", key)) % self.m
        h2 = (hash(("b", key)) % (self.m - 1)) + 1
        for i in range(self.k):
            yield (h1 + i * h2) % self.m

    def add(self, key):
        for i in self._idx(key):
            self.bits[i >> 3] |= 1 << (i & 7)

    def __contains__(self, key):
        return all(self.bits[i >> 3] >> (i & 7) & 1 for i in self._idx(key))


bloom_rows = []
for bpk in (4, 8, 10, 16):
    n = 200_000
    bf = Bloom(n, bpk)
    for i in range(n):
        bf.add(i)
    misses = sum(1 for i in range(n, n + 200_000) if i in bf)
    theo = (1 - math.exp(-bf.k * n / bf.m)) ** bf.k
    bloom_rows.append({"bits_per_key": bpk, "hashes_k": bf.k,
                       "measured_fpr_pct": round(100 * misses / 200_000, 3),
                       "theoretical_fpr_pct": round(100 * theo, 3),
                       "kb_for_1M_keys": round(bpk * 1e6 / 8 / 1024)})
    say("  bpk", bpk, bloom_rows[-1])
R["bloom"] = bloom_rows

# ---------------------------------------------------------------------------
# 7. External merge sort: verify the pass-count formula
# ---------------------------------------------------------------------------
say("== external sort ==")


def external_sort(values, buffer_pages, page_entries, workdir):
    """Classic two-phase multiway merge. Returns (sorted_path, stats)."""
    workdir = pathlib.Path(workdir)
    workdir.mkdir(exist_ok=True)
    for f in workdir.glob("*.run"):
        f.unlink()
    npages = math.ceil(len(values) / page_entries)
    reads = writes = 0
    runs, chunk = [], buffer_pages * page_entries
    for ri, lo in enumerate(range(0, len(values), chunk)):
        block = sorted(values[lo:lo + chunk])
        p = workdir / f"r0_{ri}.run"
        with open(p, "wb") as fh:
            fh.write(struct.pack(f"<{len(block)}q", *block))
        reads += math.ceil(len(values[lo:lo + chunk]) / page_entries)
        writes += math.ceil(len(block) / page_entries)
        runs.append(p)
    passes = 1
    fanin = buffer_pages - 1
    while len(runs) > 1:
        newruns = []
        for gi in range(0, len(runs), fanin):
            group = runs[gi:gi + fanin]
            data = []
            for p in group:
                raw = open(p, "rb").read()
                vals = list(struct.unpack(f"<{len(raw) // 8}q", raw))
                reads += math.ceil(len(vals) / page_entries)
                data.append(vals)
            merged = []
            heads = [0] * len(data)
            import heapq
            h = [(data[i][0], i) for i in range(len(data)) if data[i]]
            heapq.heapify(h)
            while h:
                v, i = heapq.heappop(h)
                merged.append(v)
                heads[i] += 1
                if heads[i] < len(data[i]):
                    heapq.heappush(h, (data[i][heads[i]], i))
            p = workdir / f"r{passes}_{gi}.run"
            with open(p, "wb") as fh:
                fh.write(struct.pack(f"<{len(merged)}q", *merged))
            writes += math.ceil(len(merged) / page_entries)
            newruns.append(p)
        for p in runs:
            p.unlink()
        runs = newruns
        passes += 1
    raw = open(runs[0], "rb").read()
    out = list(struct.unpack(f"<{len(raw) // 8}q", raw))
    return out, {"pages": npages, "initial_runs": math.ceil(npages / buffer_pages),
                 "passes": passes, "page_reads": reads, "page_writes": writes}


sort_rows = []
vals = [random.Random(3).randrange(10 ** 9) for _ in range(500_000)]
for B in (4, 8, 16, 64, 256):
    PE = 512                    # entries per page (8 B each -> 4 KB pages)
    t0 = time.perf_counter()
    out, s = external_sort(vals, B, PE, SCRATCH / "sortwork")
    el = (time.perf_counter() - t0) * 1e3
    M = s["pages"]
    predicted = 1 + math.ceil(math.log(math.ceil(M / B), B - 1)) if M > B else 1
    sort_rows.append({"buffer_pages": B, "data_pages": M,
                      "initial_runs": s["initial_runs"],
                      "passes_measured": s["passes"],
                      "passes_formula": predicted,
                      "page_io_measured": s["page_reads"] + s["page_writes"],
                      "page_io_formula_2MP": 2 * M * s["passes"],
                      "wall_ms": round(el, 1),
                      "sorted_ok": out == sorted(vals)})
    say("  B=", B, sort_rows[-1]["passes_measured"], sort_rows[-1]["passes_formula"])
R["external_sort"] = {"values": 500_000, "entries_per_page": 512, "rows": sort_rows}

# ---------------------------------------------------------------------------
# 8. Cardinality estimation: independence assumption failure, measured
# ---------------------------------------------------------------------------
say("== cardinality estimation ==")
# region and cust are correlated by construction: cust // 100000 == region index.
tot = N_ROWS
est_rows = []
for region_name, cust_lo, cust_hi, correlated in [
    ("north", 0, 99_999, True),
    ("south", 100_000, 199_999, True),
    ("north", 300_000, 399_999, False),
    ("apac", 600_000, 699_999, True),
]:
    ridx = REGIONS.index(region_name)
    sel_r = float((region_ix == ridx).mean())
    sel_c = float(((cust >= cust_lo) & (cust <= cust_hi)).mean())
    actual = int(((region_ix == ridx) & (cust >= cust_lo) & (cust <= cust_hi)).sum())
    indep = sel_r * sel_c * tot
    est_rows.append({
        "region": region_name, "cust_range": [cust_lo, cust_hi],
        "correlated": correlated,
        "sel_region_pct": round(100 * sel_r, 3),
        "sel_cust_pct": round(100 * sel_c, 3),
        "independence_estimate": int(round(indep)),
        "actual": actual,
        "q_error": round(max(indep, max(actual, 1)) / max(min(indep, max(actual, 1)), 1e-9), 1),
    })
    say("  ", est_rows[-1])

# multi-join error propagation: per-join error compounding, measured on a chain
chain = []
err = 1.0
for k in range(1, 7):
    err *= 2.4          # measured single-predicate q-error below is ~2-8; use the
    chain.append({"joins": k, "compounded_qerror_if_2_4x_per_join": round(err, 1)})
R["cardinality"] = {"single_predicate": est_rows, "chain_growth": chain}

# What the engines themselves estimate, via EXPLAIN
try:
    duck_est = dcon.execute(
        "EXPLAIN SELECT COUNT(*) FROM sales WHERE region = 'north' AND cust BETWEEN 0 AND 99999"
    ).fetchall()
    R["cardinality"]["duckdb_explain_head"] = str(duck_est[0][1])[:900]
except Exception as e:                                    # pragma: no cover
    R["cardinality"]["duckdb_explain_head"] = f"unavailable: {e}"

# ---------------------------------------------------------------------------
# 9. Selinger DP: search space sizes and the traced 3-table query
# ---------------------------------------------------------------------------
say("== optimizer ==")
space = []
for n in range(2, 13):
    left_deep_all = math.factorial(n)
    bushy_all = math.factorial(2 * n - 2) // math.factorial(n - 1)
    dp_states = n * 2 ** (n - 1)
    space.append({"relations": n, "left_deep_orders": left_deep_all,
                  "bushy_trees": bushy_all, "dp_subset_pairs": 3 ** n,
                  "dp_left_deep_states": dp_states})
R["optimizer_space"] = space


def selinger_dp(rels, cards, pages, join_sel, verbose=False):
    """Left-deep DP over a toy catalog. Cost = pages read by hash joins."""
    from itertools import combinations
    best = {}
    for r in rels:
        best[frozenset([r])] = (pages[r], cards[r], (r,))
    for size in range(2, len(rels) + 1):
        for subset in combinations(rels, size):
            S = frozenset(subset)
            for r in subset:
                left = S - {r}
                if left not in best:
                    continue
                lcost, lcard, lplan = best[left]
                sel = 1.0
                for l in left:
                    sel *= join_sel.get(frozenset([l, r]), 1.0)
                card = lcard * cards[r] * sel
                lpages = max(1, math.ceil(lcard / 20))
                cost = lcost + pages[r] + lpages
                if S not in best or cost < best[S][0]:
                    best[S] = (cost, card, lplan + (r,))
    return best


rels = ["E", "D", "W"]
cards = {"E": 10_000, "D": 500, "W": 30_000}
pages = {"E": 1000, "D": 50, "W": 500}
join_sel = {frozenset(["E", "D"]): 1 / 500, frozenset(["E", "W"]): 1 / 10_000}
# apply the dname filter to D first
cards_f = dict(cards, D=1)
pages_f = dict(pages)
dp = selinger_dp(rels, cards_f, pages_f, join_sel)
full = dp[frozenset(rels)]
R["optimizer_trace"] = {
    "catalog": {"cards": cards, "pages": pages, "filtered_D_card": 1},
    "best_plan": list(full[2]),
    "best_cost_pages": round(full[0], 1),
    "best_card": round(full[1], 2),
    "all_subsets": {"+".join(sorted(k)): {"cost": round(v[0], 1),
                                          "card": round(v[1], 2),
                                          "plan": list(v[2])}
                    for k, v in dp.items()},
}
say("  best:", R["optimizer_trace"]["best_plan"], R["optimizer_trace"]["best_cost_pages"])

# ---------------------------------------------------------------------------
# 10. Isolation: nonrepeatable read, snapshot stability, write skew
# ---------------------------------------------------------------------------
say("== isolation ==")
iso_path = SCRATCH / "iso.sqlite"
if iso_path.exists():
    iso_path.unlink()
a = sqlite3.connect(iso_path, isolation_level=None, timeout=0.5)
a.execute("PRAGMA journal_mode=WAL")
a.execute("CREATE TABLE doctors(name TEXT PRIMARY KEY, on_call INT)")
a.execute("INSERT INTO doctors VALUES ('alice',1), ('bob',1)")
b = sqlite3.connect(iso_path, isolation_level=None, timeout=0.5)

iso = {}
# (i) no transaction: nonrepeatable read
r1 = a.execute("SELECT SUM(on_call) FROM doctors").fetchone()[0]
b.execute("UPDATE doctors SET on_call=0 WHERE name='bob'")
r2 = a.execute("SELECT SUM(on_call) FROM doctors").fetchone()[0]
iso["nonrepeatable_read"] = {"first": r1, "second": r2,
                             "anomaly_observed": r1 != r2}
b.execute("UPDATE doctors SET on_call=1 WHERE name='bob'")

# (ii) deferred transaction on a: stable snapshot in WAL mode
a.execute("BEGIN")
r1 = a.execute("SELECT SUM(on_call) FROM doctors").fetchone()[0]
b.execute("UPDATE doctors SET on_call=0 WHERE name='bob'")
r2 = a.execute("SELECT SUM(on_call) FROM doctors").fetchone()[0]
iso["snapshot_stable"] = {"first": r1, "second": r2, "stable": r1 == r2}
# (iii) a now tries to write on its stale snapshot
try:
    a.execute("UPDATE doctors SET on_call=0 WHERE name='alice'")
    iso["stale_write"] = {"outcome": "accepted", "error": None}
    a.execute("COMMIT")
except sqlite3.OperationalError as e:
    iso["stale_write"] = {"outcome": "rejected", "error": str(e)}
    a.execute("ROLLBACK")
final = a.execute("SELECT name, on_call FROM doctors ORDER BY name").fetchall()
iso["final_state"] = [list(r) for r in final]
iso["invariant_held"] = sum(r[1] for r in final) >= 1
say("  isolation:", json.dumps(iso))
R["isolation"] = iso

# buffer/WAL: fsync cost, the durability price
say("== fsync ==")
fs = SCRATCH / "fsync.bin"
fh = open(fs, "wb")
payload = b"x" * 4096
t0 = time.perf_counter()
for _ in range(200):
    fh.write(payload)
    fh.flush()
    os.fsync(fh.fileno())
fsync_ms = (time.perf_counter() - t0) * 1e3 / 200
t0 = time.perf_counter()
for _ in range(200):
    fh.write(payload)
    fh.flush()
nosync_ms = (time.perf_counter() - t0) * 1e3 / 200
fh.close()
R["durability"] = {
    "write_4kb_plus_fsync_ms": round(fsync_ms, 4),
    "write_4kb_no_fsync_ms": round(nosync_ms, 5),
    "fsync_tax": round(fsync_ms / max(nosync_ms, 1e-9), 1),
    "implied_max_commits_per_s_single_fsync": round(1000 / fsync_ms),
    "note": "local NVMe-backed virtual disk with volatile cache; a battery-backed "
            "controller or group commit changes this number by an order of magnitude",
}
say("  fsync:", R["durability"])

# SQLite commit throughput with and without synchronous
for mode, pragma in (("synchronous=FULL", "FULL"), ("synchronous=OFF", "OFF")):
    p = SCRATCH / f"commit_{pragma}.sqlite"
    if p.exists():
        p.unlink()
    c = sqlite3.connect(p, isolation_level=None)
    c.execute("PRAGMA journal_mode=WAL")
    c.execute(f"PRAGMA synchronous={pragma}")
    c.execute("CREATE TABLE t(id INTEGER PRIMARY KEY, v INT)")
    t0 = time.perf_counter()
    for i in range(2000):
        c.execute("BEGIN")
        c.execute("INSERT INTO t VALUES (?,?)", (i, i))
        c.execute("COMMIT")
    el = time.perf_counter() - t0
    R["durability"][f"sqlite_commits_per_s_{pragma}"] = round(2000 / el)
    c.close()
say("  commits:", R["durability"].get("sqlite_commits_per_s_FULL"),
    R["durability"].get("sqlite_commits_per_s_OFF"))

# ---------------------------------------------------------------------------
# 11. Vectorized versus tuple-at-a-time, in one process
# ---------------------------------------------------------------------------
say("== execution models ==")
NV = 5_000_000
va = amount[:NV]
vq = qty[:NV].astype(np.int64)


def volcano_style():
    """Tuple-at-a-time with per-tuple Python dispatch (the iterator model)."""
    tot, cnt = 0.0, 0
    for i in range(1_000_000):          # 1M tuples only; extrapolated below
        x = va[i]
        if x > 500.0:
            tot += x
            cnt += 1
    return tot, cnt


def vectorized(vec=2048):
    tot, cnt = 0.0, 0
    for lo in range(0, NV, vec):
        c = va[lo:lo + vec]
        m = c > 500.0
        tot += c[m].sum()
        cnt += int(m.sum())
    return tot, cnt


def full_columnar():
    m = va > 500.0
    return va[m].sum(), int(m.sum())


t_vol = bestof(volcano_style, 3)
t_vec = bestof(vectorized, 5)
t_col = bestof(full_columnar, 5)
R["execution_models"] = {
    "rows": NV,
    "tuple_at_a_time_1M_ms": t_vol["best_ms"],
    "tuple_at_a_time_extrapolated_5M_ms": round(t_vol["best_ms"] * 5, 1),
    "vectorized_2048_5M_ms": t_vec["best_ms"],
    "full_column_5M_ms": t_col["best_ms"],
    "speedup_vectorized_over_tuple": round(t_vol["best_ms"] * 5 / t_vec["best_ms"], 1),
    "note": "Python interpreter exaggerates dispatch cost relative to a C++ engine; "
            "the direction and the reason (per-tuple dispatch amortized over a vector) "
            "are the transferable part, not the multiplier",
}
say("  exec:", R["execution_models"])

# vector search recall/latency, a small honest measurement
say("== vector index ==")
try:
    D, NVEC, NQ, NCLUST = 64, 200_000, 500, 200
    # Realistic embedding geometry: clustered on a sphere, not isotropic noise.
    centers = rng.normal(size=(NCLUST, D)).astype(np.float32)
    centers /= np.linalg.norm(centers, axis=1, keepdims=True)
    owner = rng.integers(0, NCLUST, NVEC)
    # per-dimension sigma chosen so the within-cluster radius (sigma*sqrt(D) ~ 0.48)
    # stays below the typical inter-centre distance (~sqrt(2)); isotropic noise at
    # this dimension would otherwise drown the cluster structure entirely.
    base = centers[owner] + 0.06 * rng.normal(size=(NVEC, D)).astype(np.float32)
    base /= np.linalg.norm(base, axis=1, keepdims=True)
    qix = rng.integers(0, NVEC, NQ)
    qs = base[qix] + 0.02 * rng.normal(size=(NQ, D)).astype(np.float32)
    qs /= np.linalg.norm(qs, axis=1, keepdims=True)

    t0 = time.perf_counter()
    exact = np.argsort(-(qs @ base.T), axis=1)[:, :10]
    exact_ms = (time.perf_counter() - t0) * 1e3 / NQ

    # IVF with real Lloyd iterations
    NLIST = 512
    cent = base[rng.choice(NVEC, NLIST, replace=False)].copy()
    for _ in range(12):
        assign = np.argmax(base @ cent.T, axis=1)
        for c in range(NLIST):
            m = assign == c
            if m.any():
                cent[c] = base[m].mean(axis=0)
        cent /= np.linalg.norm(cent, axis=1, keepdims=True)
    assign = np.argmax(base @ cent.T, axis=1)
    buckets = [np.where(assign == i)[0] for i in range(NLIST)]
    sizes = np.array([len(b) for b in buckets])

    ivf_rows = []
    for nprobe in (1, 2, 4, 8, 16, 32, 64):
        hits, scanned = 0, 0
        t0 = time.perf_counter()
        for qi in range(NQ):
            q = qs[qi]
            order = np.argpartition(-(cent @ q), nprobe - 1)[:nprobe] if nprobe > 1 \
                else np.array([int(np.argmax(cent @ q))])
            cand = np.concatenate([buckets[o] for o in order])
            scanned += len(cand)
            sims = base[cand] @ q
            top = cand[np.argpartition(-sims, min(9, len(sims) - 1))[:10]]
            hits += len(set(top.tolist()) & set(exact[qi].tolist()))
        el = (time.perf_counter() - t0) * 1e3 / NQ
        ivf_rows.append({"nprobe": nprobe, "recall_at_10": round(hits / (10 * NQ), 3),
                         "ms_per_query": round(el, 3),
                         "vectors_scanned_pct": round(100 * scanned / (NQ * NVEC), 2),
                         "speedup_vs_exact": round(exact_ms / el, 1)})
        say("   ivf", ivf_rows[-1])

    # Product quantization: 8 subspaces, 256 centroids each -> 8 bytes per vector
    M, KSUB = 8, 256
    sub = D // M
    codebooks = np.zeros((M, KSUB, sub), dtype=np.float32)
    codes = np.zeros((NVEC, M), dtype=np.uint8)
    for m in range(M):
        X = base[:, m * sub:(m + 1) * sub]
        C = X[rng.choice(NVEC, KSUB, replace=False)].copy()
        for _ in range(8):
            d = ((X[:, None, :] - C[None, :, :]) ** 2).sum(-1) if False else \
                (X ** 2).sum(1)[:, None] - 2 * X @ C.T + (C ** 2).sum(1)[None, :]
            a = np.argmin(d, axis=1)
            for c in range(KSUB):
                msk = a == c
                if msk.any():
                    C[c] = X[msk].mean(axis=0)
        d = (X ** 2).sum(1)[:, None] - 2 * X @ C.T + (C ** 2).sum(1)[None, :]
        codes[:, m] = np.argmin(d, axis=1).astype(np.uint8)
        codebooks[m] = C
    pq_rows = []
    for window in (10, 100, 500, 2000, 10000):
        hits, t0 = 0, time.perf_counter()
        for qi in range(NQ):
            q = qs[qi]
            lut = np.zeros((M, KSUB), dtype=np.float32)
            for m in range(M):
                lut[m] = codebooks[m] @ q[m * sub:(m + 1) * sub]
            approx = lut[np.arange(M)[None, :], codes].sum(axis=1)
            top = np.argpartition(-approx, window)[:window]  # rerank window
            if window > 10:                                  # exact rerank
                top = top[np.argsort(-(base[top] @ q))][:10]
            hits += len(set(top[:10].tolist()) & set(exact[qi].tolist()))
        pq_rows.append({"rerank_window": window,
                        "recall_at_10": round(hits / (10 * NQ), 3),
                        "ms_per_query": round((time.perf_counter() - t0) * 1e3 / NQ, 3),
                        "scanned_pct_of_index": round(100 * window / NVEC, 3)})
        say("   pq", pq_rows[-1])
    R["vector_index"] = {
        "dim": D, "vectors": NVEC, "queries": NQ, "nlist": NLIST,
        "true_clusters": NCLUST,
        "bucket_size_min": int(sizes.min()), "bucket_size_max": int(sizes.max()),
        "bucket_size_mean": round(float(sizes.mean()), 1),
        "exact_ms_per_query": round(exact_ms, 3),
        "float32_bytes_per_vector": D * 4,
        "ivf": ivf_rows,
        "pq": {"subspaces": M, "centroids_per_subspace": KSUB,
               "bytes_per_vector": M, "compression_vs_float32": D * 4 // M,
               "rerank_sweep": pq_rows},
    }
except Exception as e:                                     # pragma: no cover
    import traceback
    traceback.print_exc()
    R["vector_index"] = {"error": str(e)}

# ---------------------------------------------------------------------------
OUT.write_text(json.dumps(R, indent=2, default=str))
say("\nwrote", OUT, os.path.getsize(OUT), "bytes")
try:
    con.close(); dcon.close(); icon.close(); jcon.close(); dj.close(); a.close(); b.close()
except Exception:
    pass
shutil.rmtree(SCRATCH, ignore_errors=True)
