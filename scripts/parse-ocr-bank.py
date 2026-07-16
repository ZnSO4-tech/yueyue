#!/usr/bin/env python3
"""Turn page-level OCR text into reviewable, structured exam questions."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


YEAR_RE = re.compile(r"(20\d{2})\s*年\s*([上下])\s*半年")
QUESTION_RE = re.compile(r"^\s*(\d{1,2})\s*[.．、]\s*(.*)$")
OPTION_RE = re.compile(r"^\s*([ABCD])\s*[.．、:：]?\s*(.*)$", re.I)


def is_noise(line: str) -> bool:
    compact = re.sub(r"\s+", "", line)
    return (
        not compact
        or "公众号" in compact
        or "西米学府团队原创整理" in compact
        or re.search(r"第\d+页[/／]共\d+页", compact) is not None
        or compact.startswith("中学教师资格证考试《教育知识与能力》十年真题")
        or compact in {"中学&《教育知识与能力》", "中学@教育知识与能力"}
    )


def normalize(text: str) -> str:
    return re.sub(r"\s+", "", text).replace("（西米学府团队整理>", "")


def page_number(path: Path) -> int:
    match = re.search(r"(\d+)$", path.stem)
    return int(match.group(1)) if match else 0


def parse_objective(files: list[Path]) -> list[dict]:
    questions: list[dict] = []
    current_exam = ""
    current: dict | None = None
    active_option: str | None = None
    in_question_section = False

    def finish() -> None:
        nonlocal current
        if not current:
            return
        current["stem"] = normalize("".join(current.pop("_stem")))
        option_parts = current.pop("_options")
        current["options"] = [
            normalize("".join(option_parts.get(letter, [])))
            for letter in "ABCD"
        ]
        current["needsReview"] = (
            len(current["options"]) != 4
            or any(not option for option in current["options"])
            or len(current["stem"]) < 8
        )
        questions.append(current)
        current = None

    for path in files:
        page = page_number(path)
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            year_match = YEAR_RE.search(line)
            if year_match:
                current_exam = f"{year_match.group(1)}年{year_match.group(2)}半年"
                in_question_section = False
            if "单项选择题" in line:
                in_question_section = True
            if is_noise(line):
                continue
            if not in_question_section:
                continue

            question_match = QUESTION_RE.match(line)
            if question_match and 1 <= int(question_match.group(1)) <= 21:
                finish()
                number = int(question_match.group(1))
                current = {
                    "exam": current_exam,
                    "number": number,
                    "sourcePage": page,
                    "_stem": [question_match.group(2)],
                    "_options": {},
                }
                active_option = None
                continue

            if not current:
                continue

            option_match = OPTION_RE.match(line)
            if option_match:
                active_option = option_match.group(1).upper()
                current["_options"].setdefault(active_option, []).append(option_match.group(2))
            elif active_option:
                current["_options"].setdefault(active_option, []).append(line)
            else:
                current["_stem"].append(line)

    finish()
    return questions


def parse_subjective(files: list[Path]) -> list[dict]:
    questions: list[dict] = []
    current_exam = ""
    current: dict | None = None

    def finish() -> None:
        nonlocal current
        if not current:
            return
        current["stem"] = normalize("".join(current.pop("_parts")))
        current["needsReview"] = len(current["stem"]) < 15
        questions.append(current)
        current = None

    for path in files:
        page = page_number(path)
        for raw_line in path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            year_match = YEAR_RE.search(line)
            if year_match:
                if current and current_exam and f"{year_match.group(1)}年{year_match.group(2)}半年" != current_exam:
                    finish()
                current_exam = f"{year_match.group(1)}年{year_match.group(2)}半年"
            if is_noise(line):
                continue

            question_match = QUESTION_RE.match(line)
            if question_match and 22 <= int(question_match.group(1)) <= 31:
                finish()
                number = int(question_match.group(1))
                kind = "trueFalse" if number <= 25 else "short" if number <= 29 else "material"
                current = {
                    "exam": current_exam,
                    "number": number,
                    "kind": kind,
                    "sourcePage": page,
                    "_parts": [question_match.group(2)],
                }
                continue
            if current:
                current["_parts"].append(line)

    finish()
    return questions


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--kind", choices=["objective", "subjective"], required=True)
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    files = sorted(Path(args.input_dir).glob("page-*.txt"))
    result = parse_objective(files) if args.kind == "objective" else parse_subjective(files)
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    exams: dict[str, list[int]] = {}
    for item in result:
        exams.setdefault(item["exam"] or "未识别场次", []).append(item["number"])
    print(f"parsed {len(result)} questions from {len(files)} pages")
    for exam, numbers in exams.items():
        expected = set(range(1, 22)) if args.kind == "objective" else set(range(22, 32))
        missing = sorted(expected - set(numbers))
        duplicates = sorted({n for n in numbers if numbers.count(n) > 1})
        print(f"{exam}: {len(numbers)} questions; missing={missing}; duplicates={duplicates}")


if __name__ == "__main__":
    main()
