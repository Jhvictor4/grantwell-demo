from __future__ import annotations
import argparse
import asyncio
from .service import run_many_states
from .db import init_db


def main():
    parser = argparse.ArgumentParser(description="Run US Security Grants Monitor once")
    parser.add_argument("--states", nargs="*", help="Optional list of state codes (e.g., NY CA TX). If omitted, run all.")
    parser.add_argument("--concurrency", type=int, default=None)
    args = parser.parse_args()

    init_db(prepopulate_states=True)

    results = asyncio.run(run_many_states(state_codes=args.states))
    for code, ok, err, n in results:
        status = "OK" if ok else f"ERR: {err}"
        print(f"{code}: {status} - {n} grants")


if __name__ == "__main__":
    main()