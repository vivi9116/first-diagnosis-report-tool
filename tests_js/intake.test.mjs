import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  getAccessSession,
  getChecklistForSession,
  loadAccessConfig,
  validateSubmissionWindow,
} from '../api/lib/access.js';
import { auditSubmission } from '../api/lib/audit.js';

const webIndex = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const webApp = readFileSync(new URL('../web/app.js', import.meta.url), 'utf8');
const intakeApi = readFileSync(new URL('../api/intake.js', import.meta.url), 'utf8');

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

test('web intake asks users to choose form or Excel CSV after login', () => {
  assert.match(webIndex, /id="submissionModePanel"/);
  assert.match(webIndex, /填表/);
  assert.match(webIndex, /Excel\/CSV/);
  assert.match(webIndex, /只需二选一/);
  assert.match(webApp, /renderSubmissionMode/);
  assert.match(webApp, /selectSubmissionMode/);
});

test('formal accounts go directly to Excel CSV while temporary invites keep two choices', () => {
  assert.match(webApp, /state\.session\.accountType === 'formal_account'/);
  assert.match(webApp, /selectSubmissionMode\('spreadsheet'\)/);
  assert.match(webApp, /renderAccountActions/);
  assert.match(webApp, /modeLogoutButton\.classList\.toggle\('hidden', isTemporaryInvite\)/);
  assert.match(webApp, /logoutButton\.classList\.toggle\('hidden', isTemporaryInvite\)/);
});

test('web intake copy requires screenshot plus data file and hides internal system names', () => {
  assert.match(webIndex, /上传文件/);
  assert.match(webIndex, /截图用于核对关键数字/);
  assert.doesNotMatch(webIndex, /截图 \/ Excel/);
  assert.doesNotMatch(webIndex, /写入 Notion/);
  assert.doesNotMatch(webApp, /Notion/);
  assert.match(webIndex, /审核通过后会进入报告生成流程/);
});

test('third step lets customers return to submission method choice', () => {
  assert.match(webIndex, /id="backToModeButton"/);
  assert.match(webIndex, /返回上一页/);
  assert.match(webApp, /returnToSubmissionMode/);
  assert.match(webApp, /backToModeButton/);
});

test('submission method changes the third step checklist and data entry surface', () => {
  assert.match(webApp, /evidenceForSubmissionMode/);
  assert.match(webApp, /填表数据 \+ 后台截图/);
  assert.match(webApp, /Excel\/CSV 文件 \+ 后台截图/);
  assert.match(webApp, /准备材料/);
  assert.match(webApp, /主要文件/);
  assert.match(webApp, /核对材料/);
  assert.doesNotMatch(webApp, /截图\/Excel/);
  assert.doesNotMatch(webApp, /数据可用性/);
});

test('intake API forwards submission mode into audit', () => {
  assert.match(intakeApi, /const submissionMode = payload\.submissionMode \|\| 'form'/);
  assert.match(intakeApi, /submissionMode,/);
  assert.match(intakeApi, /auditSubmission/);
});

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

test('formal account never exposes first diagnosis even if config includes it', () => {
  const session = getAccessSession('VIP-C901', {
    temporaryInvites: {},
    formalAccounts: {
      'VIP-C901': {
        accountId: 'A901',
        customerId: 'C901',
        customerName: '正式客户误配首诊',
        plan: 'standard',
        allowedReports: ['first_diagnosis', 'weekly', 'monthly'],
      },
    },
  });
  const checklists = getChecklistForSession(session);

  assert.deepEqual(session.allowedSubmissionTypes, ['weekly', 'monthly']);
  assert.equal(checklists.first_diagnosis, undefined);
  assert.equal(checklists.weekly.title, '周报数据提交清单');
  assert.equal(checklists.monthly.title, '月报数据提交清单');
});

const testAccessConfig = {
  temporaryInvites: {
    'TEST-FIRST-OPEN': {
      customerId: 'TEST-FIRST',
      customerName: '研发测试临时邀请码',
      reportType: 'first_diagnosis',
      isTestAccount: true,
    },
  },
  formalAccounts: {
    'TEST-VIP-OPEN': {
      accountId: 'A-TEST-VIP',
      customerId: 'TEST-VIP',
      customerName: '研发测试正式账号',
      plan: 'dev_open',
      allowedReports: ['first_diagnosis', 'weekly', 'monthly'],
      isTestAccount: true,
    },
  },
};

