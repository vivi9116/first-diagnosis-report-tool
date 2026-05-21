import { getChecklist, hydrateChecklist } from './checklists.js';

const DEFAULT_ACCESS_CONFIG = {
  temporaryInvites: {
    'DEMO-FIRST': {
      customerId: 'C-DEMO',
      customerName: '演示首诊客户',
      reportType: 'first_diagnosis',
    },
  },
  formalAccounts: {
    'DEMO-VIP': {
      accountId: 'A-DEMO',
      customerId: 'VIP-DEMO',
      customerName: '演示正式客户',
      plan: 'standard',
      allowedReports: ['weekly', 'monthly'],
    },
  },
};

function mergeAccessConfig(config = {}) {
  return {
    temporaryInvites: {
      ...DEFAULT_ACCESS_CONFIG.temporaryInvites,
      ...(config.temporaryInvites || {}),
    },
    formalAccounts: {
      ...DEFAULT_ACCESS_CONFIG.formalAccounts,
      ...(config.formalAccounts || {}),
    },
  };
}

export function loadAccessConfig(env = process.env) {
  const raw = env.INTAKE_ACCESS_CONFIG;
  if (!raw) return DEFAULT_ACCESS_CONFIG;
  try {
    return mergeAccessConfig(JSON.parse(raw));
  } catch (error) {
    throw new Error(`INTAKE_ACCESS_CONFIG 不是合法 JSON：${error.message}`);
  }
}

export function getAccessSession(accessCode, config = loadAccessConfig()) {
  const code = String(accessCode || '').trim();
  if (!code) {
    throw new Error('请输入邀请码或正式账号访问码。');
  }

  const temporaryInvite = config.temporaryInvites?.[code];
  if (temporaryInvite) {
    return {
      accessCode: code,
      accountType: 'temporary_invite',
      customerId: temporaryInvite.customerId,
      customerName: temporaryInvite.customerName || '',
      plan: 'first_diagnosis',
      allowedSubmissionTypes: [temporaryInvite.reportType || 'first_diagnosis'],
      isTestAccount: Boolean(temporaryInvite.isTestAccount),
    };
  }

  const formalAccount = config.formalAccounts?.[code];
  if (formalAccount) {
    return {
      accessCode: code,
      accountType: 'formal_account',
      accountId: formalAccount.accountId || formalAccount.customerId,
      customerId: formalAccount.customerId,
      customerName: formalAccount.customerName || '',
      plan: formalAccount.plan || 'standard',
      allowedSubmissionTypes: formalAccount.allowedReports || ['weekly'],
      isTestAccount: Boolean(formalAccount.isTestAccount),
    };
  }

  throw new Error('访问码无效，请确认后重新输入。');
}

export function getChecklistForSession(session) {
  return Object.fromEntries(
    session.allowedSubmissionTypes.map((type) => [type, hydrateChecklist(getChecklist(type))]),
  );
}

export function validateSubmissionWindow(session, options) {
  const { submissionType, periodKey, existingSubmissions = [] } = options;
  if (!session.allowedSubmissionTypes.includes(submissionType)) {
    return { allowed: false, reason: '当前账号无权提交该类型数据。' };
  }

  if (session.isTestAccount) {
    return { allowed: true, reason: '' };
  }

  const sameCustomer = existingSubmissions.filter((item) => item.customerId === session.customerId);

  if (session.accountType === 'temporary_invite') {
    const hasSubmitted = sameCustomer.some(
      (item) => item.submissionType === 'first_diagnosis' && item.auditGrade !== 'C',
    );
    if (hasSubmitted) {
      return { allowed: false, reason: '临时邀请码只能提交一次首诊数据，不能重复生成首诊报告。' };
    }
  }

  if (session.accountType === 'formal_account' && submissionType === 'weekly') {
    const duplicate = sameCustomer.some(
      (item) => item.submissionType === 'weekly' && item.periodKey === periodKey && item.auditGrade !== 'C',
    );
    if (duplicate) {
      return { allowed: false, reason: '本周已提交过周报数据，不能重复提交。' };
    }
  }

  if (session.accountType === 'formal_account' && submissionType === 'monthly') {
    const duplicate = sameCustomer.some(
      (item) => item.submissionType === 'monthly' && item.periodKey === periodKey && item.auditGrade !== 'C',
    );
    if (duplicate) {
      return { allowed: false, reason: '本月已提交过月报数据，不能重复提交。' };
    }
  }

  return { allowed: true, reason: '' };
}
