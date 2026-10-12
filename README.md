# ORBIT: private music player for friends

A static music-streaming website. It runs entirely on GitHub Pages: no server, no accounts and no database.
You upload the song files. Your friends open the link and listen.

## 1. Folder

```
AAA/
├── index.html  styles.css  app.js  sw.js     the app (don't need to touch)
├── config.js         ← app name, contact, about, terms, default colours  (EDIT)
├── meta.csv          ← optional: album / genre / year per song           (EDIT)
├── MUSIC/            ← song files
├── COVERS/           ← cover images (same name as the song)
├── LYR/              ← lyrics .txt (same name as the song)
├── PLAYLISTS/        ← one .txt file = one playlist
├── library.js        AUTO-GENERATED list of everything (never edit)
├── build_library.py  generates library.js
├── deploy-workflow.yml   visible copy of .github/workflows/deploy.yml
└── manifest.webmanifest + icons/   "Add to Home Screen" app icon
```
The demo songs are short placeholder tones. Delete them when you add your real music.

## 2. Adding music

**Song:** `MUSIC/Artist - Title (Year).mp3`
(several artists: `Artist A, Artist B - Title (2025).mp3`; a subfolder = an album).
Use `.mp3` or `.m4a`. Each file must be **under 25 MB** when uploaded through github.com.

**Cover:** `COVERS/Artist - Title (Year).jpg` (same name, square, 500–1000 px).

**Lyrics:** `LYR/Artist - Title (Year).txt`, plain text, saved as UTF-8 so letters like ə, ğ and ş display correctly.

**Extra info (optional):** one row per song in `meta.csv`. Leave the cells you don't need empty.

**Playlist:** `PLAYLISTS/Night Drive.txt`
```
# title: Night Drive
# description: Late-night highway songs
# section: Made for the road        ← home-page row (e.g. Fans of X)
# created: 2026-10-12
Neon Harbor - Midnight Lanes (2026)
artist: Lumen Vale                  ← every song by this artist
genre: Synthwave                    ← every song of this genre
year: 2026                          ← every song from 2026
```

## 3. Publish on GitHub (one time)

1. Create a **Public** repository on github.com (e.g. `orbit`).
2. Choose **Add file → Upload files**, drag in everything from this folder, then click **Commit**.
3. The `.github` folder is hidden on Mac and Windows, so create it by hand:
   **Add file → Create new file**, name it `.github/workflows/deploy.yml`, paste in the contents of `deploy-workflow.yml`, and commit.
4. Go to **Settings → Pages → Source: GitHub Actions**.
5. Wait for the green tick in **Actions**. Your site is `https://YOUR-USERNAME.github.io/orbit/`

To add songs later, upload them to `MUSIC/` and commit. The site rebuilds itself in about a minute.
Limits: GitHub recommends keeping the repo under about 1 GB, the published site can't exceed 1 GB, and bandwidth has a soft limit of about 100 GB per month.

## 4. Colours

The default palette is **Midnight Gold** (#000000 · #14213D · #FCA311 · #E5E5E5 · #FFFFFF).
Listeners can switch between 6 palettes (Midnight Gold, Deep Ocean, Ember, Aurora, Forest, Mono),
each with a dark and a light mode, from the logo menu or from Settings.
To change the default for everyone, edit `defaultPalette` / `defaultMode` in `config.js`.

## 5. Sharing

* **Songs, official playlists, artists, albums:** the share link opens the same page for your friend.
* **Your own playlists and Liked Songs:** the song list is packed into the link. Your friend opens it and taps **Save** to keep a copy.
  It's a snapshot: if you change the playlist later, send a new link.
* Renaming a song file breaks old links to that song.

## 6. Where data is stored

Likes, your own playlists, history, settings and downloads are saved **only on each listener's own device**, and they survive refreshing the page.
On iPhone, tell friends to use **Add to Home Screen**: Safari can delete a website's saved data if the site isn't opened for about a week.

> Only upload music you have the right to share. A public repo means anyone with the link can access the files.
