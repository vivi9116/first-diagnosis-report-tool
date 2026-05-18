import csv
from pathlib import Path
from typing import List

from .config import SAMPLES_DIR, load_field_mapping
from .models import CustomerData
from .normalizer import normalize_record


def load_from_csv(customer_id: str, csv_path: str | None = None) -> CustomerData:
    path = Path(csv_path) if csv_path else SAMPLES_DIR / "sample_customer_data.csv"
    mapping = load_field_mapping()

    with path.open("r", encoding="utf-8-sig", newline="") as f:
        rows: List[dict] = list(csv.DictReader(f))

    for row in rows:
        data = normalize_record(row, mapping)
        if data.customer_id == customer_id:
            return data

    raise ValueError(f"CSV 中找不到客户编号：{customer_id}")
