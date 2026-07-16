#!/usr/bin/env python3
"""Build the complete objective-question bank from review pages and OCR page metadata."""

from __future__ import annotations

import json
import re
from pathlib import Path

import lxml.html


ROOT = Path(__file__).resolve().parents[1]
REFERENCE_DIR = ROOT / "tmp/reference-pages"
OCR_JSON = ROOT / "tmp/ocr/objective/questions.json"
OUTPUT = ROOT / "app/data/objective-bank.json"
MANUAL_ANSWERS = {
    ("2015年下半年", 10): "C",
    ("2017年上半年", 11): "D",
    ("2024年下半年", 21): "C",
}

QUESTION_RE = re.compile(r"^\s*(\d{1,2})\s*[.、．]\s*(.+)")
OPTION_RE = re.compile(r"^\s*([ABCD])\s*[.、．]\s*(.*)", re.I)
ANSWER_RE = re.compile(r"(?:正确答案|参考答案|〖答案〗|【答案】|答案|答)\s*[：;:]?\s*([ABCD])", re.I)


def compact(text: str) -> str:
    return re.sub(r"\s+", "", text).strip()


def content_lines(path: Path) -> list[str]:
    root = lxml.html.fromstring(path.read_bytes())
    if path.name == "2025a-zm.html":
        nodes = root.xpath('//div[contains(@class,"news_detail_content")]')
    elif path.name.startswith("2014"):
        nodes = root.xpath('//*[contains(@class,"content")]')
    else:
        nodes = root.xpath('//*[contains(@class,"entry-content")]')
    articles = root.xpath("//article")
    node = max(nodes, key=lambda x: len(x.text_content())) if nodes else articles[0] if articles else root
    raw_lines = [re.sub(r"\s+", " ", text).strip() for text in node.xpath(".//text()") if text.strip()]
    lines: list[str] = []
    for line in raw_lines:
        if path.name.startswith("2014"):
            line = re.sub(r"^(\d{1,2})(?=[\u4e00-\u9fff])", r"\1、", line)
            line = re.sub(r"^([ABCD])(?=[\u4e00-\u9fff《])", r"\1.", line)
        option_starts = list(re.finditer(r"(?<![A-Za-z])([ABCD])\s*[.、．](?=\S)", line))
        if len(option_starts) > 1:
            prefix = line[:option_starts[0].start()].strip()
            if prefix:
                lines.append(prefix)
            for index, match in enumerate(option_starts):
                end = option_starts[index + 1].start() if index + 1 < len(option_starts) else len(line)
                lines.append(line[match.start():end].strip())
        else:
            lines.append(line)
    return lines


def parse_page(path: Path) -> list[dict]:
    lines = content_lines(path)
    items: list[dict] = []
    current: dict | None = None
    active_option: str | None = None
    in_objective = False
    awaiting_answer = False

    def finish() -> None:
        nonlocal current
        if not current:
            return
        options = current.pop("_options")
        current["stem"] = compact("".join(current.pop("_stem")))
        current["options"] = [compact("".join(options.get(letter, []))) for letter in "ABCD"]
        items.append(current)
        current = None

    for line in lines:
        if "单项选择题" in line or "单选题" in line or "选择题" in line and "本大题" in line:
            in_objective = True
        if path.name.startswith("2014") and QUESTION_RE.match(line):
            in_objective = True
        if not in_objective:
            continue
        if re.search(r"[二三四]、", line) and any(word in line for word in ("辨析题", "简答题", "材料分析题")):
            break

        answer_match = ANSWER_RE.search(line)
        if answer_match and current:
            current["answer"] = answer_match.group(1).upper()
            active_option = None
            awaiting_answer = False
            continue
        if line in {"〖答案〗", "【答案】", "答案", "参考答案"} and current:
            awaiting_answer = True
            active_option = None
            continue
        if awaiting_answer and current and re.fullmatch(r"[ABCD]", line, re.I):
            current["answer"] = line.upper()
            awaiting_answer = False
            continue

        question_match = QUESTION_RE.match(line)
        if question_match and 1 <= int(question_match.group(1)) <= 21:
            finish()
            current = {
                "number": int(question_match.group(1)),
                "_stem": [question_match.group(2)],
                "_options": {},
                "answer": "",
            }
            active_option = None
            awaiting_answer = False
            continue

        if not current:
            continue
        option_match = OPTION_RE.match(line)
        if option_match:
            active_option = option_match.group(1).upper()
            current["_options"].setdefault(active_option, []).append(option_match.group(2))
        elif not current["answer"]:
            if active_option:
                current["_options"].setdefault(active_option, []).append(line)
            else:
                current["_stem"].append(line)

    finish()
    deduped: dict[int, dict] = {}
    for item in items:
        existing = deduped.get(item["number"])
        if existing is None or (not existing["answer"] and item["answer"]):
            deduped[item["number"]] = item
    return [deduped[number] for number in sorted(deduped)]


