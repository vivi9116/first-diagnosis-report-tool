import { allowCors, readJson, sendJson } from './lib/http.js';
import { getAccessSession, getChecklistForSession, loadAccessConfig } from './lib/access.js';

export default async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: '只支持 POST。' });
  }

  try {
    const payload = await readJson(req);
    const session = getAccessSession(payload.accessCode, loadAccessConfig());
    return sendJson(res, 200, {
      ok: true,
      session,
      checklists: getChecklistForSession(session),
    });
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: error.message });
  }
}
