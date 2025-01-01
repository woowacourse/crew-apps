"""
Parse PR data from woowacourse/gemini-canvas-mission to extract app information.

Input:  src/data/raw-prs.json  (fetched via `gh pr list`)
Output: src/data/apps-from-prs.json
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = ROOT / "src" / "data" / "raw-prs.json"
OUT_PATH = ROOT / "src" / "data" / "apps-from-prs.json"

# Category section markers (ordered) — match ##, **, or bold text variants
SECTION_DEFS = [
    ("유틸리티", re.compile(
        r'(?:^|\n)[#*>\s]*(?:💻\s*)?(?:1\.?\s*)?유틸리티\s*앱'
        r'|카테고리[:\s]*(?:💻\s*)?유틸리티\s*앱',
        re.IGNORECASE
    )),
    ("게임", re.compile(
        r'(?:^|\n)[#*>\s]*(?:🎮\s*)?(?:2\.?\s*)?게임'
        r'|카테고리[:\s]*(?:🎮\s*)?게임',
        re.IGNORECASE
    )),
    ("학습", re.compile(
        r'(?:^|\n)[#*>\s]*(?:📚\s*)?(?:3\.?\s*)?학습\s*앱'
        r'|카테고리[:\s]*(?:📚\s*)?학습\s*앱',
        re.IGNORECASE
    )),
    ("페어 프롬프트 릴레이", re.compile(
        r'(?:^|\n)[#*>\s]*(?:🤝\s*)?(?:4\.?\s*)?페어\s*프롬프트\s*릴레이',
        re.IGNORECASE
    )),
]

# Patterns for extracting fields within a section
NAME_PATTERNS = [
    # ### 앱 이름\n> ### Name  or  ### 앱 이름\nName (with optional > prefix and ** bold)
    re.compile(r'[#*>\s]*앱\s*이름[#*>\s]*\n+[>\s]*[#*\s]*`?([^\n`]+?)`?\s*$', re.MULTILINE),
    # ## 앱 이름: Name  or  **앱 이름**: Name
    re.compile(r'[#*>\s]*앱\s*이름\s*[:：]\s*\**\s*`?([^\n`]+?)`?\s*$', re.MULTILINE),
    # - [Name]  (bold list item)
    re.compile(r'^\s*[-*]\s*\[([^\]]+)\]\s*$', re.MULTILINE),
    # ### 🎨 AppName: subtitle  (emoji-prefixed heading, first ### after section header)
    re.compile(r'^###\s+\S+\s+(.+?)(?:\n|$)', re.MULTILINE),
    # **앱 이름**: Name  or  **앱 이름** : Name (bold without markdown heading)
    re.compile(r'\*\*앱\s*이름\*\*\s*[:：]\s*(.+?)(?:\n|$)', re.MULTILINE),
]

# Pattern to extract app name from section header itself (e.g. "## 💻 1. 유틸리티 앱: AppName")
SECTION_NAME_PATTERN = re.compile(
    r'(?:유틸리티\s*앱|게임|학습\s*앱|페어\s*프롬프트\s*릴레이(?:\s*앱)?)\s*[:：]\s*(.+?)(?:\n|$)',
    re.MULTILINE
)

LINK_PATTERN = re.compile(r'https://gemini\.google\.com/share/[a-f0-9]+')
MD_LINK_PATTERN = re.compile(r'\[.*?\]\((https://gemini\.google\.com/share/[a-f0-9]+)\)')

REASON_PATTERN = re.compile(
    r'(?:어떤\s*문제|불편함을?\s*해결|이\s*앱을?\s*만든\s*이유).*?\n([\s\S]*?)(?=\n###|\n##|\n---|\Z)',
    re.MULTILINE
)

FEATURES_PATTERN = re.compile(
    r'###?\s*주요\s*기능\s*\n([\s\S]*?)(?=\n###|\n##|\n---|\Z)',
    re.MULTILINE
)

NICKNAME_PATTERN = re.compile(r'\]\s*(.+?)\s*미션\s*제출')


def extract_gemini_links(text: str) -> list[str]:
    """Extract all gemini share links from text."""
    # Get links from both markdown and bare URLs, deduplicate preserving order
    md_links = MD_LINK_PATTERN.findall(text)
    bare_links = LINK_PATTERN.findall(text)
    seen = set()
    result = []
    for link in md_links + bare_links:
        if link not in seen:
            seen.add(link)
            result.append(link)
    return result


def extract_name_from_section(section_text: str) -> str | None:
    """Try to extract app name from a section."""
    skip_words = ['체크리스트', '배포 링크', '이 앱을 만든', '주요 기능', 'AI 기능',
                   '프롬프트', '피드백', '제출', '수정 내용', '사용 일지']
    for pat in NAME_PATTERNS:
        m = pat.search(section_text)
        if m:
            name = m.group(1).strip().strip('*').strip('`').strip('#').strip()
            if name and len(name) < 100 and not any(w in name for w in skip_words):
                return name
    return None


def extract_reason(section_text: str) -> str | None:
    """Extract the reason/motivation for building the app."""
    m = REASON_PATTERN.search(section_text)
    if m:
        text = m.group(1).strip()
        # Clean up markdown formatting
        lines = []
        for line in text.split('\n'):
            line = line.strip().lstrip('-').lstrip('*').strip()
            if line and not line.startswith('#') and not line.startswith('['):
                lines.append(line)
        result = ' '.join(lines[:5])  # Limit to first few lines
        if len(result) > 500:
            result = result[:500] + '...'
        return result if result else None
    return None


def extract_features(section_text: str) -> list[str]:
    """Extract main features list."""
    m = FEATURES_PATTERN.search(section_text)
    if not m:
        return []
    text = m.group(1)
    features = []
    for line in text.split('\n'):
        line = line.strip().lstrip('-').lstrip('*').lstrip('0123456789.').strip()
        if line and not line.startswith('#') and len(line) > 5:
            # Clean bold markers
            line = re.sub(r'\*\*(.+?)\*\*', r'\1', line)
            features.append(line)
            if len(features) >= 5:
                break
    return features


def split_into_sections(body: str) -> dict[str, str]:
    """Split PR body into category sections."""
    positions = []
    for cat_name, pattern in SECTION_DEFS:
        m = pattern.search(body)
        if m:
            positions.append((m.start(), cat_name))

    if not positions:
        return {}

    positions.sort(key=lambda x: x[0])
    sections = {}
    for i, (start, cat_name) in enumerate(positions):
        end = positions[i + 1][0] if i + 1 < len(positions) else len(body)
        sections[cat_name] = body[start:end]

    return sections


def parse_non_standard_pr(pr: dict) -> list[dict]:
    """Parse PRs that don't follow the standard 4-section format."""
    body = strip_blockquotes(pr['body'])
    apps = []

    # Strategy 1: Split by --- dividers
    chunks = re.split(r'\n---+\n', body)
    # Strategy 2: If only one chunk, split by top-level headings with links
    if len(chunks) <= 1:
        chunks = re.split(r'\n(?=# [^#])', body)

    for chunk in chunks:
        links = extract_gemini_links(chunk)
        if not links:
            continue

        # Determine category from chunk
        category = None
        cat_map = [
            (r'유틸리티', "유틸리티"),
            (r'게임', "게임"),
            (r'학습|교육|튜터', "학습"),
            (r'페어\s*프롬프트\s*릴레이', "페어 프롬프트 릴레이"),
        ]
        for pat, cat in cat_map:
            if re.search(pat, chunk):
                category = cat
                break

        # Try to find app name — multiple strategies
        name = extract_name_from_section(chunk)

        if not name:
            # Look for # heading that looks like an app name
            for heading_m in re.finditer(r'(?:^|\n)[#>*\s]*([^\n#*>]{3,60})\s*$', chunk, re.MULTILINE):
                candidate = heading_m.group(1).strip().strip('*').strip('`').strip()
                skip_words = ['체크리스트', '수정 내용', '제출', '이 앱을', '배포 링크',
                              '주요 기능', 'AI 기능', '프롬프트', '피드백', '카테고리']
                if candidate and not any(w in candidate for w in skip_words):
                    name = candidate
                    break

        if name and links:
            # Avoid duplicates by URL
            if not any(a['url'] == links[0] for a in apps):
                apps.append({
                    "name": name,
                    "category": category or "기타",
                    "url": links[0],
                    "reason": extract_reason(chunk),
                    "features": extract_features(chunk),
                })

    return apps


