from typing import Any, Dict

from .models import CustomerData


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _number(value: Any) -> float | None:
    if value is None:
        return None
    text = str(value).strip().replace(",", "").replace("%", "")
    if text == "":
        return None
    try:
        return float(text)
    except ValueError:
        return None


def normalize_record(raw: Dict[str, Any], mapping: Dict[str, str]) -> CustomerData:
    def get(key: str) -> Any:
        return raw.get(mapping[key], raw.get(key, ""))

    return CustomerData(
        customer_id=_text(get("customer_id")),
        customer_name=_text(get("customer_name")),
        platform=_text(get("platform")),
        category=_text(get("category")),
        main_products=_text(get("main_products")),
        business_stage=_text(get("business_stage")),
        period=_text(get("period")),
        impressions=_number(get("impressions")),
        visitors=_number(get("visitors")),
        orders=_number(get("orders")),
        gmv=_number(get("gmv")),
        aov=_number(get("aov")),
        conversion_rate=_number(get("conversion_rate")),
        ad_spend=_number(get("ad_spend")),
        roi=_number(get("roi")),
        refund_rate=_number(get("refund_rate")),
        weekly_activity=_text(get("weekly_activity")),
        customer_problem=_text(get("customer_problem")),
        report_status=_text(get("report_status")),
        report_link=_text(get("report_link")),
        notes=_text(get("notes")),
    )
