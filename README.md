# ORBIT v1.2: private music player for friends

A static music website on GitHub Pages: no server and no accounts.
**Upload this AAA folder to GitHub.** Keep the `PRIVATE` folder and `vault-maker.html` on your laptop only.

## 1. Song file names: all details come from the name

```
Song-Name_Artist-Name_day_month_year_Genre.mp3
Bomba-Xeyallar_Fuad-Ildarov_4_November_2025_Pop.mp3
```
That name gives: title **Bomba Xeyallar**, artist **Fuad Ildarov**, released **4 November 2025**, genre **Pop**.

* `_` separates the parts and `-` becomes a space. To keep a real hyphen, use `--` (e.g. `Jay--Z`).
* Several artists: join them with `&`, e.g. `Song_Artist-One&Artist-Two_1_May_2026_Rap.mp3`
* Shorter forms also work: `Song_Artist`, `Song_Artist_2026` or `Song_Artist_2026_Pop`.
* Months can be English (`November`, `Nov`), numbers (`11`) or Azerbaijani (`Noyabr`).
* Use `.mp3` or `.m4a`, **under 25 MB** each (the github.com upload limit).

## 2. Folders

```
MUSIC/                 songs
LYR/                   lyrics: same name as the song, .txt (UTF-8)
COVERS/songs/          song cover:      same name as the song   .jpg/.png/.webp
COVERS/artists/        artist photo:    Fuad Ildarov.jpg  (or Fuad-Ildarov.jpg)
COVERS/playlists/      playlist cover:  same name as the playlist file, e.g. Night Drive.jpg
PLAYLISTS/             one .txt file per playlist
VAULT/                 encrypted premium content (made by vault-maker.html)
config.js              app name, contact, default colours
```
Files whose name starts with `_` (like `_README.txt`) are ignored.
Square images of 500–1000 px work best. Songs and artists without an image get a calm grey placeholder.

**Playlist file** `PLAYLISTS/Night Drive.txt`:
```
# title: Night Drive
# description: Late-night highway songs
# section: Made for the road          ← the home-page row it appears in (e.g. Fans of X)
Bomba-Xeyallar_Fuad-Ildarov_4_November_2025_Pop
artist: Fuad Ildarov                  ← every song by this artist
genre: Pop                            ← every song of this genre
year: 2025                            ← every song from 2025
```

## 3. Premium (password-protected, hidden content)

On GitHub, anyone can open any file in a public repository, and other branches are just as public.
A free GitHub Pages site can't use a private repository. So hidden content is **encrypted** instead:

1. Put the hidden songs, lyrics, covers and playlists in **`PRIVATE/`** on your laptop. It uses the same folders and naming as above. **Never upload PRIVATE.**
2. Open **`vault-maker.html`** in Chrome or Edge, enter the password, choose the `PRIVATE` folder, and click **Encrypt**. You get `VAULT.zip`.
3. Unzip it, then upload the **`VAULT`** folder to the repository (Add file → Upload files → drag the folder in → Commit).

On GitHub, VAULT only contains files like `4422b3e85a0f….bin`: encrypted data with no song names, artists or audio that anyone can read.
**The password is not stored anywhere on GitHub**, and not inside any file.

Listeners unlock it in **Settings → Premium** (at the bottom). Each device remembers it, so they only enter it once.
"Lock premium on this device" removes it again.

When you add hidden songs later, run the Vault Maker again with the **same password** and upload the new `VAULT` folder.
Existing files are replaced automatically. Old leftover `.bin` files are harmless.

Limits worth knowing:
* Anyone you give the password to can listen to (and technically save) the songs.
* People can see roughly how many encrypted files exist and their sizes, but not what they are.
* A long password (like the one you chose) makes guessing impractical.

## 4. Publish / update

Upload files on github.com and commit. GitHub Actions rebuilds the site in about a minute.
`.github/workflows/deploy.yml` must exist in the repo; `deploy-workflow.yml` is a visible copy of it.

## 5. Colours

The default palette is **Evergreen** (#121212 · #2A2A2A · #1DB954 · #B3B3B3 · #FFFFFF).
Listeners can pick 7 palettes (each with a dark and a light mode) in Settings.
To change the default for everyone, edit `defaultPalette` in `config.js`.

## 6. Where listener data is stored

Likes, their own playlists, history, settings, downloads and the premium unlock are saved **only on each listener's own device**.
On iPhone, use **Add to Home Screen**: Safari can delete a website's saved data if the site isn't opened for about a week.
