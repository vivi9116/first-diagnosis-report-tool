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

流量上涨后，成交为什么没有同步放大？

> 一句话判断：本周流量已经被活动拉起来了，但新增访客还没有被商品页、新品卖点和活动机制有效转成订单。现在不急着加预算，先确认来的这些人到底是不是会买的人。

## 01｜老板先看这3个信号

- 信号1：流量入口已经被打开。本周曝光和访客被活动拉起，说明上新和满减确实带来了访问，不是完全没有流量。
- 信号2：成交承接没有同步跟上。转化率没有跟着访客增长同步改善，问题更可能出在流量质量、商品页承接或活动机制。
- 信号3：投放ROI不能直接下判断。若统计口径不统一，容易误判：该加预算的不敢加，该止损的没停。

## 02｜当前最大经营矛盾

新增访客来了，但商品页、新品卖点、价格机制和成交结构还没有形成闭环。换句话说，店铺现在不是先解决“怎么再多来点人”，而是先解决“来的人为什么没有更多下单”。

确定事实是流量被活动拉动，转化和成交没有同步放大。高概率假设是新增访客里存在低意向或价格敏感人群，且商品承接没有充分说服下单。若不先验证，后续动作越大，可能只是把无效流量放得更大。

## 03｜五维首诊

### 流量｜有拉动，但质量还没被证明

本周曝光和访客都被活动拉起来了，这是好信号。但现在还不能直接说明流量有效。如果新增访客主要来自价格敏感人群或活动低意向人群，继续放大活动可能只会增加浏览，不一定增加成交。

### 转化｜当前最该先看的卡点

当前首要卡点是转化承接。下周不建议泛泛“优化详情页”，而是先看详情页首屏、加购收藏、新品评价、满减门槛和客服咨询阻力到底卡在哪里。

### 成交｜增长来源还没有拆清

现在还不能判断GMV主要由新品、老品、满减活动还是高客单商品贡献。新品既可能带来流量，也可能拉低整体转化，需要单独拆开看。

### 投放｜先统一口径，再谈加减预算

ROI口径不统一时，直接加预算或停预算都可能误判。这里应先确认平台归因口径，再决定哪些计划放量、哪些计划止损。

### 售后/复购｜退款率健康，但不能直接等同复购健康

退款率健康是好信号，说明用户买完后没有明显不满。但退款率低不代表用户会回来继续买，后续还需要看老客成交占比、复购率和二次购买周期。

## 04｜下周不做大改，只先验证3件事

| 动作 | 怎么做 | 做完怎么决策 |
|---|---|---|
| 核实ROI口径 | 确认ROI按广告引导成交、全店成交还是平台归因口径统计。 | 口径清楚后，再决定哪些计划加预算、哪些计划止损。 |
| 拆新品/老品转化 | 单独看新品访客、加购、下单、支付和详情页跳失。 | 若新品点击高转化低，先改卖点、评价和首屏；若老品稳新品弱，新品先别盲目放量。 |
| 回访加购未下单用户 | 抽样10个加购未付款用户，记录未成交原因。 | 若价格敏感多，调满减门槛；若信任不足，补评价和买家秀；若卖点不清，重写首屏表达。 |

## 05｜为什么建议连续看4周

单周数据只能看到异常，连续4周才能确认规律。4周追踪的价值不是每周多一份报告，而是每周用同一套口径验证：问题是否持续、动作是否有效、下周是否要调整方向。

- 第1周：统一数据口径，确认真实卡点。
- 第2周：验证新品和老品转化差异。
- 第3周：根据加购未下单原因调整商品页和活动机制。
- 第4周：复盘GMV、转化率、ROI是否被动作拉动。

## 06｜下一步建议

这周不建议马上大改页面、继续加预算或加大满减。更稳的方式，是先用4周把核心问题跑清楚：如果确认问题在转化承接，就集中优化商品页、评价、卖点和活动机制；如果问题在流量人群，就调整投放和活动入口；如果问题在商品结构，就重新拆新品、老品和高客单商品的成交贡献。这样做的价值不是多拿几份报告，而是避免店铺在错误方向上继续投入。

## 07｜生成与数据边界

本报告由AI经营诊断流程生成初稿，并经经营逻辑校验后输出。本报告属于单周首诊判断，不替代完整月度复盘或平台后台深度审计，不承诺一定提升GMV。
"""
