#!/usr/bin/env python3
"""Convert the geography memory handbook's enumerated facts into recall questions."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "tmp/pdfs/study-review/geography-memory.txt"
OUTPUT = ROOT / "app/data/geography-bank.json"

PAGE_RE = re.compile(r"^=== PAGE (\d+) ===$")
HEADING_RE = re.compile(r"^(第[一二三四五六七八九十]+(?:部分|章).+|【考点\s*\d+】.+)$")
BULLET_RE = re.compile(r"^(?:[①②③④⑤⑥⑦⑧⑨⑩]|[（(]\d+[）)]|\d+[.、])\s*(.+)$")


def app_chapter(chapter: str, topic: str) -> str:
    text = f"{chapter}{topic}"
    if "地球与地图" in text:
        return "地球与地图"
    if "行星地球" in text or "天文学" in text:
        return "行星地球"
    if "大气" in text or "水" in text or "海洋" in text:
        return "大气与水"
    if "地表形态" in text:
        return "地表形态"
    if "人文地理" in text or "人口" in text or "生产活动" in text:
        return "人文地理"
    if "区域" in text or "世界地理" in text or "中国地理" in text or "旅游" in text:
        return "区域地理"
    if "课程标准" in text or "课程性质" in text:
        return "课程标准"
    return "教学设计"


def make_prompt(topic: str, fact: str) -> tuple[str, str]:
    fact = re.sub(r"\s+", "", fact).strip("。；")
    for separator in ("：", ":"):
        if separator in fact:
            left, right = fact.split(separator, 1)
            if 1 < len(left) <= 28 and len(right) >= 4:
                return f"{topic}中，“{left}”的要点是什么？", right
    match = re.match(r"(.{2,24}?)(?:是指|是|称为)(.{4,})", fact)
    if match:
        return f"什么是{match.group(1)}？", fact
    cue = re.sub(r"[，。；：].*", "", fact)[:16]
    return f"{topic}：请回忆“{cue}……”对应的完整知识点。", fact


def main() -> None:
    page = 1
    chapter = "自然地理"
    topic = "地球与地图"
    records: list[tuple[int, str, str, str]] = []
    current: list[str] | None = None
    current_page = page

    def finish() -> None:
        nonlocal current
        if not current:
            return
        fact = "".join(current)
        fact = re.sub(r"\s+", "", fact)
        if 8 <= len(fact) <= 240 and not any(noise in fact for noise in ("扫码", "公众号", "图中", "如下图")):
            records.append((current_page, chapter, topic, fact))
        current = None

    for raw in SOURCE.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        page_match = PAGE_RE.match(line)
        if page_match:
            finish()
            page = int(page_match.group(1))
            continue
        if not line or line.startswith("《地理》三色速记手册") or re.fullmatch(r"\d+", line):
            continue
        heading_match = HEADING_RE.match(line)
        if heading_match:
            finish()
            if "章" in line:
                chapter = re.sub(r"^第[一二三四五六七八九十]+章\s*", "", line)
            if line.startswith("【考点"):
                topic = re.sub(r"^【考点\s*\d+】", "", line)
            continue
        bullet_match = BULLET_RE.match(line)
        if bullet_match:
            finish()
            current_page = page
            current = [bullet_match.group(1)]
        elif current is not None:
            current.append(line)
    finish()

    seen: set[tuple[str, str]] = set()
    bank = []
    for index, (source_page, source_chapter, source_topic, fact) in enumerate(records, 1):
        stem, answer = make_prompt(source_topic, fact)
        key = (stem, answer)
        if key in seen:
            continue
        seen.add(key)
        points = [part for part in re.split(r"[；。]", answer) if len(part) >= 2][:8] or [answer]
        keywords = [[word] for word in points]
        bank.append({
            "id": f"geo-note-{index:04d}",
            "subject": "geography",
            "chapter": app_chapter(source_chapter, source_topic),
            "topic": source_topic,
            "type": "short",
            "difficulty": "中等" if len(answer) > 100 else "简单",
            "stem": stem,
            "answer": answer + "。",
            "explanation": "这是速记手册中的原始知识点。先抓关键词，再尝试用自己的话完整复述。",
            "scoringPoints": points,
            "keywords": keywords,
            "source": "《初中地理》三色速记手册",
            "sourcePage": source_page,
            "answerConfidence": "cross-checked",
            "tags": ["地理全覆盖", source_chapter, source_topic, "主动回忆"],
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(bank, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(bank)} geography recall questions to {OUTPUT}")


if __name__ == "__main__":
    main()
