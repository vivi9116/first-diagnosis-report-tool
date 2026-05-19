# Notion 数据库搭建说明

## 1. 创建数据库

在 Notion 新建一个数据库，名称建议：

```text
AI电商首诊客户数据
```

## 2. 创建字段

| 字段名 | 类型 |
|---|---|
| 客户编号 | Title |
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
| 历史数据周数 | Number |
| 是否有平台同层级数据 | Checkbox 或 Select |
| 是否有行业/同层级数据 | Checkbox 或 Select |
| 是否有毛利率 | Checkbox 或 Select |
| 是否有投放归因 | Checkbox 或 Select |
| 是否有商品成本 | Checkbox 或 Select |
| 是否有库存数据 | Checkbox 或 Select |
| 数据来源说明 | Text |

数据可用性字段用于控制报告判断边界。起步阶段可以只填 `历史数据周数=1`，其他字段填“否”或不填；连续经营周报跑到第4周后，再把历史数据周数改为4；跑到第12周后，再允许趋势判断。

## 3. 报告状态选项

```text
待生成
已生成待质检
需补数据
已交付
已转付费
```

## 4. 创建 Notion Integration

进入 Notion 的 Integrations 页面，新建 Internal Integration，复制 Internal Integration Secret。

将它保存为 GitHub Secret：

```text
NOTION_TOKEN
```

## 5. 授权数据库

打开数据库页面：

```text
右上角 ... → Connections → 添加你的 Integration
```

不授权这一步，API 会读不到数据库。

## 6. 复制数据库 ID

复制数据库页面 URL，提取其中的长 ID，保存为 GitHub Secret：

```text
NOTION_DATABASE_ID
```
