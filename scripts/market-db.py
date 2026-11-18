"""Private, rebuildable SQLite index of Auction Desk history and comparable observations."""
import argparse
import json
import sqlite3
from pathlib import Path


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sync(db, history, cache):
    if not cache.is_dir():
        raise ValueError("Cache directory does not exist")
    with db:
        for run in read(history / "index.json")["runs"]:
            report = read(history / (run["id"] + ".json"))
            if report["id"] != run["id"]:
                raise ValueError("History index and report ID disagree")
            body = json.dumps(report, ensure_ascii=False)
            db.execute("INSERT OR REPLACE INTO reports VALUES (?, ?, ?)",
                       (report["id"], report["researchedOn"], body))
        for path in sorted(cache.glob("*.json")):
            # Production captures use a dated filename. Skip test fixtures and generated exports.
            if not path.name[:4].isdigit():
                continue
            data = read(path)
            if not isinstance(data, dict):
                continue
            if not isinstance(data.get("comps"), list):
                if any(key in data for key in ("cis", "tc", "pages", "scan")):
                    db.execute("INSERT OR REPLACE INTO captures VALUES (?, ?)",
                               (path.name, json.dumps(data, ensure_ascii=False)))
                continue
            for row in data.get("comps", []):
                body = json.dumps(row, ensure_ascii=False, sort_keys=True)
                db.execute("INSERT OR IGNORE INTO observations VALUES (?, ?, ?)",
                           (body, row["model"], row["observedAt"]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", type=Path, default=Path("market-cache/market.sqlite3"))
    commands = parser.add_subparsers(dest="command", required=True)
    ingest = commands.add_parser("sync")
    ingest.add_argument("history", type=Path)
    ingest.add_argument("cache", type=Path)
    lookup = commands.add_parser("find")
    lookup.add_argument("term")
    lookup.add_argument("--summary", action="store_true", help="Print match counts without individual records")
    export = commands.add_parser("export")
    export.add_argument("output", type=Path)
    args = parser.parse_args()
    args.db.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(args.db) as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, day TEXT, body TEXT);
            CREATE TABLE IF NOT EXISTS observations(body TEXT PRIMARY KEY, model TEXT, observed_at TEXT);
            CREATE TABLE IF NOT EXISTS captures(filename TEXT PRIMARY KEY, body TEXT);
            CREATE INDEX IF NOT EXISTS observation_model ON observations(model);
        """)
        if args.command == "sync":
            sync(db, args.history, args.cache)
            for table in ("reports", "observations", "captures"):
                print(table, db.execute(f"SELECT count(*) FROM {table}").fetchone()[0])
        elif args.command == "find" and args.summary:
            counts = {}
            for table in ("reports", "captures", "observations"):
                counts[table] = db.execute(
                    f"SELECT count(*) FROM {table} WHERE instr(body, ?)", (args.term,)
                ).fetchone()[0]
            print(json.dumps(counts))
        elif args.command == "find":
            for day, key, body in db.execute("SELECT day,id,body FROM reports WHERE instr(body,?) ORDER BY day DESC", (args.term,)):
                print(day, key, json.loads(body)["title"])
            for (name,) in db.execute("SELECT filename FROM captures WHERE instr(body,?) ORDER BY filename", (args.term,)):
                print("capture", name)
            for (body,) in db.execute("SELECT body FROM observations WHERE instr(body,?) ORDER BY observed_at DESC", (args.term,)):
                row = json.loads(body)
                print(row["model"], row["venue"], row["auctionDate"], row["lot"], row["status"], row["price"], row["observedAt"])
        else:
            rows = [json.loads(body) for (body,) in db.execute("SELECT body FROM observations ORDER BY observed_at DESC,body")]
            args.output.write_text(json.dumps({"comps": rows}, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