def strip_blockquotes(body: str) -> str:
    """Strip leading > from blockquoted PR bodies."""
    lines = body.split('\n')
    # If more than half the lines start with >, strip the prefix
    quoted = sum(1 for l in lines if l.strip().startswith('>'))
    if quoted > len(lines) * 0.4:
        return '\n'.join(
            re.sub(r'^>\s?', '', l) for l in lines
        )
    return body


def parse_pr(pr: dict) -> list[dict]:
    """Parse a single PR and return list of app dicts."""
    body = strip_blockquotes(pr['body'])
    nickname_m = NICKNAME_PATTERN.search(pr['title'])
    nickname = nickname_m.group(1).strip() if nickname_m else None
    github_id = pr['author']['login']
    pr_number = pr['number']
    pr_url = pr['url']

    sections = split_into_sections(body)

    if not sections:
        # Try non-standard parsing
        apps = parse_non_standard_pr(pr)
        for app in apps:
            app['author'] = nickname or github_id
            app['githubId'] = github_id
            app['prNumber'] = pr_number
            app['prUrl'] = pr_url
        return apps

    apps = []
    for cat_name, section_text in sections.items():
        links = extract_gemini_links(section_text)
        if not links:
            continue

        name = extract_name_from_section(section_text)
        # Fallback: check if name is in the section header itself
        if not name:
            m = SECTION_NAME_PATTERN.search(section_text)
            if m:
                name = m.group(1).strip().strip('*').strip('`')
        reason = extract_reason(section_text)
        features = extract_features(section_text)

        apps.append({
            "name": name or f"({cat_name} 앱)",
            "category": cat_name,
            "url": links[0],
            "reason": reason,
            "features": features,
            "author": nickname or github_id,
            "githubId": github_id,
            "prNumber": pr_number,
            "prUrl": pr_url,
        })

    return apps


