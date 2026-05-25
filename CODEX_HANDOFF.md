# Codex Handoff

更新时间：2026-05-25  
工作区：`C:\Users\Dylan\Documents\Codex\2026-05-21\github-first-diagnosis-report-tool-n8qnlmili`

## 1. 项目目标

这个项目是一个部署在 Vercel 上的电商经营数据采集入口，用于让客户提交经营数据并进入后续报告生成流程。

当前产品目标：

- 临时邀请码客户：用于首诊客户，进入后先选择提交方式，支持“填表 + 后台截图”或“Excel/CSV + 后台截图”，原则上只提交一次首诊数据。
- 正式账号客户：用于已付款/托管客户，直接进入“Excel/CSV + 后台截图”提交流程，只展示周报/月报，不展示首诊内容。
- 系统后台：接收客户提交的数据和文件，做基础完整性审核，写入 Notion 数据库，保存上传材料，并在符合条件时触发 GitHub Actions 生成报告。
- 客户界面：尽量避免暴露 Notion、GitHub Actions、审核内部逻辑等后台实现细节，只告诉客户需要补充什么材料。

生产地址：

- `https://first-diagnosis-report-tool.vercel.app/`

相关远端：

- GitHub 仓库：`vivi9116/first-diagnosis-report-tool`
- Vercel 项目：`first-diagnosis-report-tool`
- Vercel projectId：`prj_UtxUCRazXIAJoVtNzg9lSEfjPd9F`
- Vercel teamId：`team_lY0Scif4stmap0TKLyVdgvhz`

不要在代码、文档或聊天中写入真实 API Key、Token、密码、RT、AT。

## 2. 当前项目结构

当前本地工作区能看到的文件：

```text
.
├── api
│   ├── intake.js
│   └── lib
│       ├── access.js
│       ├── audit.js
│       └── checklists.js
├── package.json
├── tests_js
│   └── intake.test.mjs
└── web
    ├── app.js
    ├── index.html
    └── styles.css
```

注意：当前本地工作区仍不是完整克隆，`rg --files` 只能看到上述文件。已通过 GitHub connector 核对远端 `main` 文件树，远端包含 `api/lib/http.js`、`api/lib/github.js`、`api/lib/notion.js`。后续如果需要完整本地联调，建议从 GitHub 拉取完整仓库或补齐本地文件。

## 3. 已经完成的功能

### 访问码与账号分流

- 支持临时邀请码和正式账号两种访问方式。
- `api/lib/access.js` 中有默认演示码：
  - `DEMO-FIRST`
  - `DEMO-VIP`
- 支持通过环境变量追加/覆盖访问配置：
  - `INTAKE_ACCESS_CONFIG`
  - `INTAKE_TEST_ACCESS_CONFIG`
- 临时邀请码只开放 `first_diagnosis`。
- 正式账号即使配置里误写了 `first_diagnosis`，前端也只展示 `weekly`、`monthly`。

### 测试账号

Vercel 环境里配置过测试访问码，方便研发和调整：

- 临时邀请码：`TEST-FIRST-OPEN`
- 正式测试账号：`TEST-VIP-OPEN`

这些是测试访问码，不是真实 API 密钥。不要把真实客户码、真实 Token 写进文档。

### 临时邀请码流程

- 登录后先进入“本次经营数据怎么提交？”页面。
- 第二层选择提交方式，文案已加“只需二选一”。
- 选项一：`一，填表`
- 选项二：`二，Excel/CSV`
- 临时邀请码页面已隐藏“退出”按钮。
- 第三层填报页面有“返回上一页”按钮。
- 客户可见表单里已删除“数据可用性”区域，该判断只保留给系统后台/报告生成逻辑使用。

### 正式账号流程

- 正式账号登录后不再进入二选一页面，直接进入 `Excel/CSV 文件 + 后台截图`。
- 正式账号只展示：
  - `周报数据提交清单`
  - `月报数据提交清单`
- 正式账号不展示首诊相关内容。
- 正式账号不显示“返回上一页”，保留“退出”。

### 表单与上传体验

- Excel/CSV 流程已经区分主次：
  - `主要文件：Excel/CSV`
  - `核对材料：后台截图`
- 上传说明已精简，避免“上传后台导出数据”和“Excel/CSV + 截图上传”重复表达。
- “提交前确认”区域已改为客户友好文案，不再暴露“审核通过后进入报告生成流程”等后台逻辑。
- 最新客户提示文案：
  - `数据资料务必真实准确；如存在不一致、错漏的数据，提交后系统会提示需要重新补充的材料。`
- 客户提交成功后的结果文案已隐藏后台实现细节，不再显示 Notion URL、GitHub Actions 或提交记录链接，改为：
  - `资料已接收。系统会继续处理，如需补充材料会在页面提示。`

### 最近一次客户反馈后的改动

