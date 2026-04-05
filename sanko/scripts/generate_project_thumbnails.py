from __future__ import annotations

import argparse
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMAGE_ROOT = ROOT / "img"
SOURCE_DIRS = {
    "programs": IMAGE_ROOT / "programs",
    "FieldTrip": IMAGE_ROOT / "FieldTrip",
}
OUTPUT_DIRS = {
    "programs": IMAGE_ROOT / "programs-thumbs",
    "FieldTrip": IMAGE_ROOT / "FieldTrip-thumbs",
}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
MAGICK = Path("/Applications/MAMP/Library/bin/magick")


def resolve_search_roots(folder_filters: list[str] | None = None) -> list[tuple[str, Path]]:
    if not folder_filters:
        return list(SOURCE_DIRS.items())

    roots: list[tuple[str, Path]] = []
    for folder_filter in folder_filters:
        normalized = folder_filter.strip().strip("/")
        parts = Path(normalized).parts
        if not parts:
            continue

        asset_base = parts[0]
        source_root = SOURCE_DIRS.get(asset_base)
        if source_root is None:
            continue

        if len(parts) == 1:
            roots.append((asset_base, source_root))
        else:
            roots.append((asset_base, source_root.joinpath(*parts[1:])))

    return roots


def iter_images(folder_filters: list[str] | None = None) -> list[tuple[str, Path]]:
    images: list[tuple[str, Path]] = []
    for asset_base, search_root in resolve_search_roots(folder_filters):
        if not search_root.exists():
            continue
        images.extend(
            (asset_base, path)
            for path in search_root.rglob("*")
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        )

    return sorted(images, key=lambda item: (item[0], str(item[1])))


def thumbnail_path_for(asset_base: str, source_path: Path) -> Path:
    relative = source_path.relative_to(SOURCE_DIRS[asset_base])
    return OUTPUT_DIRS[asset_base] / relative.with_suffix(".webp")


def needs_regeneration(source_path: Path, target_path: Path) -> bool:
    if not target_path.exists():
        return True
    return source_path.stat().st_mtime > target_path.stat().st_mtime


def generate_thumbnail(source_path: Path, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            str(MAGICK),
            str(source_path),
            "-auto-orient",
            "-resize",
            "160x160^",
            "-gravity",
            "center",
            "-extent",
            "160x160",
            "-quality",
            "68",
            str(target_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "folders",
        nargs="*",
        help="Optional folder filters relative to img, e.g. programs/合尘建筑 or FieldTrip/柏林德国国会大厦",
    )
    args = parser.parse_args()

    images = iter_images(args.folders or None)
    to_generate: list[tuple[Path, Path]] = []
    skipped = 0

    for asset_base, source_path in images:
        target_path = thumbnail_path_for(asset_base, source_path)
        if needs_regeneration(source_path, target_path):
            to_generate.append((source_path, target_path))
        else:
            skipped += 1

    worker_count = min(8, max(1, (os.cpu_count() or 4) - 1))
    if to_generate:
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            list(executor.map(lambda args: generate_thumbnail(*args), to_generate))
    generated = len(to_generate)

    print(
        f"Processed {len(images)} images: generated {generated}, skipped {skipped}. "
        f"Output roots: {', '.join(str(path.relative_to(ROOT)) for path in OUTPUT_DIRS.values())}"
    )


if __name__ == "__main__":
    main()
