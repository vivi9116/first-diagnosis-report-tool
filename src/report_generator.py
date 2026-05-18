import json

from .config import load_prompt_template
from .llm_client import generate_dry_run_report, generate_with_doubao
from .models import CustomerData, ValidationResult


SYSTEM_PROMPT = (
    "你是严谨、务实的中国电商经营诊断顾问，擅长把中小商家的经营数据"
    "转化成老板能看懂、运营能执行、且适合陌生客户首次触达的商业化首诊报告。"
    "你的表达要像资深顾问，不像模板填充。"
)


def build_customer_prompt(data: CustomerData, validation: ValidationResult) -> str:
    template = load_prompt_template()
    payload = {
        "customer": data.to_prompt_dict(),
        "validation_warnings": validation.warnings,
        "validation_errors": validation.errors,
    }
    customer_data = json.dumps(payload, ensure_ascii=False, indent=2)
    return template.replace("{{CUSTOMER_DATA}}", customer_data)


def generate_report_markdown(data: CustomerData, validation: ValidationResult, dry_run: bool) -> str:
    user_prompt = build_customer_prompt(data, validation)
    if dry_run:
        return generate_dry_run_report(user_prompt)
    return generate_with_doubao(SYSTEM_PROMPT, user_prompt)
