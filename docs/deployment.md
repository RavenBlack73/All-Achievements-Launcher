# Public GitHub deployment

The launcher is configured for the public repository `RavenBlack73/All-Achievements-Launcher`.
GitHub Releases can host the Windows installer and updater metadata; no dedicated server is
required. The launcher distribution index is served from the repository's `main` branch, while
Modrinth continues to host the mods and resource packs.

## Publish the source

The public repository is `RavenBlack73/All-Achievements-Launcher`. Push the project source to
its `main` branch. Keep `distribution.json` at the repository root; the launcher reads it from
the public raw GitHub URL configured in `app/assets/js/distromanager.js`.

The 463 MB Raven's Music JAR is intentionally excluded from Git by `.gitignore`. Keep the
verified file at `bundled-mods/ravens_music-1.4.0-neoforge-26.3.jar` on the build machine.
Electron Builder embeds it as an extra resource in each installer. Consequently, a fresh source
checkout needs that JAR restored locally before it can produce a complete installer.

## Build and publish a release

On the build machine, with Node.js 22 and the Raven's Music JAR in place, run:

```powershell
npm ci
npx eslint . --rule '@stylistic/linebreak-style: off' --rule '@stylistic/semi: off'
npm run dist:win
```

Test the installer on a clean Windows account or PC before distributing it. For each release,
increment `version` in `package.json`, rebuild, then create a GitHub Release with a matching tag
(for example, `v2.2.2`). Upload the generated installer, `latest.yml`, and any generated
`.blockmap` file from `dist`. The repository must stay public so `electron-updater` can read
release metadata without a token. GitHub Actions runs lint checks only; release installers are
built locally because the large Raven's Music JAR is not stored in the repository.

Windows x64 is the currently tested target. macOS and Linux targets are defined in the builder
configuration but require platform-specific builds and testing before those installers are
offered.

## Keep the profile current

Commit changes to `modrinth.index.json`, `pack.index.json`, or `distribution.json` to `main`.
Mods and resource packs are downloaded by clients from their Modrinth URLs and checked against
the hashes in the indexes. The NeoForge profile, server address, and bundled Raven's Music
checksum are maintained in the launcher source. A change to the application itself requires a
new installer and GitHub Release.
