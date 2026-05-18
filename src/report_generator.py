import json

from .config import load_prompt_template
from .llm_client import generate_dry_run_report, generate_with_doubao
from .models import CustomerData, ValidationResult


SYSTEM_PROMPT = (
    "你是严谨、务实的中国电商经营诊断顾问，擅长把中小商家的经营数据"
    "转化成老板能看懂、运营能执行、且适合陌生客户首次触达的商业化首诊报告。"
    "你的表达要像资深顾问，不像模板填充。必须遵守判断安全边界："
    "证据不足时只做事实陈述、初步观察或待验证假设，不输出无依据的强行业结论、"
    "强因果结论、预期差结论、固定阈值结论或高风险经营动作。"
)


def build_judgment_safety_context(data: CustomerData, validation: ValidationResult) -> dict[str, object]:
    return {
        "report_scope": "single_week_first_diagnosis",
        "has_store_history_baseline": False,
        "has_industry_or_peer_baseline": False,
        "has_platform_tier_baseline": False,
        "has_customer_target_values": False,
        "has_activity_before_after_comparison": False,
        "has_multi_week_trend_data": False,
        "has_gross_margin": False,
        "has_ad_attribution_breakdown": False,
        "has_channel_breakdown": False,
        "has_repeat_purchase_data": False,
        "has_threshold_source": False,
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
        "strong_word_control": {
            "causal_terms_without_evidence": [
                "证明",
                "已经带动",
                "导致",
                "造成",
                "跑通",
                "验证了",
                "直接说明",
            ],
            "expectation_terms_without_baseline": [
                "未达到预期",
                "低于预期",
                "超过预期",
                "成交缺口",
                "转化率偏低",
                "访客量达标",
            ],
            "state_terms_without_baseline": [
                "稳定",
                "无异常",
                "健康",
                "合理",
                "优秀",
                "达标",
                "偏低",
                "偏高",
            ],
            "safe_replacements": [
                "在……背景下观察到",
                "具备观察价值",
                "可能存在关联",
                "需进一步验证贡献",
                "从单周数据看仍有拆解空间",
                "本次样本暂未显示明显风险",
                "当前提交数据中未见明显异常信号",
                "仍需结合历史数据判断",
            ],
        },
        "threshold_policy": (
            "不得默认输出60%、70%、80%、30%等固定判断线；除非输入数据或系统配置提供阈值来源。"
            "对外报告优先使用相对表达，例如明显高于历史均值、明显低于同类商品、"
            "多数反馈集中、占比较低。若必须使用内部阈值，必须说明其为本次试点观察线，"
            "仅用于初步排查，不代表行业标准。"
        ),
        "default_action_policy": (
            "首诊报告默认只输出低风险验证动作和少量小范围测试动作；"
            "预算、价格、库存、投放结构、全店页面大改等高风险动作只能写成验证后再决定。"
        ),
        "final_safety_review_checklist": [
            "是否存在无活动前后对比支撑的强因果判断",
            "是否存在无目标值或历史基准支撑的预期判断",
            "是否存在无历史或行业数据支撑的稳定、合理、异常、达标判断",
            "是否存在未说明来源的固定阈值",
            "是否存在直接加预算、砍预算、降价、停推或大改页面等高风险动作",
            "是否存在承诺GMV提升或过度确定表达",
        ],
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
