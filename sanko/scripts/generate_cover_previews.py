from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROJECTS_DATA_PATH = ROOT / "projects-data.js"
MAGICK = Path("/Applications/MAMP/Library/bin/magick")

PREVIEW_CONFIG = {
    "programs": {
        "source_root": ROOT / "img" / "programs",
        "output_root": ROOT / "img" / "programs-cards",
    },
    "FieldTrip": {
        "source_root": ROOT / "img" / "FieldTrip",
        "output_root": ROOT / "img" / "FieldTrip-cards",
    },
}


def load_projects() -> list[dict[str, object]]:
    text = PROJECTS_DATA_PATH.read_text(encoding="utf-8")
    match = re.search(r"const projectsData = (.*);\s*$", text, re.S)
    if not match:
        raise RuntimeError("Unable to parse projects-data.js")
    payload = json.loads(match.group(1))
    if not isinstance(payload, list):
        raise RuntimeError("projectsData payload is not a list")
    return payload


def preview_path_for(asset_base: str, folder: str, cover_name: str) -> Path:
    config = PREVIEW_CONFIG[asset_base]
    return (config["output_root"] / folder / cover_name).with_suffix(".webp")


def source_path_for(asset_base: str, folder: str, cover_name: str) -> Path:
    config = PREVIEW_CONFIG[asset_base]
    return config["source_root"] / folder / cover_name


def needs_regeneration(source_path: Path, target_path: Path, force: bool = False) -> bool:
    if force:
        return True
    if not target_path.exists():
        return True
    return source_path.stat().st_mtime > target_path.stat().st_mtime


def generate_preview(source_path: Path, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            str(MAGICK),
            str(source_path),
            "-auto-orient",
            "-resize",
            "960x720^",
            "-gravity",
            "center",
            "-extent",
            "960x720",
            "-quality",
            "84",
            str(target_path),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Regenerate all previews even if targets exist")
    args = parser.parse_args()

    projects = load_projects()
    generated = 0
    skipped = 0

    for project in projects:
        asset_base = str(project.get("assetBase", "programs"))
        if asset_base not in PREVIEW_CONFIG:
            continue

        folder = str(project["folder"])
        cover_name = str(project["cover"])
        source_path = source_path_for(asset_base, folder, cover_name)
        target_path = preview_path_for(asset_base, folder, cover_name)

        if not source_path.exists():
            continue

        if needs_regeneration(source_path, target_path, force=args.force):
            generate_preview(source_path, target_path)
            generated += 1
        else:
            skipped += 1

    print(
        f"Processed {generated + skipped} cover previews: generated {generated}, skipped {skipped}."
    )


if __name__ == "__main__":
    main()
