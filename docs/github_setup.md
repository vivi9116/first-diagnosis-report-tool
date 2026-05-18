# GitHub Actions 设置说明

## 1. 仓库建议

建议使用 Private 仓库，因为里面包含业务 Prompt、字段设计和报告模板。

## 2. 添加 Secrets

路径：

```text
Settings → Secrets and variables → Actions → New repository secret
```

添加：

```text
LLM_API_KEY
LLM_API_BASE
LLM_MODEL
NOTION_TOKEN
NOTION_DATABASE_ID
```

豆包/火山方舟默认：

```text
LLM_API_BASE=https://ark.cn-beijing.volces.com/api/v3
LLM_MODEL=ep-xxxxxxxxxxxxxxxx
```

## 3. 手动运行

进入：

```text
Actions → Generate First Diagnosis Report → Run workflow
```

第一次先跑演示模式：

```text
source=csv
customer_id=C001
dry_run=true
```

确认演示报告可生成后，再改为：

```text
source=csv
customer_id=C001
dry_run=false
```

豆包真实调用成功后，再接 Notion：

```text
source=notion
customer_id=客户编号
dry_run=false
```

## 4. 下载报告

运行完成后，在 workflow run 页面底部下载 Artifact：

```text
first-diagnosis-report-客户编号
```

下载后人工质检，再交付客户。
