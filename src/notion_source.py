import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict

from .config import load_field_mapping
from .models import CustomerData
from .normalizer import normalize_record


NOTION_VERSION = "2022-06-28"


def _notion_headers() -> Dict[str, str]:
    token = os.getenv("NOTION_TOKEN", "").strip()
    if not token:
        raise RuntimeError("缺少 NOTION_TOKEN。请在 GitHub Secrets 或本地环境变量中配置。")
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def _plain_text(items: list[dict]) -> str:
    return "".join(item.get("plain_text", "") for item in items).strip()


def _property_value(prop: Dict[str, Any]) -> Any:
    prop_type = prop.get("type")
    if prop_type == "title":
        return _plain_text(prop.get("title", []))
    if prop_type == "rich_text":
        return _plain_text(prop.get("rich_text", []))
    if prop_type == "select":
        selected = prop.get("select")
        return selected.get("name", "") if selected else ""
    if prop_type == "status":
        status = prop.get("status")
        return status.get("name", "") if status else ""
    if prop_type == "number":
        return prop.get("number")
    if prop_type == "url":
        return prop.get("url") or ""
    if prop_type == "date":
        date = prop.get("date")
        if not date:
            return ""
        start = date.get("start", "")
        end = date.get("end", "")
        return f"{start} 至 {end}" if end else start
    if prop_type == "formula":
        formula = prop.get("formula", {})
        return formula.get(formula.get("type", ""), "")
    return ""


def _page_to_raw_record(page: Dict[str, Any]) -> Dict[str, Any]:
    properties = page.get("properties", {})
    return {name: _property_value(prop) for name, prop in properties.items()}


def query_notion_database(customer_id: str) -> CustomerData:
    database_id = os.getenv("NOTION_DATABASE_ID", "").strip()
    if not database_id:
        raise RuntimeError("缺少 NOTION_DATABASE_ID。请在 GitHub Secrets 或本地环境变量中配置。")

    mapping = load_field_mapping()
    payload = {"page_size": 100}

    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url=f"https://api.notion.com/v1/databases/{database_id}/query",
        data=body,
        headers=_notion_headers(),
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Notion API 请求失败：{exc.code} {detail}") from exc

    for page in result.get("results", []):
        raw = _page_to_raw_record(page)
        data = normalize_record(raw, mapping)
        if data.customer_id == customer_id and data.report_status == "待生成":
            return data

    raise ValueError(f"Notion 中找不到报告状态为“待生成”的客户：{customer_id}")
