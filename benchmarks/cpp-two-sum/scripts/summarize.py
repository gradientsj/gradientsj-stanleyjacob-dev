#!/usr/bin/env python3
import csv
import json
import pathlib
import sys


def rows(document):
    for entry in document["benchmarks"]:
        name = entry["name"]
        if "_median" not in name:
            continue
        base_name = name.removesuffix("_median")
        implementation, size = base_name.rsplit("/", maxsplit=1)
        yield {
            "implementation": implementation,
            "size": int(size),
            "cpu_time_ns": entry["cpu_time"],
        }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: summarize.py INPUT.json OUTPUT.csv")

    source = pathlib.Path(sys.argv[1])
    destination = pathlib.Path(sys.argv[2])
    data = sorted(
        rows(json.loads(source.read_text())),
        key=lambda row: (row["implementation"], row["size"]),
    )
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", newline="") as stream:
        writer = csv.DictWriter(
            stream,
            fieldnames=data[0].keys(),
            lineterminator="\n",
        )
        writer.writeheader()
        writer.writerows(data)


if __name__ == "__main__":
    main()
