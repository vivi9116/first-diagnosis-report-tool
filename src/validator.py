from .models import CustomerData, ValidationResult


def validate_customer_data(data: CustomerData) -> ValidationResult:
    warnings: list[str] = []
    errors: list[str] = []

    required_text = {
        "客户编号": data.customer_id,
        "客户名称": data.customer_name,
        "平台": data.platform,
        "类目": data.category,
        "数据周期": data.period,
    }
    for label, value in required_text.items():
        if not value:
            errors.append(f"缺少必填字段：{label}")

    if data.gmv is not None and data.orders and data.orders > 0:
        implied_aov = data.gmv / data.orders
        if data.aov and abs(implied_aov - data.aov) / max(data.aov, 1) > 0.25:
            warnings.append("客单价与支付金额/订单数推算差异较大，请确认口径。")

    if data.visitors is not None and data.orders is not None and data.visitors > 0:
        implied_rate = data.orders / data.visitors * 100
        if data.conversion_rate and abs(implied_rate - data.conversion_rate) > 1.0:
            warnings.append("转化率与订单数/访客数推算差异超过1个百分点，请确认口径。")

    if data.ad_spend is not None and data.gmv is not None and data.ad_spend > 0:
        implied_roi = data.gmv / data.ad_spend
        if data.roi and abs(implied_roi - data.roi) / max(data.roi, 1) > 0.35:
            warnings.append("投产比与支付金额/投放消耗推算差异较大，请确认是否为全店GMV或广告成交口径。")

    if data.impressions is None and data.visitors is None:
        warnings.append("缺少流量端关键数据，流量诊断会偏弱。")
    if data.ad_spend is None and data.roi is None:
        warnings.append("缺少投放数据，投放诊断只能基于客户备注。")
    if data.customer_problem == "":
        warnings.append("客户自述问题为空，首诊报告的主观痛点承接会偏弱。")

    return ValidationResult(ok=len(errors) == 0, warnings=warnings, errors=errors)
