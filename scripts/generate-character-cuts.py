#!/usr/bin/env python3
"""
generate-character-cuts.py

Pipeline batch para generar `frontend/img/cuts/{slug}.webp`: imagen
oficial del personaje desde Jikan/MAL recortada con rembg (modelo
isnet-anime, entrenado en arte anime) sobre fondo transparente.

Estos recortes son ASSETS reutilizables, no tienen que ver con la
visualización holográfica de la ficha. Se generan una vez (idempotente
— skip si ya existe) y quedan disponibles para:

  - parallax / fondo contextual en componentes futuros
  - VS reveals en torneos
  - avatars / banners
  - OG images
  - mascots compartibles

Fuente: el seed JSON del backend (`backend/src/main/resources/
personajes-seed.json`) que el sync mantiene sincronizado con
`frontend/img/`. Para cada personaje:
  1. Buscar mal_id en Jikan por nombre + filtrado por anime.
  2. Fetch imagen principal oficial.
  3. Aplicar rembg con modelo isnet-anime.
  4. Guardar como webp con alpha en `frontend/img/cuts/{slug}.webp`.

Rate-limit Jikan: 3 req/s. Sleep 0.4s entre llamadas (search + image
download = 2 req → ~0.8s por personaje = ~14min para 1052 + análisis
rembg ~1s extra cada uno = ~30-40 min total).

Idempotente: si el archivo de destino existe, skip. Para re-procesar
borra el archivo destino primero.

Uso:
  python3 scripts/generate-character-cuts.py            # batch todos
  python3 scripts/generate-character-cuts.py --limit 5  # solo 5
  python3 scripts/generate-character-cuts.py --slug luffy  # solo uno
  python3 scripts/generate-character-cuts.py --force    # ignora existentes

Salida en stdout con tags `[ok]` / `[skip]` / `[fail]` por personaje
para `grep` rápido.
"""

import argparse
import io
import json
import sys
import time
from pathlib import Path
from typing import Optional

import requests
from PIL import Image
from rembg import new_session, remove

ROOT = Path(__file__).resolve().parent.parent
SEED_FILE = ROOT / "backend" / "src" / "main" / "resources" / "personajes-seed.json"
OUT_DIR = ROOT / "frontend" / "img" / "cuts"

JIKAN_BASE = "https://api.jikan.moe/v4"
JIKAN_SLEEP = 0.4  # ~3 req/s
DOWNLOAD_TIMEOUT = 8

HEADERS = {
    "User-Agent": "AnimeShowdown-CutsGenerator/1.0 (+https://animeshowdown.dev)"
}


def find_mal_id(session_http: requests.Session, nombre: str, anime: str) -> Optional[int]:
    """Search /characters por nombre, filtra por match de anime, devuelve mal_id."""
    try:
        r = session_http.get(
            f"{JIKAN_BASE}/characters",
            params={"q": nombre, "limit": 10},
            timeout=DOWNLOAD_TIMEOUT,
            headers=HEADERS,
        )
        r.raise_for_status()
        data = r.json().get("data", [])
    except Exception as exc:
        print(f"[fail] {nombre}: jikan search error {exc}", flush=True)
        return None
    if not data:
        return None
    anime_lower = (anime or "").lower()
    fallback_id = None
    for c in data:
        mal_id = c.get("mal_id")
        if not isinstance(mal_id, int):
            continue
        animes = c.get("anime") or []
        for entry in animes:
            titulo = (entry.get("anime") or {}).get("title", "").lower()
            if titulo and (anime_lower in titulo or titulo in anime_lower):
                return mal_id
        if fallback_id is None:
            fallback_id = mal_id
    return fallback_id


