const state = {
  accessCode: '',
  session: null,
  checklists: {},
  activeType: '',
  files: [],
};

const loginPanel = document.querySelector('#loginPanel');
const appPanel = document.querySelector('#appPanel');
const accessForm = document.querySelector('#accessForm');
const intakeForm = document.querySelector('#intakeForm');
const reportSwitch = document.querySelector('#reportSwitch');
const dynamicSections = document.querySelector('#dynamicSections');
const evidenceList = document.querySelector('#evidenceList');
const fileInput = document.querySelector('#files');
const fileList = document.querySelector('#fileList');
const resultPanel = document.querySelector('#resultPanel');
const submitButton = document.querySelector('#submitButton');

function showResult(kind, title, details = []) {
  resultPanel.className = `result ${kind}`;
  resultPanel.innerHTML = [
    `<strong>${title}</strong>`,
    ...details.map((item) => `<div>${item}</div>`),
  ].join('');
  resultPanel.classList.remove('hidden');
}

function hideResult() {
  resultPanel.classList.add('hidden');
  resultPanel.innerHTML = '';
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || '请求失败');
  }
  return data;
}

function setSession(data) {
  state.session = data.session;
  state.checklists = data.checklists;
  state.activeType = state.session.allowedSubmissionTypes[0];

  document.querySelector('#customerName').textContent = state.session.customerName || state.session.customerId;
  document.querySelector('#accountMeta').textContent =
    state.session.accountType === 'temporary_invite'
      ? `临时邀请码｜${state.session.customerId}`
      : `正式账号｜${state.session.plan}｜${state.session.customerId}`;

  loginPanel.classList.add('hidden');
  appPanel.classList.remove('hidden');
  renderReportSwitch();
  renderChecklist();
}

function renderReportSwitch() {
  reportSwitch.innerHTML = '';
  for (const type of state.session.allowedSubmissionTypes) {
    const checklist = state.checklists[type];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `switch-button ${type === state.activeType ? 'active' : ''}`;
    button.textContent = checklist.title;
    button.addEventListener('click', () => {
      state.activeType = type;
      renderReportSwitch();
      renderChecklist();
    });
    reportSwitch.appendChild(button);
  }
}

function inputForField(field) {
  const value = field.defaultValue ?? '';
  if (field.type === 'textarea') {
    return `<textarea id="${field.key}" name="${field.key}" ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}">${value}</textarea>`;
  }
  if (field.type === 'select') {
    return `<select id="${field.key}" name="${field.key}" ${field.required ? 'required' : ''}>
      <option value="">请选择</option>
      ${(field.options || []).map((option) => `<option value="${option}">${option}</option>`).join('')}
    </select>`;
  }
  if (field.type === 'checkbox') {
    return `<div class="checkbox-field">
      <input id="${field.key}" name="${field.key}" type="checkbox">
      <label for="${field.key}">${field.label}</label>
    </div>`;
  }
  return `<input id="${field.key}" name="${field.key}" type="${field.type || 'text'}" value="${value}" ${field.required ? 'required' : ''} placeholder="${field.placeholder || ''}">`;
}

function renderChecklist() {
  hideResult();
  const checklist = state.checklists[state.activeType];
  document.querySelector('#formEyebrow').textContent =
    state.session.accountType === 'temporary_invite' ? '一次性首诊入口' : '正式客户数据入口';
  document.querySelector('#formTitle').textContent = checklist.title;
  document.querySelector('#formSubtitle').textContent = checklist.subtitle;
  submitButton.textContent = checklist.submitLabel;

  evidenceList.innerHTML = checklist.evidence.map((item) => `<li>${item}</li>`).join('');
  dynamicSections.innerHTML = checklist.sections.map((section) => {
    const fields = section.fields.map((field) => {
      if (field.internal) return '';
      const isFull = field.type === 'textarea' || field.type === 'checkbox';
      return `<div class="field ${isFull ? 'full' : ''}">
        ${field.type === 'checkbox' ? inputForField(field) : `<label for="${field.key}">${field.label}${field.required ? ' *' : ''}</label>${inputForField(field)}`}
      </div>`;
    }).join('');

    return `<section class="form-section">
      <div class="section-title">
        <h3>${section.title}</h3>
      </div>
      <div class="field-grid">${fields}</div>
    </section>`;
  }).join('');
}

function collectFormData() {
  const formData = {};
  const elements = intakeForm.querySelectorAll('input[name], select[name], textarea[name]');
  for (const element of elements) {
    if (element.type === 'file') continue;
    if (element.type === 'checkbox') {
      formData[element.name] = element.checked;
    } else {
      formData[element.name] = element.value;
    }
  }
  formData.customer_id = state.session.customerId;
  if (!formData.customer_name && state.session.customerName) {
    formData.customer_name = state.session.customerName;
  }
  return formData;
}

function kindFromFile(file) {
  const name = file.name.toLowerCase();
  if (/\.(png|jpg|jpeg|webp)$/.test(name)) return 'screenshot';
  if (/\.(csv|xls|xlsx)$/.test(name)) return 'spreadsheet';
  return 'other';
}

function fileToPayload(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve({
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        kind: kindFromFile(file),
        contentBase64: result.includes(',') ? result.split(',')[1] : result,
      });
    };
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function renderFiles() {
  if (!state.files.length) {
    fileList.innerHTML = '<div class="file-item">尚未选择文件。</div>';
    return;
  }
  fileList.innerHTML = state.files.map((file) => (
    `<div class="file-item">${file.name}｜${kindFromFile(file)}｜${Math.ceil(file.size / 1024)} KB</div>`
  )).join('');
}

accessForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideResult();
  const accessCode = new FormData(accessForm).get('accessCode');
  try {
    const data = await postJson('/api/access', { accessCode });
    state.accessCode = accessCode;
    setSession(data);
  } catch (error) {
    showResult('error', '无法进入', [error.message]);
  }
});

fileInput.addEventListener('change', () => {
  state.files = Array.from(fileInput.files || []);
  renderFiles();
});

document.querySelector('#logoutButton').addEventListener('click', () => {
  state.accessCode = '';
  state.session = null;
  state.checklists = {};
  state.activeType = '';
  state.files = [];
  accessForm.reset();
  intakeForm.reset();
  renderFiles();
  appPanel.classList.add('hidden');
  loginPanel.classList.remove('hidden');
});

intakeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideResult();
  submitButton.disabled = true;
  submitButton.textContent = '提交中...';

  try {
    const files = await Promise.all(state.files.map(fileToPayload));
    const payload = {
      accessCode: state.accessCode,
      submissionType: state.activeType,
      formData: collectFormData(),
      files,
    };
    const result = await postJson('/api/intake', payload);
    const audit = result.audit;
    if (result.status === 'needs_supplement') {
      showResult('warn', `审核等级 ${audit.grade}：需要补充后再生成`, [
        ...audit.blockingIssues,
        ...audit.missingEvidence,
      ]);
    } else {
      showResult(audit.grade === 'A' ? 'ok' : 'warn', `审核等级 ${audit.grade}：已接收`, [
        result.notionPage?.url ? `Notion 记录：${result.notionPage.url}` : '',
        result.workflow?.triggered ? '已自动触发 GitHub Actions。' : result.workflow?.reason || '',
        ...audit.warnings,
      ].filter(Boolean));
    }
  } catch (error) {
    showResult('error', '提交失败', [error.message]);
  } finally {
    const checklist = state.checklists[state.activeType];
    submitButton.disabled = false;
    submitButton.textContent = checklist.submitLabel;
  }
});

renderFiles();
