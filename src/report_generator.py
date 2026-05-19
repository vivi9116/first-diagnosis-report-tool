import json

from .config import load_prompt_template
from .data_capability import assess_data_capability
from .llm_client import generate_dry_run_report, generate_with_doubao
from .models import CustomerData, ValidationResult


SYSTEM_PROMPT = (
    "你是严谨、务实的中国电商经营诊断顾问，擅长把中小商家的经营数据"
    "转化成老板能看懂、运营能执行、且适合陌生客户首次触达的商业化首诊报告。"
    "你的表达要像资深顾问，不像模板填充。必须遵守判断安全边界："
    "证据不足时只做事实陈述、初步观察或待验证假设，不输出无依据的强行业结论、"
    "强因果结论、预期差结论、趋势结论、固定阈值结论或高风险经营动作。"
    "正文表达必须和数据边界保持一致，不能前文下强判断、后文再声明不下强判断。"
    "生成报告前必须先遵守数据可用性等级：没有数据源就不输出强判断；有数据源才标注来源和口径后输出相应深度判断。"
)


def build_judgment_safety_context(data: CustomerData, validation: ValidationResult) -> dict[str, object]:
    data_capability = assess_data_capability(data)
    return {
        "report_scope": "single_week_first_diagnosis",
        "data_availability_assessment": data_capability,
        "has_store_history_baseline": data_capability["has_store_history_baseline"],
        "has_industry_or_peer_baseline": data_capability["has_platform_tier_or_industry_peer_data"],
        "has_platform_tier_baseline": data.has_platform_tier_data,
        "has_customer_target_values": False,
        "has_activity_before_after_comparison": False,
        "has_multi_week_trend_data": data_capability["has_12_week_trend_window"],
        "has_gross_margin": data.has_gross_margin,
        "has_ad_attribution_breakdown": data.has_ad_attribution,
        "has_product_cost": data.has_product_cost,
        "has_inventory_data": data.has_inventory_data,
        "has_channel_breakdown": False,
        "has_repeat_purchase_data": False,
        "has_threshold_source": False,
        "data_source_rule": "没有数据源，就不输出强判断；有数据源，就标注来源和口径。",
        "data_availability_policy": {
            "single_week_basic_data": "只能输出首诊假设和低风险验证动作，不输出行业判断、趋势判断、投放效率强判断、利润库存策略。",
            "near_4_week_data": "可以输出店铺历史对比，但不等同于行业/同层级判断。",
            "near_12_week_data": "可以输出趋势判断和波动区间。",
            "platform_tier_or_peer_data": "可以输出行业/同层级判断，但必须标注来源和口径。",
            "gross_margin_and_ad_attribution": "可以输出投放效率判断。",
            "product_cost_and_inventory": "可以输出利润和库存策略建议。",
        },
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
            "trend_terms_without_comparison": [
                "上涨",
                "下滑",
                "改善",
                "恶化",
                "变好",
                "变差",
                "同步放大",
                "没有跟上",
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
        "boundary_consistency_policy": (
            "如果报告第07条数据边界声明不输出达标、合理、优秀、偏低、砍预算、加预算等强判断，"
            "正文前文也不得出现同类判断。若出现，必须替换为已具备分析价值、当前样本显示、"
            "需进一步验证或验证后再决定。"
        ),
        "threshold_policy": (
            "不得默认输出60%、70%、80%、30%等固定判断线；除非输入数据或系统配置提供阈值来源。"
            "对外报告优先使用相对表达，例如明显高于历史均值、明显低于同类商品、"
            "多数反馈集中、占比较低。若必须使用内部阈值，必须说明其为本次试点观察线，"
            "仅用于初步排查，不代表行业标准。"
        ),
        "trend_policy": (
            "凡出现稳定、上涨、下滑、改善、恶化、变好、变差、同步放大、没有跟上等趋势或变化判断，"
            "必须存在上周、上月、活动前后、历史均值或连续多周数据。若没有，只能写当前数值，"
            "并说明仍需结合历史数据判断。"
        ),
        "default_action_policy": (
            "首诊报告默认只输出低风险验证动作和少量小范围测试动作；"
            "预算、价格、库存、投放结构、全店页面大改等高风险动作只能写成验证后再决定。"
        ),
        "action_risk_policy": {
            "low_risk_validation_actions": [
                "拉取后台数据",
                "核实数据口径",
                "拆分渠道、人群、关键词、商品表现",
                "查看客服咨询和用户反馈",
                "制作页面或活动优化方案",
            ],
            "high_risk_actions_require_validation": [
                "真实页面替换",
                "预算调整",
                "投放定向修改",
                "价格机制调整",
                "库存调整",
                "停推新品",
                "全店改版",
            ],
            "required_wording_for_high_risk_actions": "小范围测试/具备条件时验证/验证后再决定，不得直接全量执行",
        },
        "final_safety_review_checklist": [
            "是否先读取数据可用性等级，再决定判断深度",
            "只有单周基础数据时，是否仍输出了行业判断、趋势判断、投放效率强判断、利润或库存策略",
            "有强判断时，是否标注了对应数据来源和口径",
            "是否存在无活动前后对比支撑的强因果判断",
            "是否存在无目标值或历史基准支撑的预期判断",
            "是否存在无历史或行业数据支撑的稳定、合理、异常、达标判断",
            "是否存在无上周/上月/历史/活动前后对比支撑的趋势判断",
            "正文是否与第07条数据边界声明冲突",
            "是否存在未说明来源的固定阈值",
            "是否存在直接加预算、砍预算、降价、停推、页面全量替换或大改页面等高风险动作",
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
