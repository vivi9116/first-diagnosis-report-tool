function requireGithubEnv(env = process.env) {
  if (!env.GITHUB_TOKEN) throw new Error('缺少 GITHUB_TOKEN。');
  if (!env.GITHUB_REPO) throw new Error('缺少 GITHUB_REPO。');
  return {
    token: env.GITHUB_TOKEN,
    repo: env.GITHUB_REPO,
    ref: env.GITHUB_REF || 'main',
    workflowId: env.GITHUB_WORKFLOW_ID || 'generate-report.yml',
  };
}

function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

function safePathPart(value) {
  return String(value || 'unknown')
    .replace(/[^\w\u4e00-\u9fa5.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

async function putContentFile({ path, contentBase64, message }, env = process.env) {
  const { token, repo, ref } = requireGithubEnv(env);
  const response = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path).replace(/%2F/g, '/')}`, {
    method: 'PUT',
    headers: githubHeaders(token),
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch: ref,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`GitHub 文件保存失败：${response.status} ${JSON.stringify(body)}`);
  }
  return body.content?.path || path;
}

function toBase64(text) {
  return Buffer.from(text, 'utf8').toString('base64');
}

export async function saveIntakeFiles({ session, submissionType, periodKey, audit, files = [] }, env = process.env) {
  if (!files.length && !env.GITHUB_TOKEN) return { root: '', files: [], skipped: true };
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const root = [
    'customer_uploads',
    safePathPart(session.customerId),
    safePathPart(submissionType),
    safePathPart(periodKey),
    timestamp,
  ].join('/');

  const savedFiles = [];
  const manifest = {
    customerId: session.customerId,
    accountType: session.accountType,
    submissionType,
    periodKey,
    audit,
    createdAt: new Date().toISOString(),
    files: files.map((file) => ({
      name: file.name,
      kind: file.kind,
      mimeType: file.mimeType,
      size: file.size,
    })),
  };

  savedFiles.push(await putContentFile({
    path: `${root}/manifest.json`,
    contentBase64: toBase64(JSON.stringify(manifest, null, 2)),
    message: `Add intake manifest for ${session.customerId}`,
  }, env));

  for (const file of files) {
    if (!file.contentBase64) continue;
    const filePath = `${root}/${safePathPart(file.kind || 'file')}/${safePathPart(file.name || 'upload.bin')}`;
    savedFiles.push(await putContentFile({
      path: filePath,
      contentBase64: file.contentBase64,
      message: `Add intake file for ${session.customerId}`,
    }, env));
  }

  return { root, files: savedFiles, skipped: false };
}

export async function triggerGithubWorkflow({ customerId, dryRun = false }, env = process.env) {
  if (env.AUTO_TRIGGER_GITHUB === 'false') {
    return { triggered: false, reason: 'AUTO_TRIGGER_GITHUB=false' };
  }
  const { token, repo, ref, workflowId } = requireGithubEnv(env);
  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflowId}/dispatches`, {
    method: 'POST',
    headers: githubHeaders(token),
    body: JSON.stringify({
      ref,
      inputs: {
        source: 'notion',
        customer_id: customerId,
        dry_run: String(Boolean(dryRun)),
      },
    }),
  });

  if (response.status !== 204) {
    const body = await response.text();
    throw new Error(`GitHub Actions 触发失败：${response.status} ${body}`);
  }
  return { triggered: true, workflowId, ref };
}
