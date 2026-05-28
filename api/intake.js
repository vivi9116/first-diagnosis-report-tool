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

function envPresence(env = process.env) {
  return {
    hasNotionToken: Boolean(env.NOTION_TOKEN),
    hasNotionDatabaseId: Boolean(env.NOTION_DATABASE_ID),
    hasGithubToken: Boolean(env.GITHUB_TOKEN),
    hasGithubRepo: Boolean(env.GITHUB_REPO),
    hasIntakeAccessConfig: Boolean(env.INTAKE_ACCESS_CONFIG),
  };
}

function safeErrorMessage(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('notion')) return 'notion_error';
  if (message.includes('github')) return 'github_error';
  if (message.includes('json')) return 'json_error';
  if (message.includes('access') || message.includes('访问') || message.includes('邀请码')) return 'access_error';
  if (message.includes('database')) return 'database_error';
  if (message.includes('token')) return 'token_error';
  return 'internal_error';
}

function buildDiagnostics(context, error) {
  return {
    stage: context.stage,
    submissionType: context.submissionType || '',
    safeMarkerMatched: Boolean(context.safeMarkerMatched),
    skipFilePersistMatched: context.skipFilePersistMatched == null ? null : Boolean(context.skipFilePersistMatched),
    auditGrade: context.audit?.grade || null,
    canTriggerReport: context.audit ? Boolean(context.audit.canTriggerReport) : null,
    fileIndexSkipped: context.fileIndex ? Boolean(context.fileIndex.skipped) : null,
    originalFileCount: context.fileIndex?.originalFileCount ?? context.originalFileCount ?? null,
    envPresence: envPresence(context.env),
    errorType: error?.name || 'Error',
    errorMessageSafe: safeErrorMessage(error),
  };
}

function safeFileCount(payload) {
  try {
    if (!Array.isArray(payload?.files)) return null;
    return payload.files.length;
  } catch {
    return null;
  }
}

function parseJsonPrefix(raw) {
  if (typeof raw !== 'string') return null;

  const markerIndex = raw.indexOf(',"files"');
  if (markerIndex > -1) {
    return JSON.parse(`${raw.slice(0, markerIndex)}}`);
  }

  const formDataIndex = raw.indexOf(',"formData"');
  if (formDataIndex > -1) {
    return JSON.parse(`${raw.slice(0, formDataIndex)}}`);
  }

  return null;
}

function safePayloadForHandlerDiagnostics(req) {
  try {
    if (req.body && typeof req.body === 'object') return req.body;
    return parseJsonPrefix(req.body);
  } catch {
    return null;
  }
}

function safeM3MarkerFromPayload(payload) {
  const submissionType = payload?.submissionType || '';
  const safeMarkerMatched = shouldSkipFilePersist({ payload: payload || {}, submissionType });
  return {
    matched: safeMarkerMatched,
    context: {
      stage: 'read_payload',
      env: process.env,
      submissionType,
      safeMarkerMatched,
      skipFilePersistMatched: null,
      originalFileCount: safeFileCount(payload),
    },
  };
}

function buildHandlerDiagnostics(context, error) {
  return {
    ...buildDiagnostics(context, error),
    handlerDiagnostics: true,
  };
}

export async function processIntakePayload(payload, deps = {}) {
  const {
    loadAccessConfigFn = loadAccessConfig,
    listExistingSubmissionsFn = listExistingSubmissions,
    saveIntakeFilesFn = saveIntakeFiles,
    createNotionIntakePageFn = createNotionIntakePage,
    triggerGithubWorkflowFn = triggerGithubWorkflow,
    env = process.env,
  } = deps;

  const context = {
    stage: 'get_access_session',
    env,
    safeMarkerMatched: shouldSkipFilePersist({ payload, submissionType: payload.submissionType }),
    skipFilePersistMatched: false,
    originalFileCount: (payload.files || []).length,
  };

  try {
    const session = getAccessSession(payload.accessCode, loadAccessConfigFn());
    const submissionType = payload.submissionType || session.allowedSubmissionTypes[0];
    context.submissionType = submissionType;
    context.safeMarkerMatched = shouldSkipFilePersist({ payload, submissionType });

    const periodKey = periodKeyFromPayload(submissionType, payload);
    context.stage = 'list_existing_submissions';
    const existingSubmissions = await listExistingSubmissionsFn();
    context.stage = 'validate_submission_window';
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
    context.originalFileCount = files.length;
    context.stage = 'audit_submission';
    const audit = auditSubmission({
      submissionType,
      formData: {
        ...payload.formData,
        customer_id: payload.formData?.customer_id || session.customerId,
        customer_name: payload.formData?.customer_name || session.customerName,
      },
      files,
    });
    context.audit = audit;

    context.stage = 'decide_skip_file_persist';
    const skipFilePersist = shouldSkipFilePersist({ payload, submissionType, session });
    context.skipFilePersistMatched = skipFilePersist;
    context.stage = skipFilePersist ? 'create_notion_intake_page' : 'save_intake_files';
    const fileIndex = skipFilePersist
      ? buildSkippedFileIndex(payload, files)
      : await saveIntakeFilesFn({ session, submissionType, periodKey, audit, files });
    context.fileIndex = fileIndex;
    context.stage = 'create_notion_intake_page';
    const notionPage = await createNotionIntakePageFn({ session, submissionType, periodKey, audit, fileIndex });

    context.stage = 'trigger_workflow';
    let workflow = { triggered: false, reason: '仅首诊报告在 V1 自动触发 GitHub Actions。' };
    if (submissionType === 'first_diagnosis' && audit.canTriggerReport) {
      workflow = await triggerGithubWorkflowFn({ customerId: session.customerId, dryRun: false });
    }

    context.stage = 'completed';

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
  } catch (error) {
    if (context.safeMarkerMatched) {
      return {
        statusCode: 500,
        body: {
          ok: false,
          error: 'safe_m3_test_failed',
          diagnostics: buildDiagnostics(context, error),
        },
      };
    }
    throw error;
  }
}

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: '只支持 POST。' });
  }

  let payload;
  let handlerContext = {
    stage: 'read_payload',
    env: process.env,
    safeMarkerMatched: false,
    skipFilePersistMatched: null,
    originalFileCount: null,
  };

  try {
    payload = await readJson(req);
    const submissionType = payload?.submissionType || '';
    const safeMarkerMatched = shouldSkipFilePersist({ payload, submissionType });
    handlerContext = {
      ...handlerContext,
      stage: 'process_intake_payload',
      submissionType,
      safeMarkerMatched,
      skipFilePersistMatched: safeMarkerMatched ? true : false,
      originalFileCount: safeFileCount(payload),
    };
    const result = await processIntakePayload(payload);
    return sendJson(res, result.statusCode, result.body);
  } catch (error) {
    const marker = safeM3MarkerFromPayload(payload || safePayloadForHandlerDiagnostics(req));
    if (handlerContext.safeMarkerMatched || marker.matched) {
      const diagnosticsContext = handlerContext.safeMarkerMatched ? handlerContext : marker.context;
      return sendJson(res, 500, {
        ok: false,
        error: 'safe_m3_handler_failed',
        diagnostics: buildHandlerDiagnostics(diagnosticsContext, error),
      });
    }

    return sendJson(res, 500, { ok: false, error: error.message });
  }
}
