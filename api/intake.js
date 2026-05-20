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

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: '只支持 POST。' });
  }

  try {
    const payload = await readJson(req);
    const session = getAccessSession(payload.accessCode, loadAccessConfig());
    const submissionType = payload.submissionType || session.allowedSubmissionTypes[0];
    const periodKey = periodKeyFromPayload(submissionType, payload);
    const existingSubmissions = await listExistingSubmissions();
    const windowCheck = validateSubmissionWindow(session, { submissionType, periodKey, existingSubmissions });

    if (!windowCheck.allowed) {
      return sendJson(res, 409, {
        ok: false,
        status: 'blocked',
        error: windowCheck.reason,
        session,
        checklists: getChecklistForSession(session),
      });
    }

    const audit = auditSubmission({
      submissionType,
      formData: {
        ...payload.formData,
        customer_id: payload.formData?.customer_id || session.customerId,
        customer_name: payload.formData?.customer_name || session.customerName,
      },
      files: payload.files || [],
    });

    const fileIndex = await saveIntakeFiles({ session, submissionType, periodKey, audit, files: payload.files || [] });
    const notionPage = await createNotionIntakePage({ session, submissionType, periodKey, audit, fileIndex });

    let workflow = { triggered: false, reason: '仅首诊报告在 V1 自动触发 GitHub Actions。' };
    if (submissionType === 'first_diagnosis' && audit.canTriggerReport) {
      workflow = await triggerGithubWorkflow({ customerId: session.customerId, dryRun: false });
    }

    return sendJson(res, 200, {
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
    });
  } catch (error) {
    return sendJson(res, 500, { ok: false, error: error.message });
  }
}