def main():
    with open(RAW_PATH) as f:
        prs = json.load(f)

    all_apps = []
    parse_failures = []

    for pr in prs:
        apps = parse_pr(pr)
        if apps:
            all_apps.extend(apps)
        else:
            parse_failures.append(f"PR #{pr['number']} by {pr['author']['login']}")

    # Post-process: clean up names and reasons
    for app in all_apps:
        name = app['name']
        # Remove URL fragments from name
        name = re.sub(r'https?://\S+', '', name).strip()
        # Remove markdown artifacts
        name = re.sub(r'^[-*`#>\s]+', '', name)
        name = re.sub(r'[-*`#>\s]+$', '', name)
        # Remove leading "수정본 URL :" prefix
        name = re.sub(r'^수정본\s*URL\s*[:：]?\s*', '', name)
        name = name.strip()
        if not name:
            name = f"({app['category']} 앱)"
        app['name'] = name

        # Clean reason field
        if app.get('reason'):
            reason = app['reason']
            reason = re.sub(r'\*\*[^*]+\*\*', '', reason)  # Remove bold markers with content
            reason = re.sub(r'<br\s*/?>', ' ', reason)
            reason = re.sub(r'\s+', ' ', reason).strip()
            app['reason'] = reason if reason else None

    # Sort by PR number descending
    all_apps.sort(key=lambda x: (-x['prNumber'], x['category']))

    # Summary
    print(f"Total PRs: {len(prs)}")
    print(f"Total apps extracted: {len(all_apps)}")
    print(f"PRs with no apps extracted: {len(parse_failures)}")
    if parse_failures:
        for f_name in parse_failures:
            print(f"  - {f_name}")

    # Category breakdown
    cats = {}
    for app in all_apps:
        cats[app['category']] = cats.get(app['category'], 0) + 1
    print("\nBy category:")
    for cat, count in sorted(cats.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {count}")

    # Apps without names
    unnamed = [a for a in all_apps if a['name'].startswith('(')]
    if unnamed:
        print(f"\nApps without extracted name: {len(unnamed)}")

    with open(OUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(all_apps, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to {OUT_PATH}")


if __name__ == '__main__':
    main()