已完成、补推到 GitHub，并由 Vercel 自动部署：

- 表单模式下，上传区域标题由 `填表截图上传` 改为 `后台数据截图上传`。
- 表单模式上传区灰字改为：
  - `请先填写上方经营数据，并上传后台数据对应的截图。截图用于验证和核对填表数据，是必选项。`
- `转化率 (%)`、`投产比 / ROI`、`退款率 (%)` 支持两位小数：
  - `step: '0.01'`
  - 字段旁提示：`可保留两位小数`
- 解决浏览器原生 number 输入 `3.41` 时提示“请输入有效值。两个最接近的有效值分别为3和4”的问题。
- 填表模式每个表单区域标题右侧加了 `*为必填项`。
- 成功提交后的客户提示已改为客户友好表达，不再暴露 `notionPage`、`GitHub Actions`、`提交记录` 等后台细节。

### 本轮远端同步与部署确认

- 已核对 GitHub 远端 `main` 文件树，确认远端包含本地缺失的 `api/lib/http.js`、`api/lib/github.js`、`api/lib/notion.js`。
- 已补推 `tests_js/intake.test.mjs` 最新断言，覆盖：
  - `form mode explains required fields and backend screenshot upload clearly`
  - `rate fields allow two decimal places and show decimal hints`
  - 客户成功提交结果不暴露 `notionPage`、`GitHub Actions`、`提交记录`
- 已推送 `web/app.js` 成功态文案修正：
  - 提交 `7be91cca5f2c52ab50757282b91782f095c8689d`：`Hide internal submission result details`
- 已推送测试断言：
  - 提交 `cd8a5eb93bc06687ff6d45461bc8c259a1d9a2ae`：`Cover customer-facing intake copy`
- 已确认 Vercel 最新生产部署 `READY`，对应提交 `cd8a5eb93bc06687ff6d45461bc8c259a1d9a2ae`。

### 审核与提交逻辑

- `api/lib/audit.js` 做基础审核：
  - 缺核心数据或缺截图/文件时降级或阻断。
  - spreadsheet 模式要求截图 + Excel/CSV。
  - form 模式要求核心表单字段 + 后台截图。
- `api/lib/access.js` 做提交窗口限制：
  - 临时邀请码非测试账号只允许一次有效首诊提交。
  - 正式账号周报/月报按周期限制重复提交。
  - 测试账号绕过重复提交限制。
- `api/intake.js` 会把 `submissionMode` 传入审核逻辑。

## 4. 修改过的重要文件

### `api/lib/access.js`

关键变更：

- 增加正式账号报告类型白名单：
  - 只允许 `weekly`、`monthly` 面向正式客户展示。
- 增加 `INTAKE_TEST_ACCESS_CONFIG` 读取和合并。
- 测试账号支持绕过重复提交限制。

### `api/lib/checklists.js`

关键变更：

- 删除客户表单中的“数据可用性”区域。
- `conversion_rate`、`roi`、`refund_rate` 增加：
  - `step: '0.01'`
  - `hint: '可保留两位小数'`
- 保留字段定义给后台/报告判断使用，但客户表单不再展示数据可用性板块。

### `web/index.html`

关键变更：

- 增加提交方式选择页。
- “只需二选一”文案已加入。
- “提交前确认”改为客户友好的真实性提示。
- 不再出现 Notion 等后台系统名。

### `web/app.js`

关键变更：

- 临时邀请码：显示提交方式选择页，隐藏退出按钮。
- 正式账号：跳过提交方式选择，直接进入 spreadsheet 流程。
- 正式账号过滤首诊内容。
- Excel/CSV 流程左侧清单和中间上传说明改为“主要文件/核对材料”。
- 填表模式上传标题改为 `后台数据截图上传`。
- 字段渲染支持 `field.step` 和 `field.hint`。
- 填表区域标题显示 `*为必填项`。
- 成功提交后的结果文案改为客户侧表达，不再显示 Notion URL、GitHub Actions 或提交记录链接。

### `web/styles.css`

关键变更：

- 给 Excel/CSV 上传步骤里的主要文件增加视觉强调：
  - `.upload-steps .primary-upload-step`

### `tests_js/intake.test.mjs`

关键变更：

- 覆盖访问分流、正式账号隐藏首诊、临时邀请码保留二选一。
- 覆盖客户文案不暴露 Notion。
- 覆盖 `submissionMode` 传给 API。
- 覆盖 spreadsheet 模式截图 + Excel/CSV 规则。
- 覆盖测试账号绕过重复提交。
- 最新已推送测试还覆盖：
  - `后台数据截图上传`
  - `*为必填项`
  - 三个小数字段 `step: '0.01'`
  - “提交前确认”不暴露审核逻辑
  - 成功提交结果不暴露 `notionPage`、`GitHub Actions`、`提交记录`

