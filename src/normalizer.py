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


def _int(value: Any) -> int | None:
    number = _number(value)
    if number is None:
        return None
    return int(number)


def _bool(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value > 0
    text = str(value).strip().lower()
    return text in {"1", "true", "yes", "y", "是", "有", "已接入", "已提供"}


def normalize_record(raw: Dict[str, Any], mapping: Dict[str, str]) -> CustomerData:
    def get(key: str) -> Any:
        return raw.get(mapping.get(key, key), raw.get(key, ""))

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
        historical_weeks=_int(get("historical_weeks")),
        has_platform_tier_data=_bool(get("has_platform_tier_data")),
        has_industry_peer_data=_bool(get("has_industry_peer_data")),
        has_gross_margin=_bool(get("has_gross_margin")),
        has_ad_attribution=_bool(get("has_ad_attribution")),
        has_product_cost=_bool(get("has_product_cost")),
        has_inventory_data=_bool(get("has_inventory_data")),
        data_source_notes=_text(get("data_source_notes")),
    )
