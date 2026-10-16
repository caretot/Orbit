#!/usr/bin/env python3
"""
ORBIT library builder
---------------------
Scans MUSIC/, COVERS/, LYR/, PLAYLISTS/ and writes library.js, which the website reads.
Runs automatically on GitHub (see .github/workflows) or locally:  python build_library.py

Everything about a song comes from its FILE NAME:

    Song-Name_Artist-Name_day_month_year_Genre.mp3
    Bomba-Xeyallar_Fuad-Ildarov_4_November_2025_Pop.mp3
      -> title "Bomba Xeyallar", artist "Fuad Ildarov", released 4 November 2025, genre "Pop"

  * "_" separates the parts, "-" becomes a space, "--" becomes a real hyphen.
  * Several artists: join them with "&"   e.g.  Song_Artist-One&Artist-Two_1_May_2026_Rap
  * Shorter forms also work:  Song_Artist   /   Song_Artist_2026   /   Song_Artist_2026_Pop
  * Month: January..December, Jan..Dec, 1..12 or Azerbaijani (Yanvar..Dekabr).

Images (same name, .jpg/.png/.webp):
  COVERS/songs/<song file name>.jpg      COVERS/artists/<Artist Name>.jpg
  COVERS/playlists/<playlist file name>.jpg
Lyrics: LYR/<song file name>.txt
Files whose name starts with "_" are ignored everywhere.
"""
import hashlib, json, os, re, subprocess, sys, unicodedata
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
D = lambda *p: os.path.join(ROOT, *p)
AUDIO_EXT = {".mp3", ".m4a", ".aac", ".mp4", ".wav", ".ogg", ".oga", ".opus", ".flac", ".webm"}
IMG_EXT = (".jpg", ".jpeg", ".png", ".webp")

MONTHS = {}
for i, names in enumerate([
    ("january", "jan", "yanvar"), ("february", "feb", "fevral"), ("march", "mar", "mart"),
    ("april", "apr", "aprel"), ("may", "may"), ("june", "jun", "iyun", "i̇yun"),
    ("july", "jul", "iyul", "i̇yul"), ("august", "aug", "avqust"), ("september", "sep", "sept", "sentyabr"),
    ("october", "oct", "oktyabr"), ("november", "nov", "noyabr"), ("december", "dec", "dekabr")], 1):
    for n in names:
        MONTHS[n] = i
MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August",
               "September", "October", "November", "December"]

try:
    import mutagen  # optional, only used to read the song LENGTH
except Exception:
    mutagen = None

warnings = []


def rel(path):
    return os.path.relpath(path, ROOT).replace(os.sep, "/")


