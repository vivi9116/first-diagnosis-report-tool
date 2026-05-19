import argparse
import json
from dataclasses import asdict

from .config import ensure_output_dir
from .csv_source import load_from_csv
from .data_capability import assess_data_capability
from .docx_renderer import render_docx
from .notion_source import query_notion_database
from .report_generator import generate_report_markdown
from .validator import validate_customer_data


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate first diagnosis report.")
    parser.add_argument("--source", choices=["csv", "notion"], default="csv")
    parser.add_argument("--customer-id", required=True)
    parser.add_argument("--csv-path", default=None)
    parser.add_argument("--dry-run", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.source == "csv":
        customer = load_from_csv(args.customer_id, args.csv_path)
    else:
        customer = query_notion_database(args.customer_id)

    validation = validate_customer_data(customer)
    data_capability = assess_data_capability(customer)
    out_dir = ensure_output_dir()

    validation_path = out_dir / f"{customer.customer_id}_数据校验结果.json"
    validation_path.write_text(
        json.dumps(
            {
                "validation": asdict(validation),
                "data_availability_assessment": data_capability,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    if not validation.ok:
        raise SystemExit(f"数据校验失败：{validation.errors}")

    markdown = generate_report_markdown(customer, validation, dry_run=args.dry_run)
    md_path = out_dir / f"{customer.customer_id}_首诊报告.md"
    docx_path = out_dir / f"{customer.customer_id}_首诊报告.docx"

    md_path.write_text(markdown, encoding="utf-8")
    render_docx(markdown, docx_path)

    print(f"Generated: {md_path}")
    print(f"Generated: {docx_path}")
    print(f"Validation: {validation_path}")


if __name__ == "__main__":
    main()
