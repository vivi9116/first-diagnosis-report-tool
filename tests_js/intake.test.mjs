import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAccessSession,
  getChecklistForSession,
  validateSubmissionWindow,
} from '../api/lib/access.js';
import { auditSubmission } from '../api/lib/audit.js';
import { processIntakePayload, shouldSkipFilePersist } from '../api/intake.js';

const accessConfig = {
  temporaryInvites: {
    'TEMP-C101': {
      customerId: 'C101',
      customerName: '一次性首诊客户',
      reportType: 'first_diagnosis',
    },
  },
  formalAccounts: {
    'VIP-C900': {
      accountId: 'A900',
      customerId: 'C900',
      customerName: '正式托管客户',
      plan: 'standard',
      allowedReports: ['weekly', 'monthly'],
    },
  },
};

function makeSafeWeeklyPayload(overrides = {}) {
  const formData = {
    customer_id: 'M3-SAFE-DRYRUN',
    customer_name: '脱敏测试客户_M3_SAFE_DRYRUN',
    period: 'M3-SAFE-DRYRUN-2026-WXX',
    data_source_notes: 'M3_SAFE_DRYRUN_ONLY_NO_REAL_CUSTOMER_DATA',
    platform: '测试平台',
    category: '测试类目',
    visitors: 10000,
    orders: 320,
    gmv: 25600,
    aov: 80,
    conversion_rate: 3.2,
    refund_rate: 1.5,
    previous_actions_result: '上周测试动作：优化商品标题与主图；本周仅用于 dry-run 校验',
    ...(overrides.formData || {}),
  };

  return {
    accessCode: 'VIP-C900',
    submissionType: 'weekly',
    periodKey: 'M3-SAFE-DRYRUN-2026-WXX',
    skipFilePersist: true,
    test_run_type: 'm3_weekly_skip_file_persist',
    files: [{ kind: 'spreadsheet', name: 'm3-safe-dryrun-fake-evidence.csv' }],
    ...overrides,
    formData,
  };
}

function intakeDeps(overrides = {}) {
  return {
    loadAccessConfigFn: () => accessConfig,
    listExistingSubmissionsFn: async () => [],
    ...overrides,
  };
}

test('temporary invite only exposes first diagnosis checklist', () => {
  const session = getAccessSession('TEMP-C101', accessConfig);
  const checklists = getChecklistForSession(session);

  assert.equal(session.accountType, 'temporary_invite');
  assert.deepEqual(session.allowedSubmissionTypes, ['first_diagnosis']);
  assert.equal(checklists.first_diagnosis.title, '首诊数据提交清单');
  assert.equal(checklists.weekly, undefined);
  assert.equal(checklists.monthly, undefined);
});

test('formal account exposes weekly and monthly checklists', () => {
  const session = getAccessSession('VIP-C900', accessConfig);
  const checklists = getChecklistForSession(session);

  assert.equal(session.accountType, 'formal_account');
  assert.deepEqual(session.allowedSubmissionTypes, ['weekly', 'monthly']);
  assert.equal(checklists.weekly.title, '周报数据提交清单');
  assert.equal(checklists.monthly.title, '月报数据提交清单');
});

test('temporary invite cannot submit a second first diagnosis', () => {
  const session = getAccessSession('TEMP-C101', accessConfig);
  const result = validateSubmissionWindow(session, {
    submissionType: 'first_diagnosis',
    periodKey: '2026-W21',
    existingSubmissions: [
      { customerId: 'C101', submissionType: 'first_diagnosis', periodKey: '2026-W20' },
    ],
  });

  assert.equal(result.allowed, false);
  assert.match(result.reason, /只能提交一次/);
});

test('formal weekly account cannot submit twice for the same week', () => {
  const session = getAccessSession('VIP-C900', accessConfig);
  const result = validateSubmissionWindow(session, {
    submissionType: 'weekly',
    periodKey: '2026-W21',
    existingSubmissions: [
      { customerId: 'C900', submissionType: 'weekly', periodKey: '2026-W21' },
    ],
  });

  assert.equal(result.allowed, false);
  assert.match(result.reason, /本周已提交/);
});

test('audit blocks report generation when core data or evidence is missing', () => {
  const result = auditSubmission({
    submissionType: 'first_diagnosis',
    formData: {
      customer_id: 'C102',
      customer_name: '缺数据店铺',
      platform: '淘宝',
      category: '家居百货',
      period: '2026-05-11 至 2026-05-17',
      visitors: 1200,
    },
    files: [],
  });

  assert.equal(result.grade, 'C');
  assert.equal(result.canTriggerReport, false);
  assert.ok(result.missingFields.includes('支付金额'));
  assert.ok(result.missingEvidence.length > 0);
});

