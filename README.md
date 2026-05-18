# AI电商首诊报告自动化工具

这是一个面向《AI电商经营自动化托管服务》的内部生产工具，用于从 Notion 数据库或 CSV 读取客户首诊数据，调用豆包/火山方舟生成首诊报告草稿，并输出 Markdown + Word 文档，供人工质检后交付客户。

## 当前版本

V0.1：GitHub Actions 手动运行版。

```text
Notion/CSV 客户数据
→ 数据校验
→ 豆包/火山方舟生成首诊报告
→ 输出 Markdown + Word
→ GitHub Artifact 下载
→ 人工质检
→ Word/飞书文档交付客户
```

## 不做什么

- 不把报告自动发给客户。
- 不保存客户平台账号密码。
- 不暴露 Prompt、规则、字段映射给客户。
- 不承诺一定提升 GMV。

## GitHub Secrets

在 GitHub 仓库中打开：

```text
Settings → Secrets and variables → Actions → New repository secret
```

添加：

```text
LLM_API_KEY      火山方舟 API Key
LLM_API_BASE     https://ark.cn-beijing.volces.com/api/v3
LLM_MODEL        火山方舟推理接入点 ID，例如 ep-xxxxxxxx
NOTION_TOKEN     Notion Internal Integration Secret
NOTION_DATABASE_ID Notion 数据库 ID
```

如果只用 CSV 测试，可以先不填 Notion 相关 Secrets。

## Notion 数据库字段

建议字段名保持以下中文名称：

| 字段名 | 类型 |
|---|---|
| 客户编号 | Title 或 Text |
| 客户名称 | Text |
| 平台 | Select |
| 类目 | Select |
| 主营产品 | Text |
| 经营阶段 | Select |
| 数据周期 | Text |
| 曝光量 | Number |
| 访客数 | Number |
| 订单数 | Number |
| 支付金额 | Number |
| 客单价 | Number |
| 转化率 | Number |
| 投放消耗 | Number |
| 投产比 | Number |
| 退款率 | Number |
| 本周活动/上新 | Text |
| 客户自述问题 | Text |
| 报告状态 | Select |
| 报告链接 | URL |
| 备注 | Text |

`报告状态` 第一版读取：

```text
待生成
```

生成报告后，不会自动改 Notion 状态。人工质检后再手动改为：

```text
已生成待质检
已交付
需补数据
```

## 本地运行

```bash
python src/main.py --source csv --customer-id C001
```

使用豆包真实生成：

```bash
set LLM_API_KEY=你的火山方舟APIKey
set LLM_API_BASE=https://ark.cn-beijing.volces.com/api/v3
set LLM_MODEL=ep-xxxxxxxx
python src/main.py --source csv --customer-id C001
```

不调用大模型，只生成演示草稿：

```bash
python src/main.py --source csv --customer-id C001 --dry-run
```

## GitHub Actions 运行

进入仓库：

```text
Actions → Generate First Diagnosis Report → Run workflow
```

输入：

```text
source = csv 或 notion
customer_id = C001
dry_run = false
```

运行完成后下载 Artifact：

```text
first-diagnosis-report-C001.zip
```

里面包含：

```text
C001_首诊报告.md
C001_首诊报告.docx
C001_数据校验结果.json
```

## 火山方舟配置

豆包/火山方舟对应关系：

```text
LLM_API_KEY  = 火山方舟 API Key
LLM_API_BASE = https://ark.cn-beijing.volces.com/api/v3
LLM_MODEL    = 推理接入点 ID，通常 ep- 开头
```

注意：`LLM_MODEL` 建议填火山方舟控制台中的推理接入点 ID，而不是模型展示名称。

## 人工质检清单

每份报告交付前检查：

- 客户名称、平台、周期是否正确。
- 数据是否缺失或错位。
- 结论是否过度。
- 行动建议是否具体可执行。
- 是否暴露内部规则、Prompt、工具链。
- 是否出现“保证提升 GMV”等承诺。
