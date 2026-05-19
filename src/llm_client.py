import json
import os
import socket
import time
import urllib.error
import urllib.request


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if raw == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def generate_with_doubao(system_prompt: str, user_prompt: str) -> str:
    api_key = os.getenv("LLM_API_KEY", "").strip()
    api_base = os.getenv("LLM_API_BASE", "https://ark.cn-beijing.volces.com/api/v3").strip().rstrip("/")
    model = os.getenv("LLM_MODEL", "").strip()
    timeout_seconds = _env_int("LLM_TIMEOUT_SECONDS", 240)
    max_retries = _env_int("LLM_MAX_RETRIES", 2)
    max_tokens = _env_int("LLM_MAX_TOKENS", 2500)

    if not api_key:
        raise RuntimeError("缺少 LLM_API_KEY。请配置火山方舟 API Key。")
    if not model:
        raise RuntimeError("缺少 LLM_MODEL。请配置火山方舟推理接入点 ID，例如 ep-xxxx。")

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.3,
        "max_tokens": max_tokens,
    }

    request = urllib.request.Request(
        url=f"{api_base}/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    last_error: Exception | None = None
    for attempt in range(1, max_retries + 2):
        try:
            with urllib.request.urlopen(request, timeout=timeout_seconds) as response:
                result = json.loads(response.read().decode("utf-8"))
                break
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"豆包/火山方舟调用失败：{exc.code} {detail}") from exc
        except (TimeoutError, socket.timeout, urllib.error.URLError) as exc:
            last_error = exc
            if attempt > max_retries:
                raise RuntimeError(
                    f"豆包/火山方舟调用超时或网络失败，已尝试 {attempt} 次。"
                    f"可在 GitHub Secrets 中设置 LLM_TIMEOUT_SECONDS=300 后重试。原始错误：{exc}"
                ) from exc
            time.sleep(3 * attempt)
    else:
        raise RuntimeError(f"豆包/火山方舟调用失败：{last_error}")

    choices = result.get("choices", [])
    if not choices:
        raise RuntimeError(f"豆包/火山方舟返回为空：{json.dumps(result, ensure_ascii=False)[:1000]}")

    return choices[0]["message"]["content"].strip()


def generate_dry_run_report(user_prompt: str) -> str:
    return """# XX宠物用品店｜2026年第20周经营首诊报告

访客到订单的转化关系为什么仍需拆解？

> 一句话判断：本周在上新和满减背景下，访客规模已经具备观察价值，但订单承接还需要进一步拆开看。现在不急着加预算或大改页面，先确认两件事：投产比口径是否一致，新增访客是不是目标人群。

## 01｜老板先看这3个信号

- 信号1：本周在上新和满减背景下，曝光和访客规模已经具备观察价值。说明这类活动具备拉流量的复盘价值，后续是否复用，还要看转化承接和投放成本。
- 信号2：从单周数据看，访客到成交之间仍有拆解空间。当前不直接判断“低于预期”，先看流量质量、商品页承接和活动机制分别贡献了什么。
- 信号3：投放ROI不能直接下判断。若统计口径不统一，容易误判：该加预算的不敢加，该止损的没停。

## 02｜当前最大经营矛盾

新增访客具备分析价值，但商品页、新品卖点、价格机制和成交结构还需要进一步拆开看。换句话说，店铺现在不是先解决“怎么再多来点人”，而是先确认“来的人是不是目标人群，以及目标人群为什么还没有更多下单”。

确定事实是本周在活动背景下观察到访客规模具备分析价值，成交承接仍需要进一步拆解。初步观察是新增访客里可能存在低意向或价格敏感人群，且商品承接还没有充分说服下单。若不先验证，后续动作越大，可能只是把未经确认的流量继续放大。

## 03｜五维首诊

### 流量｜具备观察价值，但质量仍需验证

本周在上新和满减背景下，曝光和访客规模已具备初步分析价值。但在没有活动前后对比、历史均值和同层级类目均值前，不能直接说“活动证明有效”或“流量达标”。如果新增访客主要来自价格敏感人群或活动低意向人群，继续放大活动可能只会增加浏览，不一定增加成交。

### 转化｜当前最该先看的卡点

当前首要卡点是转化承接。下周不建议泛泛“优化详情页”，而是先看详情页首屏、加购收藏、新品评价、满减门槛和客服咨询阻力到底卡在哪里。

### 成交｜增长来源还没有拆清

现在还不能判断GMV主要由新品、老品、满减活动还是高客单商品贡献。新品既可能带来流量，也可能拉低整体转化，需要单独拆开看。

### 投放｜先统一口径，再判断效率

ROI口径不统一时，直接判断投放效率容易误判。这里应先确认平台归因口径、广告直接成交、间接成交、毛利率和渠道拆分，再判断哪些计划需要继续观察、哪些计划具备小范围调整条件；在口径未核清前，不给固定比例砍预算或放量建议。

### 售后/复购｜本次样本暂未显示明显售后风险

从单周首诊看，退款率暂未暴露明显售后风险。但在没有行业均值、店铺历史均值、退款原因和连续多周数据前，不直接判断“稳定”“无异常”“行业合理”或“复购健康”；后续还需要看老客成交占比、复购率和二次购买周期。

## 04｜下周不做大改，只先验证3件事

| 动作 | 怎么做 | 做完怎么决策 |
|---|---|---|
| 核实ROI口径 | 确认ROI按广告引导成交、全店成交还是平台归因口径统计。 | 口径清楚后，再判断是否需要继续观察、拆分渠道，或具备小范围调整条件。 |
| 拆新品/老品转化 | 单独看新品访客、加购、下单、支付和详情页跳失。 | 若新品点击有量但支付承接较弱，先验证卖点、评价和首屏是否影响决策；若新品表现明显弱于店铺同类老品，新品先别盲目放量。 |
| 回访加购未下单用户 | 抽样10个加购未付款用户，记录未成交原因。 | 若价格敏感反馈集中，先形成满减门槛调整方案；若信任不足，先补充评价和买家秀素材方案；若卖点不清，先制作首屏表达优化方案，具备条件时再小范围验证。 |

## 05｜为什么建议连续看4周

单周数据只能看到异常，连续4周才能确认规律。4周追踪的价值不是每周多一份报告，而是每周用同一套口径验证：问题是否持续、动作是否有效、下周是否要调整方向。

- 第1周：统一数据口径，确认真实卡点。
- 第2周：验证新品和老品转化差异。
- 第3周：根据加购未下单原因调整商品页和活动机制。
- 第4周：复盘GMV、转化率、ROI是否与前3周动作存在可验证关联。

## 06｜下一步建议

这周不建议马上大改页面、继续加预算或加大满减。更稳的方式，是先用4周把核心问题跑清楚：如果确认问题在转化承接，就先形成商品页、评价、卖点和活动机制的优化方案，并在小范围验证后再决定是否替换；如果问题在流量人群，就先拆分投放和活动入口表现，再判断是否调整；如果问题在商品结构，就重新拆新品、老品和高客单商品的成交贡献。这样做的价值不是多拿几份报告，而是避免店铺在错误方向上继续投入。

## 07｜生成与数据边界

本报告由AI经营诊断流程生成初稿，并经经营逻辑校验后输出。本报告属于单周首诊判断，不替代完整月度复盘或平台后台深度审计，不承诺一定提升GMV。未接入活动前后对比、历史均值、行业均值、平台同层级数据、毛利率或投放归因明细前，报告不直接输出“证明有效、达标、行业合理、稳定、无异常、明显偏低、加预算、砍预算”等强判断；未说明来源的固定阈值仅能作为内部观察线，不代表行业标准。
"""