def key(s):
    """loose matching key: case/accents/-/_/spaces ignored"""
    s = unicodedata.normalize("NFKD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "", s)


def uid(prefix, raw):
    s = unicodedata.normalize("NFKD", raw).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower() or "item"
    return f"{s[:40]}-{hashlib.md5((prefix + raw).encode()).hexdigest()[:5]}"


def words(part):
    return re.sub(r"\s+", " ", part.replace("--", "\u0000").replace("-", " ").replace("\u0000", "-")).strip()


def parse_name(stem):
    """returns dict(title, artists, year, date, dateText, genre) or None"""
    parts = [p for p in stem.split("_")]
    if len(parts) < 2:
        m = re.match(r"^(.+?) - (.+?)(?:\s*[\(\[]((?:19|20)\d{2})[\)\]])?$", stem)  # legacy "Artist - Title (2026)"
        if not m:
            return None
        return dict(title=m.group(2).strip(), artists=[a.strip() for a in re.split(r"\s*(?:,|&)\s*", m.group(1)) if a.strip()],
                    year=int(m.group(3)) if m.group(3) else None, date=None, dateText=m.group(3), genre=None)
    title, artist, rest = words(parts[0]), parts[1], parts[2:]
    artists = [words(a) for a in re.split(r"[&+,]", artist) if words(a)] or ["Unknown artist"]
    year = date = text = genre = None
    if len(rest) >= 3 and rest[0].isdigit() and rest[2].isdigit() and len(rest[2]) == 4:
        d = int(rest[0]); mo = MONTHS.get(rest[1].lower()) or (int(rest[1]) if rest[1].isdigit() else None); y = int(rest[2])
        if mo and 1 <= mo <= 12 and 1 <= d <= 31:
            year, date, text = y, f"{y:04d}-{mo:02d}-{d:02d}", f"{d} {MONTH_NAMES[mo - 1]} {y}"
            rest = rest[3:]
        else:
            warnings.append(f'Could not read the date in "{stem}"')
            rest = rest[3:]
    elif len(rest) >= 2 and rest[1].isdigit() and len(rest[1]) == 4 and MONTHS.get(rest[0].lower()):  # month_year
        mo, y = MONTHS[rest[0].lower()], int(rest[1])
        year, date, text = y, f"{y:04d}-{mo:02d}-01", f"{MONTH_NAMES[mo - 1]} {y}"
        rest = rest[2:]
    elif rest and rest[0].isdigit() and len(rest[0]) == 4:
        year, text = int(rest[0]), rest[0]
        rest = rest[1:]
    if rest:
        genre = words(" ".join(rest))
    return dict(title=title, artists=artists, year=year, date=date, dateText=text, genre=genre)


def git_added_date(path):
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


def image_index(folder):
    idx = {}
    if os.path.isdir(folder):
        for fn in os.listdir(folder):
            st, ext = os.path.splitext(fn)
            if ext.lower() in IMG_EXT and not fn.startswith(("_", ".")):
                idx[key(st)] = rel(os.path.join(folder, fn))
    return idx


def duration(path):
    if not mutagen:
        return None
    try:
        f = mutagen.File(path)
        return round(float(f.info.length)) if f and getattr(f, "info", None) else None
    except Exception:
        return None


def build_songs():
    song_covers = {**image_index(D("COVERS")), **image_index(D("COVERS", "songs"))}
    songs = []
    for dirpath, _, files in os.walk(D("MUSIC")):
        for fn in sorted(files):
            stem, ext = os.path.splitext(fn)
            if ext.lower() not in AUDIO_EXT or fn.startswith(("_", ".")):
                continue
            path = os.path.join(dirpath, fn)
            info = parse_name(stem)
            if not info:
                warnings.append(f'Name not in the expected format, used as title only: "{fn}"')
                info = dict(title=words(stem), artists=["Unknown artist"], year=None, date=None, dateText=None, genre=None)
            lyr = D("LYR", stem + ".txt")
            songs.append({
                "id": uid("s", rel(path)),
                "file": rel(path),
                "title": info["title"],
                "artist": ", ".join(info["artists"]),
                "artists": info["artists"],
                "year": info["year"],
                "date": info["date"],
                "dateText": info["dateText"],
                "genre": info["genre"],
                "duration": duration(path),
                "added": file_date(path),
                "cover": song_covers.get(key(stem)),
                "lyrics": read_text(lyr) if os.path.exists(lyr) else None,
                "_stem": stem,
            })
    songs.sort(key=lambda s: (s["artist"].lower(), s["title"].lower()))
    return songs


def build_artists(songs):
    covers = image_index(D("COVERS", "artists"))
    out = {}
    for s in songs:
        for a in s["artists"]:
            if a not in out and covers.get(key(a)):
                out[a] = {"cover": covers[key(a)]}
    return out


def build_playlists(songs):
    covers = image_index(D("COVERS", "playlists"))
    covers.update({k: v for k, v in image_index(D("PLAYLISTS")).items()})
    by = {}
    for s in songs:
        for k in (s["_stem"], s["file"], os.path.basename(s["file"]), s["title"], f'{s["title"]} {s["artist"]}'):
            by.setdefault(key(k), s)
    out = []
    folder = D("PLAYLISTS")
    if not os.path.isdir(folder):
        return out
    for fn in sorted(os.listdir(folder)):
        if not fn.lower().endswith(".txt") or fn.startswith(("_", ".")):
            continue
        stem = os.path.splitext(fn)[0]
        pl = {"id": uid("p", stem), "title": stem, "description": "", "section": None, "cover": None, "created": None, "songs": []}
        for raw in read_text(os.path.join(folder, fn)).splitlines():
            line = raw.strip()
            if not line:
                continue
            if line.startswith("#"):
                m = re.match(r"#\s*(\w+)\s*:\s*(.*)$", line)
                if m and m.group(1).lower() in ("title", "description", "section", "cover", "created"):
                    pl[m.group(1).lower()] = m.group(2).strip() or None
                continue
            rule = re.match(r"^(artist|genre|year)\s*:\s*(.+)$", line, re.I)
            if rule:
                k, v = rule.group(1).lower(), key(rule.group(2))
                for s in songs:
                    hit = (k == "artist" and any(key(a) == v for a in s["artists"])) or \
                          (k == "genre" and key(s["genre"] or "") == v) or (k == "year" and str(s["year"] or "") == v)
                    if hit and s["id"] not in pl["songs"]:
                        pl["songs"].append(s["id"])
                continue
            if line == "*":
                pl["songs"] += [s["id"] for s in songs if s["id"] not in pl["songs"]]
                continue
            s = by.get(key(os.path.splitext(line)[0] if os.path.splitext(line)[1].lower() in AUDIO_EXT else line))
            if s:
                if s["id"] not in pl["songs"]:
                    pl["songs"].append(s["id"])
            else:
                warnings.append(f'Playlist "{fn}": song not found -> "{line}"')
        if pl["cover"] and not os.path.exists(D(pl["cover"])):
            warnings.append(f'Playlist "{fn}": cover not found -> {pl["cover"]}')
            pl["cover"] = None
        pl["cover"] = pl["cover"] or covers.get(key(stem))
        pl["created"] = pl["created"] or file_date(os.path.join(folder, fn))
        out.append(pl)
    return out


def main():
    for d in ("MUSIC", "COVERS/songs", "COVERS/artists", "COVERS/playlists", "LYR", "PLAYLISTS"):
        os.makedirs(D(d), exist_ok=True)
    songs = build_songs()
    playlists = build_playlists(songs)
    artists = build_artists(songs)
    for s in songs:
        s.pop("_stem")
    data = {"generated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "songs": songs, "artists": artists, "playlists": playlists}
    with open(D("library.js"), "w", encoding="utf-8") as f:
        f.write("/* AUTO-GENERATED by build_library.py - do not edit by hand */\n")
        f.write("window.LIBRARY = " + json.dumps(data, ensure_ascii=False, indent=1) + ";\n")
    print(f"library.js written: {len(songs)} songs, {len(artists)} artist photos, {len(playlists)} playlists")
    for w in warnings:
        print("WARNING:", w)


if __name__ == "__main__":
    sys.exit(main())
