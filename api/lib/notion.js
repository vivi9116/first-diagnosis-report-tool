const NOTION_VERSION = '2022-06-28';

const FIELD_TO_NOTION = {
  customer_id: ['客户编号', 'title'],
  customer_name: ['客户名称', 'rich_text'],
  platform: ['平台', 'select'],
  category: ['类目', 'select'],
  main_products: ['主营产品', 'rich_text'],
  business_stage: ['经营阶段', 'select'],
  period: ['数据周期', 'rich_text'],
  impressions: ['曝光量', 'number'],
  visitors: ['访客数', 'number'],
  orders: ['订单数', 'number'],
  gmv: ['支付金额', 'number'],
  aov: ['客单价', 'number'],
  conversion_rate: ['转化率', 'number'],
  ad_spend: ['投放消耗', 'number'],
  roi: ['投产比', 'number'],
  refund_rate: ['退款率', 'number'],
  weekly_activity: ['本周活动/上新', 'rich_text'],
  customer_problem: ['客户自述问题', 'rich_text'],
  historical_weeks: ['历史数据周数', 'number'],
  has_platform_tier_data: ['是否有平台同层级数据', 'checkbox'],
  has_industry_peer_data: ['是否有行业/同层级数据', 'checkbox'],
  has_gross_margin: ['是否有毛利率', 'checkbox'],
  has_ad_attribution: ['是否有投放归因', 'checkbox'],
  has_product_cost: ['是否有商品成本', 'checkbox'],
  has_inventory_data: ['是否有库存数据', 'checkbox'],
  data_source_notes: ['数据来源说明', 'rich_text'],
  notes: ['备注', 'rich_text'],
  report_status: ['报告状态', 'select'],
};

function notionHeaders(env = process.env) {
  if (!env.NOTION_TOKEN) throw new Error('缺少 NOTION_TOKEN。');
  return {
    Authorization: `Bearer ${env.NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

function richText(content) {
  return [{ type: 'text', text: { content: String(content || '').slice(0, 1900) } }];
}

function toProperty(type, value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (type === 'title') return { title: richText(value) };
  if (type === 'rich_text') return { rich_text: richText(value) };
  if (type === 'select') return { select: { name: String(value) } };
  if (type === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? { number } : undefined;
  }
  if (type === 'checkbox') return { checkbox: value === true || value === 'true' || value === '__YES__' };
  if (type === 'url') return { url: String(value) };
  return undefined;
}

function getPlainText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') {
    const title = Array.isArray(prop.title) ? prop.title : [];
    return title.map((item) => item?.plain_text || '').join('');
  }
  if (prop.type === 'rich_text') {
    const richTextItems = Array.isArray(prop.rich_text) ? prop.rich_text : [];
    return richTextItems.map((item) => item?.plain_text || '').join('');
  }
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'status') return prop.status?.name || '';
  if (prop.type === 'date') return prop.date?.start || '';
  if (prop.type === 'formula') return getPlainText(prop.formula);
  if (prop.type === 'number') return prop.number;
  if (prop.type === 'checkbox') return prop.checkbox ? '__YES__' : '__NO__';
  return '';
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function listExistingSubmissionsError(substage, error) {
  const errorName = error?.name || 'Error';
  const wrapped = new Error(`list_existing_submissions_failed:${substage}:${errorName}`);
  wrapped.name = 'list_existing_submissions_failed';
  wrapped.substage = substage;
  return wrapped;
}

function ensureListSubstage(substage, fn) {
  try {
    return fn();
  } catch (error) {
    if (error?.name === 'list_existing_submissions_failed') throw error;
    throw listExistingSubmissionsError(substage, error);
  }
}

function buildMetadata({ session, submissionType, periodKey, audit, fileIndex }) {
  return {
    marker: 'INTAKE_META',
    accountType: session.accountType,
    accessCode: session.accessCode,
    accountId: session.accountId || '',
    submissionType,
    periodKey,
    auditGrade: audit.grade,
    canTriggerReport: audit.canTriggerReport,
    files: fileIndex,
    createdAt: new Date().toISOString(),
  };
}

export function buildNotionProperties({ session, submissionType, periodKey, audit, fileIndex }) {
  const formData = {
    ...audit.normalizedData,
    customer_id: audit.normalizedData.customer_id || session.customerId,
    customer_name: audit.normalizedData.customer_name || session.customerName,
  };
  const metadata = buildMetadata({ session, submissionType, periodKey, audit, fileIndex });
  const notes = [
    audit.normalizedData.notes || '',
    `INTAKE_META:${JSON.stringify(metadata)}`,
    audit.blockingIssues.length ? `阻断问题：${audit.blockingIssues.join('；')}` : '',
    audit.warnings.length ? `审核提醒：${audit.warnings.join('；')}` : '',
  ].filter(Boolean).join('\n');

  if (submissionType === 'first_diagnosis' && audit.canTriggerReport) {
    formData.report_status = '待生成';
  }
  formData.notes = notes;

  const properties = {};
  for (const [field, [notionName, type]] of Object.entries(FIELD_TO_NOTION)) {
    const property = toProperty(type, formData[field]);
    if (property) properties[notionName] = property;
  }
  return properties;
}

export async function createNotionIntakePage(input, env = process.env) {
  const databaseId = env.NOTION_DATABASE_ID;
  if (!databaseId) throw new Error('缺少 NOTION_DATABASE_ID。');

  const response = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: notionHeaders(env),
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties: buildNotionProperties(input),
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: richText(`客户数据采集入口 V1 自动提交。审核等级：${input.audit.grade}`),
          },
        },
      ],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Notion 写入失败：${response.status} ${JSON.stringify(body)}`);
  }
  return { id: body.id, url: body.url };
}

export async function listExistingSubmissions(env = process.env) {
  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) return [];

  let response;
  try {
    response = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: notionHeaders(env),
      body: JSON.stringify({ page_size: 100 }),
    });
  } catch (error) {
    throw listExistingSubmissionsError('notion_query_start', error);
  }

  let body;
  try {
    body = await response.json();
  } catch (error) {
    throw listExistingSubmissionsError('notion_query_json', error);
  }

  if (!response.ok) {
    if (!isObject(body)) {
      throw listExistingSubmissionsError('notion_query_validate_body', new Error('invalid_error_body'));
    }
    throw listExistingSubmissionsError('notion_query_response', new Error('notion_query_failed'));
  }

  const results = ensureListSubstage('notion_query_validate_results', () => (
    Array.isArray(body?.results) ? body.results : []
  ));

  return results.map((page) => ensureListSubstage('notion_query_map_page', () => {
    const props = ensureListSubstage('notion_query_read_properties', () => (
      isObject(page?.properties) ? page.properties : {}
    ));
    const customerId = ensureListSubstage('notion_query_read_title', () => getPlainText(props['客户编号']));
    const notes = ensureListSubstage('notion_query_read_metadata', () => String(getPlainText(props['备注']) || ''));
    const marker = 'INTAKE_META:';
    const markerIndex = notes.indexOf(marker);
    let meta = {};
    if (markerIndex >= 0) {
      ensureListSubstage('notion_query_parse_metadata', () => {
        const jsonText = notes.slice(markerIndex + marker.length).split('\n')[0];
        try {
          meta = JSON.parse(jsonText);
        } catch (_) {
          meta = {};
        }
      });
    }
    return ensureListSubstage('notion_query_completed', () => ({
      pageId: page?.id || '',
      customerId,
      submissionType: meta.submissionType || 'first_diagnosis',
      periodKey: meta.periodKey || '',
      auditGrade: meta.auditGrade || '',
    }));
  }));
}
