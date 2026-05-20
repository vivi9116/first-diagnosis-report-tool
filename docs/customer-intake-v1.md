# 客户数据采集入口 V1 自动版

## 目标

客户不再把数据发给你后由你手动录入 Notion，而是进入一个网页入口：

```text
访问码登录
→ 根据账号类型显示提交清单
→ 客户填表并上传截图/Excel
→ 系统自动审核
→ 自动写入 Notion
→ 首诊通过时自动触发 GitHub Actions
```

## 两类访问方式

### 临时邀请码

用于首诊客户。

- 只显示「首诊数据提交清单」
- 原则上只能成功提交一次
- 审核通过后自动写入 Notion，并触发 `Generate First Diagnosis Report`
- 只生成一份首诊报告

### 正式账号

用于已付款购买产品的客户。

- 根据账号配置显示「周报数据提交清单」「月报数据提交清单」
- 周报同一周期只允许成功提交一次
- 月报同一周期只允许成功提交一次
- V1 会保存和审核数据；周报/月报生成器接入后再自动触发对应报告

## 页面清单规则

登录成功后，前端会调用 `/api/access`，后端返回当前账号可提交的清单。

临时邀请码：

```text
首诊数据提交清单
```

正式账号：

```text
周报数据提交清单
月报数据提交清单
```

清单字段统一维护在：

```text
api/lib/checklists.js
```

## 数据审核规则

审核逻辑在：

```text
api/lib/audit.js
```

当前 V1 检查：

- 必填字段是否缺失
- 是否上传截图或 Excel/CSV 作为核对凭证
- `支付金额 ≈ 订单数 × 客单价`
- `订单数 ≈ 访客数 × 转化率`
- `ROI ≈ 支付金额 ÷ 投放消耗`

审核等级：

```text
A：可生成正式报告
B：可生成谨慎版报告，但需要在报告中标注口径风险
C：不触发报告，返回补充清单
```

## 文件存储

客户上传的截图/Excel 会保存到 GitHub 私有仓库：

```text
customer_uploads/{客户编号}/{提交类型}/{周期}/{提交时间}/
```

每次提交都会生成：

```text
manifest.json
截图文件
Excel/CSV 文件
```

后续客户量增加后，建议把文件存储迁移到腾讯云 COS / 阿里云 OSS。

## Notion 写入

系统会自动创建 Notion 数据库记录。

为了不强依赖新增 Notion 字段，V1 把入口元数据写入「备注」字段：

```text
INTAKE_META:{...}
```

首诊数据审核通过后，会把「报告状态」设为：

```text
待生成
```

GitHub Actions 读取 Notion 时，会按客户编号和「待生成」状态生成首诊报告。

## 环境变量

Vercel 或本地服务需要配置：

```text
NOTION_TOKEN
NOTION_DATABASE_ID
GITHUB_TOKEN
GITHUB_REPO=vivi9116/first-diagnosis-report-tool
GITHUB_WORKFLOW_ID=generate-report.yml
GITHUB_REF=main
AUTO_TRIGGER_GITHUB=true
INTAKE_ACCESS_CONFIG={...}
```

`GITHUB_TOKEN` 需要具备：

```text
repo contents write
actions workflow dispatch
```

## 访问码配置示例

```json
{
  "temporaryInvites": {
    "FIRST-C003-ABCD": {
      "customerId": "C003",
      "customerName": "XX家居店",
      "reportType": "first_diagnosis"
    }
  },
  "formalAccounts": {
    "VIP-C1001": {
      "accountId": "A1001",
      "customerId": "C1001",
      "customerName": "YY宠物用品店",
      "plan": "standard",
      "allowedReports": ["weekly", "monthly"]
    }
  }
}
```

## 部署建议

推荐部署到 Vercel。

原因：

- 前端静态页面和 `/api/*` 后端接口能放在同一个仓库
- 密钥放在 Vercel 环境变量，不暴露给客户浏览器
- 不需要你长期运行本地电脑

GitHub Pages 不适合这个入口，因为它没有安全后端，不能保存 `NOTION_TOKEN` 和 `GITHUB_TOKEN`。

## V1 边界

- V1 已经可以实现「客户提交 → 自动写 Notion → 首诊触发 GitHub」。
- 周报/月报目前先完成入口、审核和入库；对应生成器需要后续单独接入。
- OCR 自动识别截图暂不做主流程，截图先作为审核凭证。
