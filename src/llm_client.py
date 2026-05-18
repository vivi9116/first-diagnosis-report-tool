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
    return """# AI电商经营首诊报告

## 01｜老板30秒摘要

本次首诊显示，店铺当前的主要问题不是单纯缺流量，而是流量进入后成交承接不足。建议先围绕主推商品转化链路做修复，再决定是否继续扩大投放。

## 02｜店铺经营状态判断

当前店铺属于成长阶段，已经具备基础流量和成交，但经营复盘还不够稳定。首诊重点应放在转化、投放效率和主推款承接能力上。

## 03｜五维经营诊断

### 流量

已有一定曝光和访客基础，流量端不是唯一瓶颈。后续需要进一步区分自然流量、活动流量和付费流量质量。

### 转化

成交承接偏弱，建议优先检查主推款首图、详情页首屏、优惠表达和客服高频问题。

### 成交

订单和销售额需要结合访客规模一起看。若流量增长但订单增长弱，说明成交效率存在压力。

### 投放

投放需要关注投产比和低效计划。建议先收缩低效流量入口，保留高转化关键词或人群。

### 售后/复购

当前售后数据不足，建议后续补充退款原因、评价关键词和复购数据。

## 04｜核心问题链路

流量进入店铺后，主推商品没有充分完成成交说服，导致成交增长没有完全承接住流量变化。下周应先修复转化链路，再考虑加大投放。

## 05｜下周优先行动

| 优先级 | 动作 | 负责人建议 | 截止时间建议 | 验证指标 |
|---|---|---|---|---|
| P1 | 优化主推款详情页首屏卖点 | 运营 | 周三前 | 支付转化率 |
| P1 | 暂停低效投放计划 | 投放 | 周二前 | 投产比 |
| P2 | 整理客服高频问题并补充页面说明 | 客服/运营 | 周五前 | 咨询转化率 |

## 06｜需要继续验证的数据

- 主推款点击率、收藏加购率。
- 自然流量与付费流量占比。
- 退款原因和评价关键词。
- 近4周趋势数据。

## 07｜是否建议进入4周经营周报试点

建议进入4周经营周报试点。单次首诊只能判断当前问题，连续4周才能验证行动建议是否真正改善经营数据。

## 08｜数据说明与判断边界

本报告基于客户提交数据生成，仅作为经营复盘和行动建议参考，不承诺一定提升GMV。重大投放、定价和库存决策仍需结合平台后台明细确认。
"""
