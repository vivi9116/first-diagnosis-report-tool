from dataclasses import dataclass, asdict
from typing import Any, Dict, List


@dataclass
class CustomerData:
    customer_id: str
    customer_name: str
    platform: str
    category: str
    main_products: str
    business_stage: str
    period: str
    impressions: float | None
    visitors: float | None
    orders: float | None
    gmv: float | None
    aov: float | None
    conversion_rate: float | None
    ad_spend: float | None
    roi: float | None
    refund_rate: float | None
    weekly_activity: str
    customer_problem: str
    report_status: str
    report_link: str
    notes: str

    def to_prompt_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ValidationResult:
    ok: bool
    warnings: List[str]
    errors: List[str]