test('audit allows first diagnosis when core data and evidence are complete', () => {
  const result = auditSubmission({
    submissionType: 'first_diagnosis',
    formData: {
      customer_id: 'C103',
      customer_name: '完整数据店铺',
      platform: '淘宝',
      category: '家居百货',
      main_products: '收纳盒',
      business_stage: '新店',
      period: '2026-05-11 至 2026-05-17',
      impressions: 18000,
      visitors: 1250,
      orders: 38,
      gmv: 4560,
      aov: 120,
      conversion_rate: 3.04,
      ad_spend: 800,
      roi: 5.7,
      refund_rate: 2.1,
      customer_problem: '访客有增长，成交不稳定。',
      historical_weeks: 1,
      data_source_notes: '商家后台导出数据与截图',
    },
    files: [
      { kind: 'screenshot', name: '经营总览.png' },
      { kind: 'spreadsheet', name: '后台导出.csv' },
    ],
  });

  assert.equal(result.grade, 'A');
  assert.equal(result.canTriggerReport, true);
  assert.equal(result.blockingIssues.length, 0);
});

test('audit downgrades to cautious report when ROI logic conflicts', () => {
  const result = auditSubmission({
    submissionType: 'first_diagnosis',
    formData: {
      customer_id: 'C104',
      customer_name: 'ROI口径冲突店铺',
      platform: '淘宝',
      category: '家居百货',
      main_products: '收纳盒',
      business_stage: '新店',
      period: '2026-05-11 至 2026-05-17',
      impressions: 18000,
      visitors: 1250,
      orders: 38,
      gmv: 10000,
      aov: 263.16,
      conversion_rate: 3.04,
      ad_spend: 1000,
      roi: 2,
      refund_rate: 2.1,
      customer_problem: '投放回报不稳定。',
      historical_weeks: 1,
      data_source_notes: '商家后台截图',
    },
    files: [{ kind: 'screenshot', name: '投放后台.png' }],
  });

  assert.equal(result.grade, 'B');
  assert.equal(result.canTriggerReport, true);
  assert.match(result.warnings.join('\n'), /ROI/);
});

test('skipFilePersist gate rejects incomplete or non-weekly payloads', () => {
  const cases = [
    ['missing test_run_type', { test_run_type: undefined }],
    ['customer id not safe', { formData: { customer_id: 'C900' } }],
    ['data source notes missing safe marker', { formData: { data_source_notes: 'DRYRUN_ONLY_NO_REAL_CUSTOMER_DATA' } }],
    ['submission type is not weekly', { submissionType: 'monthly' }],
  ];

  for (const [name, override] of cases) {
    const payload = makeSafeWeeklyPayload(override);
    assert.equal(
      shouldSkipFilePersist({
        payload,
        submissionType: payload.submissionType,
        session: { customerId: 'C900' },
      }),
      false,
      name,
    );
  }
});

test('ordinary payload with skipFilePersist still persists files before Notion', async () => {
  const payload = makeSafeWeeklyPayload({
    formData: {
      customer_id: 'C900',
      data_source_notes: 'M3_SAFE_DRYRUN_ONLY_NO_REAL_CUSTOMER_DATA',
    },
  });
  let saveCalled = false;
  let notionInput;
  let workflowCalled = false;

  const result = await processIntakePayload(payload, intakeDeps({
    saveIntakeFilesFn: async () => {
      saveCalled = true;
      return { root: 'mock-root', files: ['mock-root/manifest.json'], skipped: false };
    },
    createNotionIntakePageFn: async (input) => {
      notionInput = input;
      return { id: 'mock-page', url: 'https://notion.local/mock-page' };
    },
    triggerGithubWorkflowFn: async () => {
      workflowCalled = true;
      return { triggered: true };
    },
  }));

  assert.equal(result.statusCode, 200);
  assert.equal(saveCalled, true);
  assert.equal(notionInput.fileIndex.skipped, false);
  assert.equal(result.body.fileIndex.skipped, false);
  assert.equal(workflowCalled, false);
});

test('safe M3 weekly payload skips file persistence, writes Notion, and does not trigger workflow', async () => {
  const payload = makeSafeWeeklyPayload();
  let notionInput;
  let workflowCalled = false;

  const result = await processIntakePayload(payload, intakeDeps({
    saveIntakeFilesFn: async () => {
      throw new Error('saveIntakeFiles should not be called for safe M3 weekly skip test');
    },
    createNotionIntakePageFn: async (input) => {
      notionInput = input;
      return { id: 'mock-page', url: 'https://notion.local/mock-page' };
    },
    triggerGithubWorkflowFn: async () => {
      workflowCalled = true;
      return { triggered: true };
    },
  }));

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.fileIndex.skipped, true);
  assert.equal(result.body.fileIndex.reason, 'm3_weekly_safe_test_skip_file_persist');
  assert.equal(result.body.fileIndex.originalFileCount, 1);
  assert.equal(result.body.fileIndex.testRunType, 'm3_weekly_skip_file_persist');
  assert.equal(notionInput.fileIndex.skipped, true);
  assert.equal(workflowCalled, false);
  assert.equal(result.body.workflow.triggered, false);
});
