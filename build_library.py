#!/usr/bin/env python3
"""
ORBIT library builder
---------------------
Scans MUSIC/, COVERS/, LYR/, PLAYLISTS/ and meta.csv, then writes library.js
which the website reads. Runs automatically on GitHub (see .github/workflows),
or locally with:  python build_library.py

Naming rules (no coding needed):
  MUSIC/Artist - Title (2026).mp3     -> artist, title, year read from the name
  COVERS/Artist - Title (2026).jpg    -> cover with the SAME name as the song
  LYR/Artist - Title (2026).txt       -> lyrics with the SAME name as the song
  meta.csv (optional)                 -> override title/artist/album/year/genre/added
  PLAYLISTS/Any name.txt              -> one playlist per file (see README)
"""
import csv, hashlib, json, os, re, subprocess, sys, unicodedata
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
MUSIC, COVERS, LYR, PLAYLISTS = (os.path.join(ROOT, d) for d in ("MUSIC", "COVERS", "LYR", "PLAYLISTS"))
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".mp4", ".wav", ".ogg", ".oga", ".opus", ".flac", ".webm"}
IMG_EXT = [".jpg", ".jpeg", ".png", ".webp"]

try:
    import mutagen  # optional: reads tags + duration if installed (pip install mutagen)
except Exception:
    mutagen = None

warnings = []


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "item"


def uid(prefix, key, label=None):
    return f"{slug(label or key)[:40]}-{hashlib.md5((prefix + key).encode()).hexdigest()[:5]}"


def git_added_date(path):
    """First commit date of a file (works on GitHub Actions with fetch-depth: 0)."""
    try:
        out = subprocess.run(["git", "log", "--diff-filter=A", "--follow", "--format=%aI", "--", path],
                             cwd=ROOT, capture_output=True, text=True, timeout=20).stdout.strip().splitlines()
        if out:
            return out[-1][:10]
    except Exception:
        pass
    return None


def file_date(path):
    return git_added_date(path) or datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d")


def read_text(path):
    for enc in ("utf-8-sig", "cp1251", "latin-1"):
        try:
            with open(path, encoding=enc) as f:
                return f.read().strip()
        except UnicodeDecodeError:
            continue
    return ""


def parse_name(stem):
    """'Artist A, Artist B - Title (2026)' -> (artist, title, year)"""
    year = None
    m = re.search(r"[\(\[]((?:19|20)\d{2})[\)\]]\s*$", stem)
    if m:
        year = int(m.group(1))
        stem = stem[: m.start()].strip()
    if " - " in stem:
        artist, title = stem.split(" - ", 1)
    else:
        artist, title = "Unknown artist", stem
    return artist.strip(), title.strip(), year


def split_artists(a):
    parts = re.split(r"\s*(?:,|&| x | feat\.? | ft\.? | featuring )\s*", a, flags=re.I)
    return [p.strip() for p in parts if p.strip()] or ["Unknown artist"]


def read_tags(path):
    info = {}
    if not mutagen:
        return info
    try:
        f = mutagen.File(path, easy=True)
        if f is None:
            return info
        if getattr(f, "info", None) and getattr(f.info, "length", None):
            info["duration"] = round(float(f.info.length))
        tags = f.tags or {}
        def first(k):
            v = tags.get(k)
            return (v[0] if isinstance(v, list) and v else v) or None
        if first("title"): info["title"] = str(first("title"))
        if first("artist"): info["artist"] = str(first("artist"))
        if first("album"): info["album"] = str(first("album"))
        if first("genre"): info["genre"] = str(first("genre"))
        d = first("date")
        if d and re.match(r"^\d{4}", str(d)): info["year"] = int(str(d)[:4])
    except Exception as e:
        warnings.append(f"tag read failed for {rel(path)}: {e}")
    return info


