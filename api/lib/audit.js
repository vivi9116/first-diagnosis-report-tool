const FIELD_LABELS = {
  customer_name: '客户名称',
  platform: '平台',
  category: '类目',
  main_products: '主营产品',
  business_stage: '经营阶段',
  period: '数据周期',
  impressions: '曝光量',
  visitors: '访客数',
  orders: '订单数',
  gmv: '支付金额',
  aov: '客单价',
  conversion_rate: '转化率',
  refund_rate: '退款率',
  customer_problem: '客户自述问题',
  historical_weeks: '历史数据周数',
  previous_actions_result: '上期动作结果',
  month_summary: '本月经营总结',
  data_source_notes: '数据来源说明',
};

const REQUIRED_FIELDS = {
  first_diagnosis: [
    'customer_name',
    'platform',
    'category',
    'main_products',
    'business_stage',
    'period',
    'impressions',
    'visitors',
    'orders',
    'gmv',
    'aov',
    'conversion_rate',
    'refund_rate',
    'customer_problem',
    'historical_weeks',
    'data_source_notes',
  ],
  weekly: [
    'customer_name',
    'platform',
    'category',
    'period',
    'visitors',
    'orders',
    'gmv',
    'aov',
    'conversion_rate',
    'refund_rate',
    'previous_actions_result',
    'data_source_notes',
  ],
  monthly: [
    'customer_name',
    'platform',
    'category',
    'period',
    'historical_weeks',
    'visitors',
    'orders',
    'gmv',
    'aov',
    'conversion_rate',
    'refund_rate',
    'month_summary',
    'data_source_notes',
  ],
};

const NUMBER_FIELDS = [
  'impressions',
  'visitors',
  'orders',
  'gmv',
  'aov',
  'conversion_rate',
  'ad_spend',
  'roi',
  'refund_rate',
  'historical_weeks',
];

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const cleaned = String(value)
    .trim()
    .replace(/,/g, '')
    .replace(/%/g, '')
    .replace(/万/g, '0000')
    .replace(/w/gi, '0000')
    .replace(/元/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function relativeGap(a, b) {
  if (!a || !b) return 0;
  return Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
}

function rateToRatio(value) {
  const number = toNumber(value);
  if (number === null) return null;
  return number > 1 ? number / 100 : number;
}

function classifyFiles(files = []) {
  const normalized = files.map((file) => {
    const name = file.name || '';
    const lower = name.toLowerCase();
    let kind = file.kind || 'other';
    if (['.png', '.jpg', '.jpeg', '.webp'].some((ext) => lower.endsWith(ext))) kind = 'screenshot';
    if (['.xls', '.xlsx', '.csv'].some((ext) => lower.endsWith(ext))) kind = 'spreadsheet';
    return { ...file, kind };
  });

  return {
    all: normalized,
    screenshots: normalized.filter((file) => file.kind === 'screenshot'),
    spreadsheets: normalized.filter((file) => file.kind === 'spreadsheet'),
  };
}

export function normalizeFormData(formData = {}) {
  const normalized = { ...formData };
  for (const field of NUMBER_FIELDS) {
    if (!isBlank(normalized[field])) {
      normalized[field] = toNumber(normalized[field]);
    }
  }
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === 'string') normalized[key] = value.trim();
  }
  return normalized;
}

export function auditSubmission({ submissionType = 'first_diagnosis', submissionMode = 'form', formData = {}, files = [] }) {
  const normalized = normalizeFormData(formData);
  const isSpreadsheetMode = submissionMode === 'spreadsheet';
  const required = isSpreadsheetMode ? [] : (REQUIRED_FIELDS[submissionType] || REQUIRED_FIELDS.first_diagnosis);
  const missingFields = required
    .filter((field) => isBlank(normalized[field]))
    .map((field) => FIELD_LABELS[field] || field);
  const blockingIssues = [];
  const warnings = [];
  const missingEvidence = [];
  const fileGroups = classifyFiles(files);

  if (missingFields.length > 0) {
    blockingIssues.push(`缺少必填字段：${missingFields.join('、')}`);
  }

  if (fileGroups.screenshots.length === 0) {
    missingEvidence.push('缺少后台截图。截图用于验证和核对本次提交的数据，是必选项。');
    blockingIssues.push('缺少后台截图。');
  }

  if (isSpreadsheetMode && fileGroups.spreadsheets.length === 0) {
    missingEvidence.push('缺少 Excel/CSV 文件。你选择了 Excel/CSV 提交，请上传后台导出的 Excel/CSV 文件。');
    blockingIssues.push('缺少 Excel/CSV 文件。');
  }

  const gmv = normalized.gmv;
  const orders = normalized.orders;
  const aov = normalized.aov;
  if (gmv && orders && aov) {
    const estimatedGmv = orders * aov;
    if (relativeGap(gmv, estimatedGmv) > 0.2) {
      warnings.push(`支付金额与「订单数 × 客单价」差异较大，需确认 GMV 或客单价口径。`);
    }
  }

  const visitors = normalized.visitors;
  const conversionRatio = rateToRatio(normalized.conversion_rate);
  if (visitors && conversionRatio && orders) {
    const estimatedOrders = visitors * conversionRatio;
    if (relativeGap(orders, estimatedOrders) > 0.25) {
      warnings.push('订单数与「访客数 × 转化率」差异较大，需确认转化率口径。');
    }
  }

  const adSpend = normalized.ad_spend;
  const roi = normalized.roi;
  if (gmv && adSpend && roi) {
    const estimatedRoi = gmv / adSpend;
    if (relativeGap(roi, estimatedRoi) > 0.3) {
      warnings.push(`ROI 与「支付金额 ÷ 投放消耗」差异较大，需确认 ROI 是广告成交口径还是全店口径。`);
    }
  }

  const grade = blockingIssues.length > 0 ? 'C' : warnings.length > 0 ? 'B' : 'A';
  return {
    grade,
    canTriggerReport: grade !== 'C',
    normalizedData: normalized,
    missingFields,
    missingEvidence,
    blockingIssues,
    warnings,
    fileSummary: {
      total: fileGroups.all.length,
      screenshots: fileGroups.screenshots.map((file) => file.name),
      spreadsheets: fileGroups.spreadsheets.map((file) => file.name),
    },
  };
}