def fetch_image(session_http: requests.Session, mal_id: int) -> Optional[bytes]:
    """Trae /characters/{mal_id}/full → primera URL de images.jpg.image_url. Descarga bytes."""
    try:
        r = session_http.get(
            f"{JIKAN_BASE}/characters/{mal_id}/full",
            timeout=DOWNLOAD_TIMEOUT,
            headers=HEADERS,
        )
        r.raise_for_status()
        url = (r.json().get("data") or {}).get("images", {}).get("jpg", {}).get("image_url")
    except Exception as exc:
        print(f"[fail] mal_id={mal_id}: jikan full error {exc}", flush=True)
        return None
    if not url:
        return None
    try:
        r = session_http.get(url, timeout=DOWNLOAD_TIMEOUT, headers=HEADERS)
        r.raise_for_status()
        return r.content
    except Exception as exc:
        print(f"[fail] mal_id={mal_id}: download error {exc}", flush=True)
        return None


def remove_bg(img_bytes: bytes, rembg_session) -> Optional[Image.Image]:
    """Aplica rembg al bytes y devuelve PIL Image RGBA. None si falla."""
    try:
        out = remove(img_bytes, session=rembg_session)
        return Image.open(io.BytesIO(out)).convert("RGBA")
    except Exception as exc:
        print(f"[fail] rembg error: {exc}", flush=True)
        return None


def crop_to_alpha(img: Image.Image) -> Image.Image:
    """Recorta al bounding box de pixels no-transparentes. Reduce padding hueco."""
    bbox = img.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def is_too_small(img: Image.Image, min_dim: int = 100) -> bool:
    return img.width < min_dim or img.height < min_dim


def is_alpha_too_sparse(img: Image.Image, min_ratio: float = 0.05) -> bool:
    """Si <5% de pixels tienen alpha>0, el recorte está vacío (rembg falló)."""
    alpha = img.split()[-1]
    histogram = alpha.histogram()
    visible = sum(histogram[1:])  # alpha > 0
    total = img.width * img.height
    if total == 0:
        return True
    return (visible / total) < min_ratio


def process_one(p: dict, session_http: requests.Session, rembg_session, force: bool) -> str:
    slug = p["slug"]
    out_path = OUT_DIR / f"{slug}.webp"
    if out_path.exists() and not force:
        return "skip-exists"

    mal_id = find_mal_id(session_http, p["nombre"], p.get("anime", ""))
    time.sleep(JIKAN_SLEEP)
    if not mal_id:
        return "fail-no-mal-id"

    img_bytes = fetch_image(session_http, mal_id)
    time.sleep(JIKAN_SLEEP)
    if not img_bytes:
        return "fail-no-image"

    cut = remove_bg(img_bytes, rembg_session)
    if cut is None:
        return "fail-rembg"

    cut = crop_to_alpha(cut)
    if is_too_small(cut):
        return "fail-too-small"
    if is_alpha_too_sparse(cut):
        return "fail-empty"

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cut.save(out_path, format="WEBP", quality=85, method=6)
    return "ok"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="máx N personajes")
    parser.add_argument("--slug", type=str, default=None, help="solo un slug concreto")
    parser.add_argument("--force", action="store_true", help="regenerar aunque exista")
    args = parser.parse_args()

    if not SEED_FILE.exists():
        print(f"No existe {SEED_FILE}", file=sys.stderr)
        sys.exit(1)
    with SEED_FILE.open() as f:
        catalog = json.load(f)

    if args.slug:
        catalog = [p for p in catalog if p["slug"] == args.slug]
        if not catalog:
            print(f"Slug no encontrado: {args.slug}", file=sys.stderr)
            sys.exit(1)
    if args.limit:
        catalog = catalog[: args.limit]

    print(f"Procesando {len(catalog)} personajes → {OUT_DIR}", flush=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Una sola sesión rembg amortiza el modelo en RAM (~150MB carga inicial)
    rembg_session = new_session("isnet-anime")
    session_http = requests.Session()

    counts = {"ok": 0, "skip-exists": 0}
    for i, p in enumerate(catalog, 1):
        result = process_one(p, session_http, rembg_session, args.force)
        counts[result] = counts.get(result, 0) + 1
        tag = "[ok]" if result == "ok" else f"[{result}]"
        print(f"{tag} {i}/{len(catalog)} {p['slug']} ({p.get('anime', '?')})", flush=True)

    print("\n--- resumen ---", flush=True)
    for k, v in sorted(counts.items()):
        print(f"  {k}: {v}", flush=True)


if __name__ == "__main__":
    main()
