# First Diagnosis Report Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub Actions runnable internal tool that reads first-diagnosis customer data from CSV or Notion, calls Doubao/Volcengine Ark, and generates Markdown + Word report drafts for manual QA.

**Architecture:** The tool is a small standard-library Python project. Sources are isolated in `csv_source.py` and `notion_source.py`; validation, prompt generation, Doubao API calls, and Word rendering are separate modules. GitHub Actions runs `python -m src.main` and uploads generated reports as artifacts.

**Tech Stack:** Python 3.11 standard library, Notion REST API, Volcengine Ark OpenAI-compatible chat completions API, GitHub Actions.

---

## Implemented File Map

- `README.md`: operating guide and workflow overview.
- `.env.example`: local environment variable template.
- `.github/workflows/generate-report.yml`: manual GitHub Actions workflow.
- `config/field_mapping.json`: Notion/CSV field mapping.
- `config/prompt_template.md`: customer-facing first diagnosis report prompt.
- `samples/sample_customer_data.csv`: sample input.
- `src/models.py`: typed data models.
- `src/config.py`: path and config loading.
- `src/normalizer.py`: raw row to `CustomerData`.
- `src/csv_source.py`: CSV loader.
- `src/notion_source.py`: Notion database query and property parsing.
- `src/validator.py`: data consistency checks.
- `src/llm_client.py`: Doubao/Volcengine Ark API client and dry-run report.
- `src/report_generator.py`: prompt assembly and report generation.
- `src/docx_renderer.py`: minimal OpenXML Word renderer.
- `src/main.py`: CLI entrypoint.
- `docs/notion_setup.md`: Notion setup.
- `docs/github_setup.md`: GitHub setup.
- `docs/quality_check.md`: manual QA checklist.

## Verification Plan

- Run dry-run locally where Python is available:
  `python -m src.main --source csv --customer-id C001 --dry-run`
- Validate GitHub Actions with `source=csv`, `customer_id=C001`, `dry_run=true`.
- Add GitHub Secrets and validate Doubao with `dry_run=false`.
- Configure Notion and validate with `source=notion`, `customer_id=<客户编号>`.