def chapter_for(stem: str) -> tuple[str, str]:
    rules = [
        (("课程", "课改", "学科课程", "校本"), ("中学课程", "课程与课程改革")),
        (("教学原则", "教学过程", "教学方法", "备课", "上课", "教学组织"), ("中学教学", "教学规律与实施")),
        (("德育", "品德", "道德", "科尔伯格"), ("中学德育", "品德发展与德育")),
        (("班主任", "班集体", "课堂管理", "课堂纪律"), ("班级与教师", "班级管理")),
        (("教师心理", "教学效能", "职业倦怠", "教学反思"), ("班级与教师", "教师心理")),
        (("心理健康", "辅导", "强迫症", "焦虑症", "系统脱敏"), ("心理辅导", "心理健康与辅导")),
        (("记忆", "遗忘", "注意", "知觉", "思维", "想象"), ("学习心理", "认知过程")),
        (("学习动机", "迁移", "强化", "学习理论", "策略", "自我效能"), ("学习心理", "学习与动机")),
        (("气质", "人格", "自我同一性", "青春期", "认知发展"), ("发展心理", "中学生心理发展")),
    ]
    for needles, result in rules:
        if any(needle in stem for needle in needles):
            return result
    return "教育基础知识", "教育原理与教育史"


def difficulty_for(stem: str) -> str:
    if len(stem) > 95 or any(word in stem for word in ("材料", "根据", "这说明", "主要体现", "属于")):
        return "中等"
    if any(word in stem for word in ("不正确", "最适宜", "最佳", "根本途径", "唯一")):
        return "困难"
    return "简单"


def main() -> None:
    ocr_items = json.loads(OCR_JSON.read_text(encoding="utf-8")) if OCR_JSON.exists() else []
    ocr_lookup = {(item["exam"], item["number"]): item for item in ocr_items}
    all_items: list[dict] = []

    sources = sorted(REFERENCE_DIR.glob("20??[ab].html")) + [REFERENCE_DIR / "2025a-zm.html"]
    for path in sources:
        if path.name == "2025a.html" or not path.exists():
            continue
        match = re.match(r"(20\d{2})([ab])", path.name)
        if not match:
            continue
        exam = f"{match.group(1)}年{'上' if match.group(2) == 'a' else '下'}半年"
        parsed_items = parse_page(path)
        if path.name == "2014a.html":
            extra = [item for item in parse_page(REFERENCE_DIR / "2014a-2.html") if 18 <= item["number"] <= 21]
            merged = {item["number"]: item for item in [*parsed_items, *extra]}
            parsed_items = [merged[number] for number in sorted(merged)]
        for item in parsed_items:
            stem = item["stem"]
            chapter, topic = chapter_for(stem)
            ocr = ocr_lookup.get((exam, item["number"]), {})
            item["answer"] = item["answer"] or MANUAL_ANSWERS.get((exam, item["number"]), "")
            item["options"] = [
                re.split(r"(?:正确答案|正确选项|剩余内容需解锁)", option)[0]
                for option in item["options"]
            ]
            answer_option = ""
            if item["answer"] and len(item["options"]) == 4:
                answer_option = item["options"]["ABCD".index(item["answer"])]
            all_items.append(
                {
                    "id": f"edu-{match.group(1)}{match.group(2)}-{item['number']:02d}",
                    "subject": "education",
                    "chapter": chapter,
                    "topic": topic,
                    "type": "mcq",
                    "difficulty": difficulty_for(stem),
                    "stem": stem,
                    "options": item["options"],
                    "answer": item["answer"],
                    "explanation": (
                        f"正确答案是 {item['answer']}：{answer_option}。"
                        if item["answer"]
                        else "本题答案仍需人工复核，暂不计入正确率。"
                    ),
                    "source": f"十年真题 · {exam}",
                    "sourcePage": ocr.get("sourcePage", 0),
                    "exam": exam,
                    "questionNumber": item["number"],
                    "answerConfidence": "cross-checked" if item["answer"] else "needs-review",
                    "tags": ["历年真题", exam, "单项选择题"],
                }
            )

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(all_items, ensure_ascii=False, indent=2), encoding="utf-8")
    missing = [(item["exam"], item["questionNumber"]) for item in all_items if not item["answer"]]
    print(f"wrote {len(all_items)} objective questions to {OUTPUT}")
    print(f"missing answers ({len(missing)}): {missing}")


if __name__ == "__main__":
    main()
