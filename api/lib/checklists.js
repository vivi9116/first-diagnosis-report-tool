export const FIELD_DEFINITIONS = {
  customer_id: { label: '客户编号', type: 'text', internal: true },
  customer_name: { label: '店铺/客户名称', type: 'text', required: true },
  platform: {
    label: '平台',
    type: 'select',
    required: true,
    options: ['淘宝', '拼多多', '抖音', '小红书', '其他'],
  },
  category: {
    label: '类目',
    type: 'select',
    required: true,
    options: ['家居百货', '宠物用品', '食品', '女装', '其他'],
  },
  main_products: { label: '主营产品', type: 'text', required: true },
  business_stage: {
    label: '经营阶段',
    type: 'select',
    required: true,
    options: ['新店', '成长店', '稳定店', '下滑店'],
  },
  period: { label: '数据周期', type: 'text', required: true, placeholder: '例如：2026-05-11 至 2026-05-17' },
  impressions: { label: '曝光量', type: 'number', required: true },
  visitors: { label: '访客数', type: 'number', required: true },
  orders: { label: '订单数', type: 'number', required: true },
  gmv: { label: '支付金额', type: 'number', required: true },
  aov: { label: '客单价', type: 'number', required: true },
  conversion_rate: { label: '转化率 (%)', type: 'number', required: true },
  ad_spend: { label: '投放消耗', type: 'number', required: false },
  roi: { label: '投产比 / ROI', type: 'number', required: false },
  refund_rate: { label: '退款率 (%)', type: 'number', required: true },
  weekly_activity: { label: '本周活动/上新', type: 'textarea', required: false },
  customer_problem: { label: '当前最想解决的问题', type: 'textarea', required: true },
  historical_weeks: { label: '历史数据周数', type: 'number', required: true, defaultValue: 1 },
  has_platform_tier_data: { label: '是否有平台同层级数据', type: 'checkbox' },
  has_industry_peer_data: { label: '是否有行业/同层级数据', type: 'checkbox' },
  has_gross_margin: { label: '是否有毛利率', type: 'checkbox' },
  has_ad_attribution: { label: '是否有投放归因', type: 'checkbox' },
  has_product_cost: { label: '是否有商品成本', type: 'checkbox' },
  has_inventory_data: { label: '是否有库存数据', type: 'checkbox' },
  data_source_notes: { label: '数据来源说明', type: 'textarea', required: true },
  previous_actions_result: { label: '上期动作结果', type: 'textarea', required: true },
  next_week_focus: { label: '下周重点动作', type: 'textarea', required: false },
  month_summary: { label: '本月经营总结', type: 'textarea', required: true },
};

export const CHECKLISTS = {
  first_diagnosis: {
    title: '首诊数据提交清单',
    subtitle: '用于临时邀请码客户，只提交一次，只生成一份首诊报告。',
    submitLabel: '提交并生成首诊报告',
    evidence: [
      '经营总览截图+Excel/CSV',
      '流量来源截图+Excel（推荐）',
      '商品表现截图+Excel（推荐）',
      '投放后台截图+Excel（有投放时必传）',
      '售后退款截图+Excel（推荐）',
    ],
    sections: [
      {
        title: '店铺基础信息',
        fields: ['customer_name', 'platform', 'category', 'main_products', 'business_stage', 'period'],
      },
      {
        title: '核心经营数据',
        fields: ['impressions', 'visitors', 'orders', 'gmv', 'aov', 'conversion_rate', 'ad_spend', 'roi', 'refund_rate'],
      },
      {
        title: '经营背景与问题',
        fields: ['weekly_activity', 'customer_problem', 'historical_weeks', 'data_source_notes'],
      },
      {
        title: '数据可用性',
        fields: [
          'has_platform_tier_data',
          'has_industry_peer_data',
          'has_gross_margin',
          'has_ad_attribution',
          'has_product_cost',
          'has_inventory_data',
        ],
      },
    ],
  },
  weekly: {
    title: '周报数据提交清单',
    subtitle: '用于正式账号客户，原则上每周只提交一次，用于生成经营周报。',
    submitLabel: '提交本周周报数据',
    evidence: [
      '本周经营总览截图+Excel',
      '本周流量来源截图+Excel',
      '本周商品表现截图+Excel',
      '本周投放后台截图+Excel',
      '本周售后退款截图+Excel',
    ],
    sections: [
      {
        title: '本周基础信息',
        fields: ['customer_name', 'platform', 'category', 'period'],
      },
      {
        title: '本周经营数据',
        fields: ['impressions', 'visitors', 'orders', 'gmv', 'aov', 'conversion_rate', 'ad_spend', 'roi', 'refund_rate'],
      },
      {
        title: '动作复盘',
        fields: ['previous_actions_result', 'weekly_activity', 'next_week_focus', 'data_source_notes'],
      },
    ],
  },
  monthly: {
    title: '月报数据提交清单',
    subtitle: '用于正式账号客户，原则上每月只提交一次，用于生成经营月报。',
    submitLabel: '提交本月月报数据',
    evidence: [
      '近 4 周/本月经营总览截图+Excel/CSV',
      '近 4 周/本月流量来源截图+Excel/CSV',
      '商品表现截图+Excel/CSV',
      '投放明细截图+Excel/CSV',
      '售后退款截图+Excel/CSV',
      '成本/库存/毛利数据（如有）',
    ],
    sections: [
      {
        title: '本月基础信息',
        fields: ['customer_name', 'platform', 'category', 'period', 'historical_weeks'],
      },
      {
        title: '本月核心数据',
        fields: ['impressions', 'visitors', 'orders', 'gmv', 'aov', 'conversion_rate', 'ad_spend', 'roi', 'refund_rate'],
      },
      {
        title: '月度复盘与经营条件',
        fields: [
          'month_summary',
          'has_gross_margin',
          'has_product_cost',
          'has_inventory_data',
          'has_ad_attribution',
          'data_source_notes',
        ],
      },
    ],
  },
};

export function getChecklist(type) {
  const checklist = CHECKLISTS[type];
  if (!checklist) {
    throw new Error(`Unsupported checklist type: ${type}`);
  }
  return checklist;
}

export function hydrateChecklist(checklist) {
  return {
    ...checklist,
    sections: checklist.sections.map((section) => ({
      ...section,
      fields: section.fields.map((key) => ({ key, ...FIELD_DEFINITIONS[key] })),
    })),
  };
}