def load_meta():
    path = os.path.join(ROOT, "meta.csv")
    meta = {}
    if not os.path.exists(path):
        return meta
    with open(path, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            key = (row.get("file") or "").strip()
            if not key or key.startswith("#"):
                continue
            meta[os.path.splitext(key)[0].lower() if os.path.splitext(key)[1].lower() in AUDIO_EXT else key.lower()] = \
                {k: (v or "").strip() for k, v in row.items() if k and k != "file"}
    return meta


def find_cover(stem, folder):
    for d in (COVERS, folder):
        for ext in IMG_EXT:
            p = os.path.join(d, stem + ext)
            if os.path.exists(p):
                return rel(p)
    if folder != MUSIC:  # album folder art
        for name in ("cover", "folder", "Cover", "Folder"):
            for ext in IMG_EXT:
                p = os.path.join(folder, name + ext)
                if os.path.exists(p):
                    return rel(p)
    return None


def build_songs():
    meta = load_meta()
    songs = []
    for dirpath, _, files in os.walk(MUSIC):
        for fn in sorted(files):
            stem, ext = os.path.splitext(fn)
            if ext.lower() not in AUDIO_EXT or fn.startswith("."):
                continue
            path = os.path.join(dirpath, fn)
            artist, title, year = parse_name(stem)
            album = os.path.basename(dirpath) if dirpath != MUSIC else None
            song = {"title": title, "artist": artist, "album": album, "year": year, "genre": None, "duration": None}
            song.update({k: v for k, v in read_tags(path).items() if v})
            m = meta.get(stem.lower()) or {}
            for k in ("title", "artist", "album", "genre", "added"):
                if m.get(k):
                    song[k] = m[k]
            if m.get("year", "").isdigit():
                song["year"] = int(m["year"])
            lyr_path = os.path.join(LYR, stem + ".txt")
            song.update({
                "id": uid("s", rel(path), stem),
                "file": rel(path),
                "artists": split_artists(song["artist"]),
                "album": song.get("album") or song["title"],  # singles act as their own album
                "added": song.get("added") or file_date(path),
                "cover": find_cover(stem, dirpath),
                "lyrics": read_text(lyr_path) if os.path.exists(lyr_path) else None,
                "_stem": stem.lower(),
                "_fn": fn.lower(),
            })
            songs.append(song)
    songs.sort(key=lambda s: (s["artist"].lower(), s["title"].lower()))
    return songs


def build_playlists(songs):
    playlists = []
    if not os.path.isdir(PLAYLISTS):
        return playlists
    by_name = {}
    for s in songs:
        by_name[s["_stem"]] = s
        by_name[s["_fn"]] = s
        by_name[s["file"].lower()] = s
        by_name[f'{s["artist"]} - {s["title"]}'.lower()] = s
    for fn in sorted(os.listdir(PLAYLISTS)):
        if not fn.lower().endswith(".txt"):
            continue
        path = os.path.join(PLAYLISTS, fn)
        stem = os.path.splitext(fn)[0]
        pl = {"id": uid("p", stem), "title": stem, "description": "", "section": None,
              "cover": None, "created": None, "songs": []}
        for raw in read_text(path).splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("#"):
                m = re.match(r"#\s*(\w+)\s*:\s*(.*)$", line)
                if m and m.group(1).lower() in ("title", "description", "section", "cover", "created"):
                    pl[m.group(1).lower()] = m.group(2).strip() or None
                continue
            rule = re.match(r"^(artist|genre|year|album)\s*:\s*(.+)$", line, re.I)
            if rule:
                key, val = rule.group(1).lower(), rule.group(2).strip().lower()
                for s in songs:
                    hit = (key == "artist" and any(a.lower() == val for a in s["artists"])) or \
                          (key == "genre" and (s.get("genre") or "").lower() == val) or \
                          (key == "year" and str(s.get("year") or "") == val) or \
                          (key == "album" and (s.get("album") or "").lower() == val)
                    if hit and s["id"] not in pl["songs"]:
                        pl["songs"].append(s["id"])
                continue
            if line == "*":
                pl["songs"] += [s["id"] for s in songs if s["id"] not in pl["songs"]]
                continue
            s = by_name.get(line.lower()) or by_name.get(os.path.splitext(line)[0].lower())
            if s:
                if s["id"] not in pl["songs"]:
                    pl["songs"].append(s["id"])
            else:
                warnings.append(f'Playlist "{fn}": song not found -> "{line}"')
        if pl["cover"] and not os.path.exists(os.path.join(ROOT, pl["cover"])):
            warnings.append(f'Playlist "{fn}": cover not found -> {pl["cover"]}')
            pl["cover"] = None
        if not pl["cover"]:
            for ext in IMG_EXT:
                p = os.path.join(PLAYLISTS, stem + ext)
                if os.path.exists(p):
                    pl["cover"] = rel(p)
        pl["created"] = pl["created"] or file_date(path)
        playlists.append(pl)
    return playlists


def main():
    for d in (MUSIC, COVERS, LYR, PLAYLISTS):
        os.makedirs(d, exist_ok=True)
    songs = build_songs()
    playlists = build_playlists(songs)
    for s in songs:
        s.pop("_stem"); s.pop("_fn")
    data = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "songs": songs, "playlists": playlists}
    with open(os.path.join(ROOT, "library.js"), "w", encoding="utf-8") as f:
        f.write("/* AUTO-GENERATED by build_library.py - do not edit by hand */\n")
        f.write("window.LIBRARY = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    print(f"library.js written: {len(songs)} songs, {len(playlists)} playlists"
          + ("" if mutagen else "  (tip: pip install mutagen to also read tags/durations)"))
    for w in warnings:
        print("WARNING:", w)


if __name__ == "__main__":
    sys.exit(main())
