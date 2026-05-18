import json
from pathlib import Path
from typing import Dict


ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "config"
OUTPUT_DIR = ROOT / "outputs"
SAMPLES_DIR = ROOT / "samples"


def load_field_mapping() -> Dict[str, str]:
    with (CONFIG_DIR / "field_mapping.json").open("r", encoding="utf-8") as f:
        return json.load(f)


def load_prompt_template() -> str:
    return (CONFIG_DIR / "prompt_template.md").read_text(encoding="utf-8")


def ensure_output_dir() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    return OUTPUT_DIR
