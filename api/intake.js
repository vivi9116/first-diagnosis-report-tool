import { allowCors, readJson, sendJson } from './lib/http.js';
import {
  getAccessSession,
  getChecklistForSession,
  loadAccessConfig,
  validateSubmissionWindow,
} from './lib/access.js';
import { auditSubmission } from './lib/audit.js';
import { saveIntakeFiles, triggerGithubWorkflow } from './lib/github.js';
import { createNotionIntakePage, listExistingSubmissions } from './lib/notion.js';

function periodKeyFromPayload(submissionType, payload) {
  if (payload.periodKey) return String(payload.periodKey).trim();
  const period = payload.formData?.period || '';
  if (period) return String(period).trim();
  const now = new Date();
  if (submissionType === 'monthly') {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  }
  return `${now.getUTCFullYear()}-W${Math.ceil((((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 1))) / 86400000) + 1) / 7)}`;
}

export function shouldSkipFilePersist({ payload, submissionType }) {
  const formData = payload.formData || {};
  const customerId = String(formData.customer_id || '').trim();
  const dataSourceNotes = String(formData.data_source_notes || '');

  return (
    submissionType === 'weekly'
    && payload.skipFilePersist === true
    && payload.test_run_type === 'm3_weekly_skip_file_persist'
    && customerId.startsWith('M3-SAFE-')
    && dataSourceNotes.includes('M3_SAFE')
  );
}

function buildSkippedFileIndex(payload, files) {
  return {
    skipped: true,
    reason: 'm3_weekly_safe_test_skip_file_persist',
    originalFileCount: files.length,
    testRunType: payload.test_run_type,
  };
}

export async function processIntakePayload(payload, deps = {}) {
  const {
    loadAccessConfigFn = loadAccessConfig,
    listExistingSubmissionsFn = listExistingSubmissions,
    saveIntakeFilesFn = saveIntakeFiles,
    createNotionIntakePageFn = createNotionIntakePage,
    triggerGithubWorkflowFn = triggerGithubWorkflow,
  } = deps;

  const session = getAccessSession(payload.accessCode, loadAccessConfigFn());
  const submissionType = payload.submissionType || session.allowedSubmissionTypes[0];
  const periodKey = periodKeyFromPayload(submissionType, payload);
  const existingSubmissions = await listExistingSubmissionsFn();
  const windowCheck = validateSubmissionWindow(session, { submissionType, periodKey, existingSubmissions });

  if (!windowCheck.allowed) {
    return {
      statusCode: 409,
      body: {
        ok: false,
        status: 'blocked',
        error: windowCheck.reason,
        session,
        checklists: getChecklistForSession(session),
      },
    };
  }

  const files = payload.files || [];
  const audit = auditSubmission({
    submissionType,
    formData: {
      ...payload.formData,
      customer_id: payload.formData?.customer_id || session.customerId,
      customer_name: payload.formData?.customer_name || session.customerName,
    },
    files,
  });

  const fileIndex = shouldSkipFilePersist({ payload, submissionType, session })
    ? buildSkippedFileIndex(payload, files)
    : await saveIntakeFilesFn({ session, submissionType, periodKey, audit, files });
  const notionPage = await createNotionIntakePageFn({ session, submissionType, periodKey, audit, fileIndex });

  let workflow = { triggered: false, reason: '仅首诊报告在 V1 自动触发 GitHub Actions。' };
  if (submissionType === 'first_diagnosis' && audit.canTriggerReport) {
    workflow = await triggerGithubWorkflowFn({ customerId: session.customerId, dryRun: false });
  }

  return {
    statusCode: 200,
    body: {
      ok: true,
      status: audit.canTriggerReport ? 'accepted' : 'needs_supplement',
      session,
      submissionType,
      periodKey,
      audit,
      fileIndex,
      notionPage,
      workflow,
      checklists: getChecklistForSession(session),
    },
  };
}

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: '只支持 POST。' });
  }

  try {
    const payload = await readJson(req);
    const result = await processIntakePayload(payload);
    return sendJson(res, result.statusCode, result.body);
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
}
