import unittest

from src.data_capability import assess_data_capability
from src.models import CustomerData


def make_customer(**overrides):
    data = {
        "customer_id": "C001",
        "customer_name": "测试店铺",
        "platform": "淘宝",
        "category": "家居百货",
        "main_products": "收纳用品",
        "business_stage": "成长店",
        "period": "2026年第20周",
        "impressions": 10000,
        "visitors": 1200,
        "orders": 30,
        "gmv": 3000,
        "aov": 100,
        "conversion_rate": 2.5,
        "ad_spend": 500,
        "roi": 6,
        "refund_rate": 2,
        "weekly_activity": "上新",
        "customer_problem": "流量来了但成交不足",
        "report_status": "待生成",
        "report_link": "",
        "notes": "",
    }
    data.update(overrides)
    return CustomerData(**data)


class DataCapabilityTest(unittest.TestCase):
    def test_single_week_data_only_allows_first_diagnosis_hypothesis(self):
        assessment = assess_data_capability(make_customer(historical_weeks=1))

        self.assertEqual(assessment["data_level"], "L1_single_week_first_diagnosis")
        self.assertIn("可以输出首诊假设和低风险验证动作", assessment["allowed_outputs"])
        self.assertIn("没有平台同层级或行业数据，不输出行业/同层级强判断", assessment["blocked_outputs"])
        self.assertIn("没有近12周连续数据，不输出趋势判断和波动区间", assessment["blocked_outputs"])

    def test_four_weeks_allow_store_history_comparison_but_not_trend(self):
        assessment = assess_data_capability(make_customer(historical_weeks=4))

        self.assertEqual(assessment["data_level"], "L2_4_week_store_baseline")
        self.assertIn("可以输出店铺自身近4周历史对比", assessment["allowed_outputs"])
        self.assertIn("没有近12周连续数据，不输出趋势判断和波动区间", assessment["blocked_outputs"])

    def test_twelve_weeks_allow_trend_window(self):
        assessment = assess_data_capability(make_customer(historical_weeks=12))

        self.assertEqual(assessment["data_level"], "L3_12_week_trend_window")
        self.assertIn("可以输出近12周趋势判断和波动区间", assessment["allowed_outputs"])

    def test_peer_judgment_requires_peer_source(self):
        assessment = assess_data_capability(make_customer(has_platform_tier_data=True))

        self.assertIn("可以输出行业/平台同层级判断，但必须标注来源和口径", assessment["allowed_outputs"])

    def test_ad_efficiency_requires_margin_and_attribution(self):
        without_margin = assess_data_capability(make_customer(has_ad_attribution=True))
        with_margin = assess_data_capability(make_customer(has_gross_margin=True, has_ad_attribution=True))

        self.assertIn("没有毛利率和投放归因，不输出投放效率强判断", without_margin["blocked_outputs"])
        self.assertIn("可以输出投放效率判断", with_margin["allowed_outputs"])

    def test_profit_inventory_requires_cost_and_inventory(self):
        without_inventory = assess_data_capability(make_customer(has_product_cost=True))
        with_inventory = assess_data_capability(make_customer(has_product_cost=True, has_inventory_data=True))

        self.assertIn("没有商品成本和库存数据，不输出利润和库存策略建议", without_inventory["blocked_outputs"])
        self.assertIn("可以输出利润和库存策略建议", with_inventory["allowed_outputs"])


if __name__ == "__main__":
    unittest.main()