test('env access config can define reusable development test accounts', () => {
  const temporary = getAccessSession('TEST-FIRST-OPEN', testAccessConfig);
  const formal = getAccessSession('TEST-VIP-OPEN', testAccessConfig);

  assert.equal(temporary.isTestAccount, true);
  assert.equal(temporary.accountType, 'temporary_invite');
  assert.deepEqual(temporary.allowedSubmissionTypes, ['first_diagnosis']);
  assert.equal(formal.isTestAccount, true);
  assert.equal(formal.accountType, 'formal_account');
  assert.deepEqual(formal.allowedSubmissionTypes, ['weekly', 'monthly']);
});

test('env access config is merged with reusable development test accounts', () => {
  const config = loadAccessConfig({
    INTAKE_ACCESS_CONFIG: JSON.stringify({
      temporaryInvites: {},
      formalAccounts: {
        'REAL-VIP': {
          accountId: 'A-REAL',
          customerId: 'REAL',
          customerName: '真实客户',
          allowedReports: ['weekly'],
        },
      },
    }),
    INTAKE_TEST_ACCESS_CONFIG: JSON.stringify(testAccessConfig),
  });
  const session = getAccessSession('TEST-VIP-OPEN', config);

  assert.equal(session.isTestAccount, true);
  assert.deepEqual(session.allowedSubmissionTypes, ['weekly', 'monthly']);
  assert.equal(getAccessSession('REAL-VIP', config).customerId, 'REAL');
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

test('test accounts bypass repeated submission limits', () => {
  const temporary = getAccessSession('TEST-FIRST-OPEN', testAccessConfig);
  const formal = getAccessSession('TEST-VIP-OPEN', testAccessConfig);

  const firstDiagnosis = validateSubmissionWindow(temporary, {
    submissionType: 'first_diagnosis',
    periodKey: '2026-W21',
    existingSubmissions: [
      { customerId: 'TEST-FIRST', submissionType: 'first_diagnosis', periodKey: '2026-W20', auditGrade: 'A' },
    ],
  });
  const weekly = validateSubmissionWindow(formal, {
    submissionType: 'weekly',
    periodKey: '2026-W21',
    existingSubmissions: [
      { customerId: 'TEST-VIP', submissionType: 'weekly', periodKey: '2026-W21', auditGrade: 'A' },
    ],
  });

  assert.equal(firstDiagnosis.allowed, true);
  assert.equal(weekly.allowed, true);
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
    submissionMode: 'form',
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

test('audit allows spreadsheet mode with screenshot and Excel CSV evidence only', () => {
  const result = auditSubmission({
    submissionType: 'weekly',
    submissionMode: 'spreadsheet',
    formData: {
      customer_id: 'C900',
      customer_name: '正式托管客户',
    },
    files: [
      { kind: 'screenshot', name: '经营总览截图.png' },
      { kind: 'spreadsheet', name: '后台导出.csv' },
    ],
  });

  assert.equal(result.grade, 'A');
  assert.equal(result.canTriggerReport, true);
  assert.deepEqual(result.missingFields, []);
  assert.deepEqual(result.blockingIssues, []);
});

test('audit blocks spreadsheet mode when either screenshot or Excel CSV is missing', () => {
  const noScreenshot = auditSubmission({
    submissionType: 'weekly',
    submissionMode: 'spreadsheet',
    formData: { customer_id: 'C900', customer_name: '正式托管客户' },
    files: [{ kind: 'spreadsheet', name: '后台导出.csv' }],
  });
  const noSpreadsheet = auditSubmission({
    submissionType: 'weekly',
    submissionMode: 'spreadsheet',
    formData: { customer_id: 'C900', customer_name: '正式托管客户' },
    files: [{ kind: 'screenshot', name: '经营总览截图.png' }],
  });

  assert.equal(noScreenshot.grade, 'C');
  assert.match(noScreenshot.missingEvidence.join('\n'), /后台截图/);
  assert.equal(noSpreadsheet.grade, 'C');
  assert.match(noSpreadsheet.missingEvidence.join('\n'), /Excel\/CSV/);
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
