#!/usr/bin/env python3
"""Regenere les polices auto-hebergees depuis Google Fonts.

Telecharge les woff2 dans fonts/ et reecrit css/fonts.css avec des chemins
locaux. Ne garde que les sous-ensembles latin + latin-ext (l'app est en
francais). Une police variable partageant un meme fichier entre plusieurs
graisses n'est telechargee qu'une fois.

    python scripts/fetch-fonts.py      (ou : npm run fetch:fonts)
"""

import os
import re
import urllib.request
from collections import defaultdict

CSS_URL = (
    "https://fonts.googleapis.com/css2"
    "?family=Fredoka:wght@400;600;700"
    "&family=Space+Mono:wght@400;700"
    "&display=swap"
)
# Google Fonts ne sert du woff2 qu'aux UA modernes.
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
KEEP_SUBSETS = {"latin", "latin-ext"}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def fetch_css() -> str:
    req = urllib.request.Request(CSS_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req) as r:
        return r.read().decode("utf-8")


def parse_faces(css: str) -> list[dict]:
    blocks = re.findall(r"(?:/\*\s*([a-z-]+)\s*\*/\s*)?@font-face\s*\{(.*?)\}", css, re.S)
    faces = []
    for subset, body in blocks:
        if subset not in KEEP_SUBSETS:
            continue
        faces.append(
            dict(
                subset=subset,
                fam=re.search(r"font-family:\s*'([^']+)'", body).group(1),
                wght=re.search(r"font-weight:\s*([\d ]+);", body).group(1).strip(),
                style=re.search(r"font-style:\s*(\w+);", body).group(1),
                url=re.search(r"url\((https://[^)]+\.woff2)\)", body).group(1),
                urange=re.search(r"unicode-range:\s*([^;]+);", body).group(1).strip(),
            )
        )
    if not faces:
        raise SystemExit("Aucune @font-face exploitable : l'API Google Fonts a change ?")
    return faces


def main() -> None:
    faces = parse_faces(fetch_css())

    # Une URL partagee par plusieurs graisses => police variable => nom sans graisse.
    weights_per_url = defaultdict(set)
    for f in faces:
        weights_per_url[f["url"]].add(f["wght"])

    fonts_dir = os.path.join(ROOT, "fonts")
    os.makedirs(fonts_dir, exist_ok=True)

    seen: dict[str, str] = {}
    rules = []
    for f in faces:
        if f["url"] not in seen:
            slug = f["fam"].lower().replace(" ", "-")
            variable = len(weights_per_url[f["url"]]) > 1
            name = f"{slug}-{f['subset']}.woff2" if variable else f"{slug}-{f['wght']}-{f['subset']}.woff2"
            if name in seen.values():
                raise SystemExit(f"Collision de nom de fichier : {name}")
            urllib.request.urlretrieve(f["url"], os.path.join(fonts_dir, name))
            seen[f["url"]] = name
            size = os.path.getsize(os.path.join(fonts_dir, name))
            print(f"  {name:34s} {size:>7,} o")
        rules.append(
            f"""/* {f['fam']} {f['wght']} - {f['subset']} */
@font-face {{
  font-family: '{f['fam']}';
  font-style: {f['style']};
  font-weight: {f['wght']};
  font-display: swap;
  src: url('../fonts/{seen[f['url']]}') format('woff2');
  unicode-range: {f['urange']};
}}"""
        )

    header = (
        "/* Polices auto-hebergees - generees depuis Google Fonts (Fredoka v17, Space Mono v17) */\n"
        "/* Sous-ensembles latin + latin-ext. Regenerer : npm run fetch:fonts */\n\n"
    )
    with open(os.path.join(ROOT, "css", "fonts.css"), "w", encoding="utf-8") as fh:
        fh.write(header + "\n\n".join(rules) + "\n")

    total = sum(os.path.getsize(os.path.join(fonts_dir, n)) for n in set(seen.values()))
    print(f"\n{len(rules)} @font-face, {len(set(seen.values()))} fichiers, {total:,} o")
    print("Si un fichier a change de nom, mets a jour ASSETS dans sw.js.")


if __name__ == "__main__":
    main()