最新测试断言已推送到 GitHub `main`，对应提交 `cd8a5eb93bc06687ff6d45461bc8c259a1d9a2ae`。

## 5. 当前还没解决的问题

1. 当前本地工作区可能不是完整仓库  
   `api/intake.js` 引用了 `api/lib/http.js`、`api/lib/github.js`、`api/lib/notion.js`，但这些文件不在当前本地文件列表中。新会话应从 GitHub 拉取完整仓库或用 GitHub connector 检查文件树。
   
   当前已确认：远端 GitHub `main` 包含这些文件，本地目录仍只是残缺工作区。

2. 线上完整提交链路还需要端到端验证  
   需要验证：
   - 填表模式输入 `3.41` 能通过浏览器校验。
   - 上传测试截图后提交。
   - Notion 写入成功。
   - 文件保存成功。
   - 首诊满足条件时触发 GitHub Actions。
   - 错漏数据时客户看到补充提示。

## 6. 最近遇到的报错和解决过程

### GitHub fine-grained token 查看问题

用户在 GitHub fine-grained personal access token 页面生成 token 后跳回 token 列表，看不到 token 明文。结论：

- GitHub token 只在刚生成时显示一次。
- 如果已经离开生成页，无法再次查看明文。
- 需要 `Regenerate token` 或新建 token。
- 不能把 token 发到聊天里，只能填进 Vercel Environment Variables。

### Vercel 环境变量变更后需要 Redeploy

在 Vercel 添加/修改环境变量后，页面提示需要重新部署。处理方式：

- 在 Vercel 项目 `Environment Variables` 页面添加变量。
- 点击右下角提示里的 `Redeploy`。
- 或进入 `Deployments` 选择最新生产部署重新部署。

### GitHub token 权限配置

用于 Vercel 调 GitHub Actions 和保存上传材料的 fine-grained token 需要覆盖目标仓库，并具备最低必要权限。文档中不要写真实 token。

建议环境变量名：

- `GITHUB_TOKEN`
- `GITHUB_REPO`
- `GITHUB_REF`
- `GITHUB_WORKFLOW_ID`

### Notion 集成配置

用户已说明 Notion 数据库已分享给对应 integration。Vercel 里需要：

- `NOTION_TOKEN`
- `NOTION_DATABASE_ID`

不要在文档或聊天中记录真实 token。

### 本地 `node --test` 权限问题

曾遇到 Windows 环境中 shell 执行 `node --test tests_js\intake.test.mjs` 报 `node.exe 拒绝访问`。当时解决方式：

- 使用 `node_repl` 的 `node:test` runner 执行测试。
- 最近一次本地测试结果：
  - `21/21` 通过
  - `fail 0`

### GitHub API rate limit

曾用 PowerShell 调 GitHub unauthenticated API 获取文件树，遇到：

```text
API rate limit exceeded
```

解决方向：

- 优先用 GitHub connector 的 `_fetch_file`、`_update_file` 等工具。
- 或用已配置认证的 GitHub CLI/connector。

### Codex 工具用量限制

上一轮曾在推送 `tests_js/intake.test.mjs` 和查询 Vercel 部署时遇到工具用量限制，工具返回：

```text
You've hit your usage limit.
```

当前状态：

- 业务代码已经推送到 GitHub。
- `tests_js/intake.test.mjs` 已补推到 GitHub `main`。
- Vercel 最新生产部署已确认 `READY`。
- 最新生产部署对应提交 `cd8a5eb93bc06687ff6d45461bc8c259a1d9a2ae`。

## 7. 项目启动命令

当前 `package.json` 只有测试命令：

```bash
npm run test:js
```

等价于：

```bash
node --test tests_js/*.test.mjs
```

注意：

- 项目要求 Node `>=20`。
- 当前本地没有看到 `dev` 或 `start` 脚本。
- 前端是静态页面，理论上可通过任意静态文件服务器服务 `web/`。
- API 是 Vercel Serverless Function 风格，完整本地联调通常需要 Vercel CLI 或补齐缺失的 API lib 文件后再跑。

如果使用 Vercel CLI，可尝试：

```bash
vercel dev
```

但当前本地没有确认是否已安装 Vercel CLI，也没有确认 `.vercel/project.json` 是否存在。

## 8. 环境变量要求

不要写真实值。以下只写变量名和示例结构。

### 访问码配置

`INTAKE_ACCESS_CONFIG`

示例结构：

```json
{
  "temporaryInvites": {
    "EXAMPLE-FIRST-CODE": {
      "customerId": "C-EXAMPLE",
      "customerName": "示例首诊客户",
      "reportType": "first_diagnosis"
    }
  },
  "formalAccounts": {
    "EXAMPLE-VIP-CODE": {
      "accountId": "A-EXAMPLE",
      "customerId": "VIP-EXAMPLE",
      "customerName": "示例正式客户",
      "plan": "standard",
      "allowedReports": ["weekly", "monthly"]
    }
  }
}
```

