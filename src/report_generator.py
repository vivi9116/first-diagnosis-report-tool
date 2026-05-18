import json

from .config import load_prompt_template
from .llm_client import generate_dry_run_report, generate_with_doubao
from .models import CustomerData, ValidationResult


SYSTEM_PROMPT = (
    "你是严谨、务实的中国电商经营诊断顾问，擅长把中小商家的经营数据"
    "转化成老板能看懂、运营能执行、且适合陌生客户首次触达的商业化首诊报告。"
    "你的表达要像资深顾问，不像模板填充。必须遵守判断安全边界："
    "证据不足时只做事实陈述、高概率判断或待验证假设，不输出无依据的强行业结论。"
)


def build_judgment_safety_context(data: CustomerData, validation: ValidationResult) -> dict[str, object]:
    return {
        "report_scope": "single_week_first_diagnosis",
        "has_store_history_baseline": False,
        "has_industry_or_peer_baseline": False,
        "has_platform_tier_baseline": False,
        "has_customer_target_values": False,
        "has_gross_margin": False,
        "has_ad_attribution_breakdown": False,
        "has_channel_breakdown": False,
        "has_repeat_purchase_data": False,
        "validation_warnings": validation.warnings,
        "allowed_strong_judgments": [
            "客户已提交数据中的确定事实",
            "由支付金额/订单数/访客数/投放消耗直接推算出的口径差异提醒",
        ],
        "must_use_cautious_language_for": [
            "达标、合理、优秀、偏低、偏高、健康、不健康等行业或层级判断",
            "投放效率好坏、加预算、砍预算、停投、放量等投放决策",
            "成交缺口、目标转化率、行业均值、同层级对比",
            "复购健康、用户生命周期价值、人群精准度",
        ],
        "default_action_policy": (
            "首诊报告默认只输出低风险验证动作和少量小范围测试动作；"
            "预算、价格、库存、投放结构、全店页面大改等高风险动作只能写成验证后再决定。"
        ),
    }


def build_customer_prompt(data: CustomerData, validation: ValidationResult) -> str:
    template = load_prompt_template()
    payload = {
        "customer": data.to_prompt_dict(),
        "validation_warnings": validation.warnings,
        "validation_errors": validation.errors,
        "judgment_safety_context": build_judgment_safety_context(data, validation),
    }
    customer_data = json.dumps(payload, ensure_ascii=False, indent=2)
    return template.replace("{{CUSTOMER_DATA}}", customer_data)


def generate_report_markdown(data: CustomerData, validation: ValidationResult, dry_run: bool) -> str:
    user_prompt = build_customer_prompt(data, validation)
    if dry_run:
        return generate_dry_run_report(user_prompt)
    return generate_with_doubao(SYSTEM_PROMPT, user_prompt)
