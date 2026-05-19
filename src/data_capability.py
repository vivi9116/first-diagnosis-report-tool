from .models import CustomerData


def _history_weeks(data: CustomerData) -> int:
    if data.historical_weeks is None:
        return 1
    return max(int(data.historical_weeks), 1)


def _has_single_week_basic_data(data: CustomerData) -> bool:
    core_metrics = [
        data.impressions,
        data.visitors,
        data.orders,
        data.gmv,
        data.aov,
        data.conversion_rate,
    ]
    return sum(value is not None for value in core_metrics) >= 3


def assess_data_capability(data: CustomerData) -> dict[str, object]:
    """Return the judgment boundary allowed by the submitted data sources."""

    history_weeks = _history_weeks(data)
    has_store_history = history_weeks >= 4
    has_trend_window = history_weeks >= 12
    has_peer_source = data.has_platform_tier_data or data.has_industry_peer_data
    has_ad_efficiency_source = data.has_gross_margin and data.has_ad_attribution
    has_profit_inventory_source = data.has_product_cost and data.has_inventory_data

    allowed_outputs: list[str] = []
    blocked_outputs: list[str] = []

    if _has_single_week_basic_data(data):
        allowed_outputs.append("可以输出首诊假设和低风险验证动作")
    else:
        blocked_outputs.append("基础经营数据不足，报告只能提示需补数据，不能输出经营判断")

    if has_store_history:
        allowed_outputs.append("可以输出店铺自身近4周历史对比")
    else:
        blocked_outputs.append("没有近4周连续数据，不输出店铺历史对比")

    if has_trend_window:
        allowed_outputs.append("可以输出近12周趋势判断和波动区间")
    else:
        blocked_outputs.append("没有近12周连续数据，不输出趋势判断和波动区间")

    if has_peer_source:
        allowed_outputs.append("可以输出行业/平台同层级判断，但必须标注来源和口径")
    else:
        blocked_outputs.append("没有平台同层级或行业数据，不输出行业/同层级强判断")

    if has_ad_efficiency_source:
        allowed_outputs.append("可以输出投放效率判断")
    else:
        blocked_outputs.append("没有毛利率和投放归因，不输出投放效率强判断")

    if has_profit_inventory_source:
        allowed_outputs.append("可以输出利润和库存策略建议")
    else:
        blocked_outputs.append("没有商品成本和库存数据，不输出利润和库存策略建议")

    if has_trend_window:
        data_level = "L3_12_week_trend_window"
    elif has_store_history:
        data_level = "L2_4_week_store_baseline"
    else:
        data_level = "L1_single_week_first_diagnosis"

    return {
        "data_level": data_level,
        "historical_weeks": history_weeks,
        "has_single_week_basic_data": _has_single_week_basic_data(data),
        "has_store_history_baseline": has_store_history,
        "has_12_week_trend_window": has_trend_window,
        "has_platform_tier_or_industry_peer_data": has_peer_source,
        "has_gross_margin_and_ad_attribution": has_ad_efficiency_source,
        "has_product_cost_and_inventory": has_profit_inventory_source,
        "allowed_outputs": allowed_outputs,
        "blocked_outputs": blocked_outputs,
        "source_attribution_rule": "没有数据源，就不输出强判断；有数据源，就必须标注来源和口径。",
        "recommended_data_path": [
            "第一步：商家手动导出后台数据",
            "第二步：连续4周建立店铺自身基准",
            "第三步：接入平台官方后台/广告后台",
            "第四步：有条件再接行业/同层级数据",
            "第五步：第三方工具只做趋势辅助",
        ],
        "data_source_notes": data.data_source_notes,
    }