`INTAKE_TEST_ACCESS_CONFIG`

示例结构：

```json
{
  "temporaryInvites": {
    "TEST-FIRST-OPEN": {
      "customerId": "TEST-FIRST",
      "customerName": "研发测试临时邀请码",
      "reportType": "first_diagnosis",
      "isTestAccount": true
    }
  },
  "formalAccounts": {
    "TEST-VIP-OPEN": {
      "accountId": "A-TEST-VIP",
      "customerId": "TEST-VIP",
      "customerName": "研发测试正式账号",
      "plan": "dev_open",
      "allowedReports": ["first_diagnosis", "weekly", "monthly"],
      "isTestAccount": true
    }
  }
}
```

注意：正式账号代码会自动过滤 `first_diagnosis`，即使测试配置中包含它，客户侧也只展示周报/月报。

### Notion

需要在 Vercel Environment Variables 中配置：

```text
NOTION_TOKEN=<不要写真实值>
NOTION_DATABASE_ID=<不要写真实值>
```

前提：

- Notion database 必须分享给对应 Notion integration。
- Integration token 不要写入仓库、文档或聊天。

### GitHub

用于触发 GitHub Actions 和保存上传材料：

```text
GITHUB_TOKEN=<不要写真实值>
GITHUB_REPO=vivi9116/first-diagnosis-report-tool
GITHUB_REF=main
GITHUB_WORKFLOW_ID=<workflow 文件名或 id，不写真实敏感值>
```

GitHub token 要用 fine-grained PAT，范围尽量限制到目标仓库，并只给必要权限。不要把 token 明文写进任何文件。

### Intake/上传相关配置

当前对话里出现过这些环境变量名：

```text
INTAKE_ACCESS_CONFIG=<JSON，不写真实客户码>
INTAKE_TEST_ACCESS_CONFIG=<JSON，可放测试码>
AUTO_TRIGGER_GITHUB=<true/false 或项目现有约定>
```

如远端代码里还有其他变量，应以 `api/lib/github.js`、`api/lib/notion.js`、Vercel 项目环境变量为准。

## 9. 下一步应该继续做什么

建议新 Codex 会话按下面顺序接手：

1. 如需本地联调，先拉取完整 GitHub 仓库  
   当前本地工作区缺少部分远端文件；已确认 GitHub `main` 包含 `api/lib/http.js`、`api/lib/github.js`、`api/lib/notion.js`。

2. 线上浏览器验证临时邀请码  
   用 `TEST-FIRST-OPEN`：
   - 登录。
   - 选择 `一，填表`。
   - 确认上传区域标题是 `后台数据截图上传`。
   - 确认区域标题旁有 `*为必填项`。
   - 在 `转化率 (%)` 输入 `3.41`。
   - 在 `ROI` 输入 `7.52`。
   - 在 `退款率 (%)` 输入 `2.8` 或 `2.80`。
   - 确认浏览器不再提示“有效值分别为3和4”。

3. 线上浏览器验证正式账号  
   用 `TEST-VIP-OPEN`：
   - 登录后应直接进入 Excel/CSV + 截图流程。
   - 不应显示首诊清单。
   - 只显示周报/月报。
   - 不显示返回上一页。

4. 做一次完整端到端提交测试  
   用测试数据和测试截图验证：
   - API 返回成功。
   - Notion 页面创建成功。
   - 上传文件索引保存成功。
   - 首诊合格时 GitHub Actions 被触发。
   - 缺截图/缺 Excel 时提示补充材料。

## 10. 可用测试数据

临时邀请码测试：

```text
访问码：TEST-FIRST-OPEN
提交方式：一，填表
```

表单数据：

```text
店铺/客户名称：星橙家居测试店
平台：淘宝
类目：家居百货
主营产品：桌面收纳盒、厨房置物架
经营阶段：成长店
数据周期：2026-05-11 至 2026-05-17

曝光量：186000
访客数：12480
订单数：426
支付金额：51120
客单价：120
转化率 (%)：3.41
投放消耗：6800
投产比 / ROI：7.52
退款率 (%)：2.8

本周活动/上新：本周上新 3 个桌面收纳 SKU，参加平台满减活动，主推厨房置物架套装。
当前最想解决的问题：访客增长明显，但商品详情页转化不稳定；投放带来的成交集中在低客单产品，高客单套装转化偏弱。
历史数据周数：4
数据来源说明：数据来自商家后台经营总览、流量分析、商品分析、投放后台和售后退款页面截图。
```

上传文件：

```text
经营总览测试截图.png
```

正式账号测试：

```text
访问码：TEST-VIP-OPEN
预期：直接进入 Excel/CSV 文件 + 后台截图；只显示周报/月报。
```
