import rawApps from '../data/apps-from-prs.json';
import type { AppItem } from './types';
import type { AppCategory } from './categories';

const categoryMap: Record<string, AppCategory> = {
  '학습': '학습',
  '게임': '게임',
  '유틸리티': '유틸리티',
  '페어 프롬프트 릴레이': '학습',
};

function pickEmoji(name: string, category: string): string {
  const n = name.toLowerCase();

  // 이름에 이미 이모지가 포함된 경우 추출
  const emojiMatch = name.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
  if (emojiMatch) return emojiMatch[0];

  // 이름 키워드 기반 매칭
  const keywordMap: [RegExp, string][] = [
    [/퀴즈|모의고사|테스트/, '📝'],
    [/타자|타이핑|typer/i, '⌨️'],
    [/게임|아레나|대결|배틀|시뮬/, '🎮'],
    [/다트|궁|양궁|슈팅/, '🎯'],
    [/행성|갤럭시|우주|별/, '🌍'],
    [/뱀|스네이크|snake/i, '🐍'],
    [/곰|bear/i, '🐻'],
    [/다이어트|diet|칼로리/i, '🥗'],
    [/독서|책|book/i, '📚'],
    [/메모|노트|note/i, '📒'],
    [/루틴|습관|daily|일상/i, '📅'],
    [/회고|리뷰|retro/i, '🔄'],
    [/금연|건강|health/i, '💪'],
    [/여행|travel|dart/i, '✈️'],
    [/환율|통화|money|currency/i, '💱'],
    [/냉장고|음식|먹|밥|점심|lunch/i, '🍽️'],
    [/커피|카페/, '☕'],
    [/코딩|알고|algorithm|code/i, '💻'],
    [/git|pr|커밋|commit/i, '🔀'],
    [/채팅|chat|메시지|톡/i, '💬'],
    [/타이머|뽀모도로|pomodoro|시간/i, '⏱️'],
    [/사진|갤러리|ascii|image/i, '🖼️'],
    [/음악|뮤직|music/i, '🎵'],
    [/날씨|weather/i, '🌤️'],
    [/친해|소통|네트워크|ice.*break/i, '🤝'],
    [/스크럼|standup|til|로그|log/i, '📋'],
    [/계획|플래너|plan/i, '🗓️'],
    [/추천|랜덤|뽑기|pick/i, '🎲'],
    [/포털|허브|hub/i, '🏠'],
    [/템플릿|template/i, '📄'],
    [/컨벤션|convention|lint/i, '📏'],
    [/http|status|api/i, '🌐'],
  ];

  for (const [regex, emoji] of keywordMap) {
    if (regex.test(n)) return emoji;
  }

  // 카테고리 기반 폴백
  const categoryEmoji: Record<string, string> = {
    '게임': '🎮',
    '학습': '📚',
    '유틸리티': '🛠️',
  };
  return categoryEmoji[category] ?? '✨';
}

// URL 기준 중복 제거: 같은 URL의 앱은 하나로 병합, authors를 합침
const urlMap = new Map<string, {
  app: (typeof rawApps)[number];
  authors: Map<string, string>; // githubId → name
}>();

for (const app of rawApps) {
  if (/^\(.+\)$/.test(app.name)) continue;

  const existing = urlMap.get(app.url);
  if (existing) {
    if (!existing.authors.has(app.githubId)) {
      existing.authors.set(app.githubId, app.author);
    }
    // 더 긴 reason/features를 가진 항목으로 업데이트
    if ((app.reason?.length ?? 0) > (existing.app.reason?.length ?? 0)) {
      existing.app = { ...existing.app, reason: app.reason };
    }
    if (app.features.length > existing.app.features.length) {
      existing.app = { ...existing.app, features: app.features };
    }
  } else {
    const authors = new Map<string, string>();
    authors.set(app.githubId, app.author);
    urlMap.set(app.url, { app, authors });
  }
}

export const apps: AppItem[] = Array.from(urlMap.values()).map(({ app, authors }, index) => {
  const category = categoryMap[app.category] ?? '유틸리티';
  return {
    id: `${app.prNumber}-${index}`,
    name: app.name,
    emoji: pickEmoji(app.name, category),
    category,
    url: app.url,
    reason: app.reason,
    features: app.features,
    authors: Array.from(authors.entries()).map(([githubId, name]) => ({ name, githubId })),
    prNumber: app.prNumber,
    prUrl: app.prUrl,
  };
});
