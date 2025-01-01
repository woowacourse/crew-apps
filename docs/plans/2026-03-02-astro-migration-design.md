# Astro 마이그레이션 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** witty-web을 React SPA에서 Astro 기반 정적 사이트로 전환하여, 500+ 앱까지 확장 가능한 구조로 개선한다.

**Architecture:** Astro + React Islands + Pagefind. 앱 데이터를 Content Collections (Markdown frontmatter)로 관리. 정적 HTML 우선, React 아일랜드는 검색/필터와 댓글 2개만 사용. Pagefind로 빌드 시 검색 인덱스 자동 생성.

**Tech Stack:** Astro 5, React 18, Tailwind CSS 3, Pagefind, TypeScript

---

### Task 1: Astro 프로젝트 초기 설정

**Files:**
- Create: `astro.config.mjs`
- Create: `src/env.d.ts`
- Modify: `package.json` (의존성 교체)
- Modify: `tsconfig.json` (Astro 용으로 교체)

**Step 1: Astro 및 핵심 의존성 설치**

```bash
bun add astro @astrojs/react @astrojs/tailwind astro-pagefind
bun add -d @astrojs/check
```

**Step 2: 미사용 의존성 제거**

```bash
bun remove @tanstack/react-query @hookform/resolvers react-hook-form recharts react-day-picker embla-carousel-react react-resizable-panels cmdk input-otp vaul sonner next-themes react-router-dom zod date-fns @radix-ui/react-accordion @radix-ui/react-alert-dialog @radix-ui/react-aspect-ratio @radix-ui/react-avatar @radix-ui/react-checkbox @radix-ui/react-collapsible @radix-ui/react-context-menu @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-hover-card @radix-ui/react-label @radix-ui/react-menubar @radix-ui/react-navigation-menu @radix-ui/react-popover @radix-ui/react-progress @radix-ui/react-radio-group @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slider @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-tabs @radix-ui/react-toast @radix-ui/react-toggle @radix-ui/react-toggle-group @radix-ui/react-tooltip lovable-tagger @vitejs/plugin-react-swc vite vitest jsdom @testing-library/jest-dom @testing-library/react eslint eslint-plugin-react-hooks eslint-plugin-react-refresh globals @eslint/js typescript-eslint
```

**Step 3: astro.config.mjs 생성**

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import pagefind from 'astro-pagefind';

export default defineConfig({
  site: 'https://witty-web.vercel.app',
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    pagefind(),
  ],
  build: { format: 'directory' },
});
```

**Step 4: tsconfig.json을 Astro 용으로 교체**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "jsx": "react-jsx"
  }
}
```

**Step 5: src/env.d.ts 생성**

```typescript
/// <reference path="../.astro/types.d.ts" />
```

**Step 6: package.json scripts 업데이트**

```json
{
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check"
  }
}
```

**Step 7: 커밋**

```bash
git add -A && git commit -m "chore: init Astro project, remove unused deps"
```

---

### Task 2: 스타일 및 레이아웃 기반

**Files:**
- Move: `src/index.css` → `src/styles/global.css`
- Adapt: `tailwind.config.ts` → `tailwind.config.mjs`
- Create: `src/layouts/BaseLayout.astro`
- Keep: `src/lib/utils.ts` (cn 헬퍼)

**Step 1: global.css 이동 및 수정**

`src/styles/global.css` — 기존 `src/index.css` 내용 그대로 유지. Astro의 `<style is:global>`이 아닌 layout에서 import.

**Step 2: tailwind.config.mjs 변환**

기존 `tailwind.config.ts`를 `.mjs`로 변환. content 경로를 Astro용으로 수정:

```javascript
content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"]
```

`require("tailwindcss-animate")` → `import tailwindAnimate from 'tailwindcss-animate'` ESM 변환.

**Step 3: BaseLayout.astro 생성**

```astro
---
interface Props {
  title: string;
  description?: string;
}
const { title, description = '크루들이 직접 만든 유용한 웹앱을 한곳에서 만나보세요.' } = Astro.props;
---
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <title>{title}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body class="bg-background text-foreground font-sans antialiased">
    <slot />
    <footer class="max-w-3xl mx-auto px-6 py-8 border-t border-border text-center">
      <p class="text-xs text-muted-foreground">
        우아한테크코스 크루들이 만든 앱 모음 · Built with ❤️
      </p>
    </footer>
  </body>
</html>
```

Layout에서 `import '../styles/global.css';` 추가.

**Step 4: 빌드 확인**

```bash
bun run build
```

Expected: 빈 Astro 사이트 빌드 성공

**Step 5: 커밋**

```bash
git add -A && git commit -m "feat: add BaseLayout, migrate styles to Astro"
```

---

### Task 3: Content Collections 스키마 + 앱 데이터 변환

**Files:**
- Create: `src/content.config.ts`
- Create: `src/content/apps/*.md` (12개 파일)
- Create: `scripts/convert-apps.ts` (변환 스크립트, 이후 삭제)

**Step 1: Content Collections 스키마 정의**

`src/content.config.ts`:

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const apps = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/apps' }),
  schema: z.object({
    name: z.string(),
    emoji: z.string(),
    description: z.string(),
    category: z.enum(['생산성', '학습', '게임', '유틸리티', '커뮤니티', '라이프스타일']),
    author: z.string(),
    cohort: z.string(),
    url: z.string().url(),
    visitors: z.number(),
    screenshots: z.array(z.string()).default([]),
    usage: z.array(z.string()),
    comments: z.array(z.object({
      author: z.string(),
      text: z.string(),
      date: z.string(),
    })).default([]),
  }),
});

export const collections = { apps };
```

**Step 2: 변환 스크립트로 12개 Markdown 파일 생성**

`scripts/convert-apps.ts` — 기존 `apps.ts`의 데이터를 읽어 `src/content/apps/` 에 Markdown 파일 생성. 각 파일의 이름은 앱 name을 slug화 (예: `pair-matching.md`).

frontmatter에는 모든 필드 포함, `mockComments` 데이터도 `comments` 필드로 통합.

```bash
bun run scripts/convert-apps.ts
```

Expected: `src/content/apps/` 에 12개 `.md` 파일 생성

**Step 3: 기존 src/data/apps.ts 삭제 (타입 정의만 별도 보존)**

카테고리 타입과 colorMap은 `src/lib/categories.ts`로 추출:

```typescript
export type AppCategory = '생산성' | '학습' | '게임' | '유틸리티' | '커뮤니티' | '라이프스타일';
export type CategoryColor = 'blue' | 'green' | 'orange' | 'pink' | 'purple' | 'yellow';

export const categoryColorMap: Record<AppCategory, CategoryColor> = {
  '생산성': 'blue',
  '학습': 'green',
  '게임': 'orange',
  '유틸리티': 'purple',
  '커뮤니티': 'pink',
  '라이프스타일': 'yellow',
};

export const allCategories = Object.keys(categoryColorMap) as AppCategory[];
```

**Step 4: 빌드 확인**

```bash
bun run build
```

Expected: Content Collections 인식, 스키마 검증 통과

**Step 5: 변환 스크립트 삭제 + 커밋**

```bash
rm scripts/convert-apps.ts
git add -A && git commit -m "feat: add Content Collections schema, convert 12 apps to Markdown"
```

---

### Task 4: Astro 정적 컴포넌트 (JS 0)

**Files:**
- Create: `src/components/CategoryTag.astro`
- Create: `src/components/AppCard.astro`
- Create: `src/components/HeroSection.astro`

**Step 1: CategoryTag.astro**

기존 React CategoryTag의 스타일을 Astro 컴포넌트로 변환. onClick 없음 (정적).

```astro
---
import type { AppCategory } from '@/lib/categories';
import { categoryColorMap } from '@/lib/categories';

interface Props {
  category: AppCategory;
}

const { category } = Astro.props;
const color = categoryColorMap[category];

const colorClasses: Record<string, string> = {
  blue: 'bg-notion-tag-blue text-notion-tag-blue-text',
  green: 'bg-notion-tag-green text-notion-tag-green-text',
  orange: 'bg-notion-tag-orange text-notion-tag-orange-text',
  pink: 'bg-notion-tag-pink text-notion-tag-pink-text',
  purple: 'bg-notion-tag-purple text-notion-tag-purple-text',
  yellow: 'bg-notion-tag-yellow text-notion-tag-yellow-text',
};
---
<span class={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ${colorClasses[color]}`}>
  {category}
</span>
```

**Step 2: AppCard.astro**

```astro
---
import CategoryTag from './CategoryTag.astro';
import type { AppCategory } from '@/lib/categories';

interface Props {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: AppCategory;
  author: string;
  cohort: string;
  visitors: number;
}

const { id, name, emoji, description, category, author, cohort, visitors } = Astro.props;
---
<a
  href={`/app/${id}/`}
  data-category={category}
  data-name={name.toLowerCase()}
  data-author={author.toLowerCase()}
  data-pagefind-result
  class="app-card group block rounded-lg border border-border p-4 transition-colors hover:bg-notion-hover"
>
  <div class="flex items-start gap-3">
    <span class="text-2xl leading-none mt-0.5">{emoji}</span>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <h3 class="font-semibold text-sm text-foreground truncate">{name}</h3>
      </div>
      <p class="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">{description}</p>
      <div class="flex items-center justify-between">
        <CategoryTag category={category} />
        <div class="flex items-center gap-3 text-xs text-muted-foreground">
          <span class="flex items-center gap-1">
            <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            {visitors.toLocaleString()}
          </span>
          <span>{author} · {cohort}</span>
        </div>
      </div>
    </div>
  </div>
</a>
```

`data-category`, `data-name`, `data-author` 속성으로 클라이언트 필터링 지원.

**Step 3: HeroSection.astro**

빌드 시 인기 앱 상위 3개 고정 렌더링. Fisher-Yates 셔플은 빌드 시 실행 (매 빌드마다 랜덤).

```astro
---
interface FeaturedApp {
  id: string;
  name: string;
  emoji: string;
  url: string;
  visitors: number;
  author: string;
}

interface Props {
  apps: FeaturedApp[];
}

const { apps } = Astro.props;

// 빌드 시 실행: 상위 5개 중 3개 랜덤 선택
const sorted = [...apps].sort((a, b) => b.visitors - a.visitors);
const top = sorted.slice(0, 5);
for (let i = top.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [top[i], top[j]] = [top[j], top[i]];
}
const featured = top.slice(0, 3);
---
<section class="mb-12">
  <div class="mb-8">
    <h1 class="text-3xl font-bold tracking-tight text-foreground mb-2">
      우아한테크코스 앱 모음
    </h1>
    <p class="text-muted-foreground text-sm">
      크루들이 직접 만든 유용한 웹앱을 한곳에서 만나보세요.
    </p>
  </div>
  <div class="flex items-center gap-2 mb-4">
    <svg class="w-4 h-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
    <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">인기 앱</span>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
    {featured.map((app) => (
      <a
        href={app.url}
        target="_blank"
        rel="noopener noreferrer"
        class="group flex items-center gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-notion-hover"
      >
        <span class="text-3xl">{app.emoji}</span>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-sm text-foreground truncate">{app.name}</span>
            <svg class="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </div>
          <p class="text-xs text-muted-foreground truncate mt-0.5">
            {app.visitors.toLocaleString()}명 방문 · {app.author}
          </p>
        </div>
      </a>
    ))}
  </div>
</section>
```

**Step 4: 커밋**

```bash
git add -A && git commit -m "feat: add Astro static components (AppCard, CategoryTag, HeroSection)"
```

---

### Task 5: 메인 페이지 (index.astro)

**Files:**
- Create: `src/pages/index.astro`
- Create: `src/components/SearchFilter.tsx` (React 아일랜드)

**Step 1: index.astro 작성**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import HeroSection from '@/components/HeroSection.astro';
import AppCard from '@/components/AppCard.astro';
import SearchFilter from '@/components/SearchFilter.tsx';
import { getCollection } from 'astro:content';

const allApps = await getCollection('apps');
const apps = allApps.map(app => ({ id: app.id, ...app.data }));
---
<BaseLayout title="우아한테크코스 앱 모음">
  <div class="max-w-3xl mx-auto px-6 py-16">
    <HeroSection apps={apps} />

    <SearchFilter client:load categories={[...new Set(apps.map(a => a.category))]} />

    <div id="app-grid" class="space-y-2">
      {apps.map((app) => (
        <AppCard
          id={app.id}
          name={app.name}
          emoji={app.emoji}
          description={app.description}
          category={app.category}
          author={app.author}
          cohort={app.cohort}
          visitors={app.visitors}
        />
      ))}
      <div id="no-results" class="text-center py-16 hidden">
        <p class="text-muted-foreground text-sm">검색 결과가 없습니다.</p>
      </div>
    </div>
  </div>
</BaseLayout>
```

**Step 2: SearchFilter.tsx (React 아일랜드)**

검색바 + 카테고리 필터 버튼. DOM의 `.app-card` 요소를 `data-*` 속성으로 show/hide.

```tsx
import { useState, useCallback } from 'react';
import type { AppCategory } from '@/lib/categories';
import { categoryColorMap } from '@/lib/categories';

interface Props {
  categories: AppCategory[];
}

const colorClasses: Record<string, string> = {
  blue: 'bg-notion-tag-blue text-notion-tag-blue-text',
  green: 'bg-notion-tag-green text-notion-tag-green-text',
  orange: 'bg-notion-tag-orange text-notion-tag-orange-text',
  pink: 'bg-notion-tag-pink text-notion-tag-pink-text',
  purple: 'bg-notion-tag-purple text-notion-tag-purple-text',
  yellow: 'bg-notion-tag-yellow text-notion-tag-yellow-text',
};

export default function SearchFilter({ categories }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | null>(null);

  const filterCards = useCallback((searchVal: string, category: AppCategory | null) => {
    const cards = document.querySelectorAll<HTMLElement>('.app-card');
    const query = searchVal.toLowerCase();
    let visibleCount = 0;

    cards.forEach(card => {
      const name = card.dataset.name || '';
      const author = card.dataset.author || '';
      const cat = card.dataset.category || '';
      const matchesSearch = !query || name.includes(query) || author.includes(query);
      const matchesCategory = !category || cat === category;
      const visible = matchesSearch && matchesCategory;
      card.style.display = visible ? '' : 'none';
      if (visible) visibleCount++;
    });

    const noResults = document.getElementById('no-results');
    if (noResults) noResults.style.display = visibleCount === 0 ? '' : 'none';
  }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    filterCards(val, selectedCategory);
  };

  const handleCategory = (cat: AppCategory | null) => {
    setSelectedCategory(cat);
    filterCards(search, cat);
  };

  return (
    <div className="mb-6 space-y-4">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="앱 이름, 제작자로 검색..."
          className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleCategory(null)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-opacity ${
            selectedCategory === null ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
          }`}
        >
          전체
        </button>
        {categories.map(cat => {
          const color = categoryColorMap[cat];
          const isActive = selectedCategory === null || selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => handleCategory(selectedCategory === cat ? null : cat)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-opacity ${colorClasses[color]} ${isActive ? 'opacity-100' : 'opacity-40'}`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

**Step 3: dev 서버로 확인**

```bash
bun run dev
```

Expected: 메인 페이지에 히어로, 검색, 필터, 앱 카드 그리드 렌더링. 검색 입력 시 실시간 필터링.

**Step 4: 커밋**

```bash
git add -A && git commit -m "feat: add index page with SearchFilter React island"
```

---

### Task 6: 앱 상세 페이지 ([id].astro)

**Files:**
- Create: `src/pages/app/[id].astro`
- Create: `src/components/CommentSection.tsx` (React 아일랜드)

**Step 1: [id].astro 작성**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import CategoryTag from '@/components/CategoryTag.astro';
import CommentSection from '@/components/CommentSection.tsx';
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const apps = await getCollection('apps');
  return apps.map(app => ({
    params: { id: app.id },
    props: { app },
  }));
}

const { app } = Astro.props;
const { name, emoji, description, category, author, cohort, url, visitors, screenshots, usage, comments } = app.data;
---
<BaseLayout title={`${name} - 우아한테크코스 앱`} description={description}>
  <div class="max-w-2xl mx-auto px-6 py-12">
    <a href="/" class="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8">
      <svg class="w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
      전체 앱 목록
    </a>

    <!-- Header -->
    <div class="mb-10">
      <div class="flex items-center gap-4 mb-3">
        <span class="text-5xl">{emoji}</span>
        <div>
          <h1 class="text-2xl font-bold text-foreground">{name}</h1>
          <p class="text-sm text-muted-foreground mt-1">{author} · {cohort}</p>
        </div>
      </div>
      <p class="text-sm text-muted-foreground leading-relaxed mt-4">{description}</p>
      <div class="flex items-center gap-4 mt-4">
        <CategoryTag category={category} />
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {visitors.toLocaleString()}명 방문
        </span>
        <a href={url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto">
          앱 열기
          <svg class="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
        </a>
      </div>
    </div>

    <hr class="border-border mb-8" />

    <!-- Usage -->
    <section class="mb-10">
      <h2 class="text-sm font-semibold text-foreground mb-4">📖 사용법</h2>
      <ol class="space-y-3">
        {usage.map((step, i) => (
          <li class="flex items-start gap-3">
            <span class="flex-shrink-0 w-5 h-5 rounded-full bg-secondary text-foreground text-xs font-medium flex items-center justify-center mt-0.5">
              {i + 1}
            </span>
            <span class="text-sm text-muted-foreground leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>
    </section>

    <hr class="border-border mb-8" />

    <!-- Screenshots -->
    <section class="mb-10">
      <h2 class="text-sm font-semibold text-foreground mb-4">📸 스크린샷</h2>
      {screenshots.length > 0 ? (
        <div class="grid grid-cols-2 gap-3">
          {screenshots.map((src, i) => (
            <img src={src} alt={`${name} 스크린샷 ${i + 1}`} class="rounded-lg border border-border w-full" loading="lazy" />
          ))}
        </div>
      ) : (
        <div class="rounded-lg border border-dashed border-border bg-secondary/50 p-8 text-center">
          <p class="text-xs text-muted-foreground">아직 스크린샷이 등록되지 않았습니다.</p>
        </div>
      )}
    </section>

    <hr class="border-border mb-8" />

    <!-- Comments (React Island) -->
    <CommentSection client:visible initialComments={comments} />
  </div>
</BaseLayout>
```

**Step 2: CommentSection.tsx**

기존 AppDetail의 댓글 로직을 독립 React 컴포넌트로 추출.

```tsx
import { useState } from 'react';

interface Comment {
  author: string;
  text: string;
  date: string;
}

interface Props {
  initialComments: Comment[];
}

export default function CommentSection({ initialComments }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newAuthor, setNewAuthor] = useState('');
  const [newText, setNewText] = useState('');

  const handleSubmit = () => {
    if (!newAuthor.trim() || !newText.trim()) return;
    setComments(prev => [...prev, {
      author: newAuthor.trim(),
      text: newText.trim(),
      date: new Date().toISOString().split('T')[0],
    }]);
    setNewAuthor('');
    setNewText('');
  };

  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-4">
        💬 댓글 ({comments.length})
      </h2>

      {comments.length > 0 && (
        <div className="space-y-4 mb-6">
          {comments.map((c, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-foreground flex-shrink-0">
                {c.author[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-foreground">{c.author}</span>
                  <span className="text-xs text-muted-foreground">{c.date}</span>
                </div>
                <p className="text-sm text-muted-foreground">{c.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-4 space-y-3">
        <input
          type="text"
          value={newAuthor}
          onChange={(e) => setNewAuthor(e.target.value)}
          placeholder="이름"
          className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <div className="flex gap-2">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <button
            onClick={handleSubmit}
            disabled={!newAuthor.trim() || !newText.trim()}
            className="px-3 py-2 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-30 hover:opacity-80 transition-opacity"
          >
            <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </div>
    </section>
  );
}
```

**Step 3: dev 서버에서 상세 페이지 확인**

```bash
bun run dev
# 브라우저에서 /app/pair-matching/ 접속
```

Expected: 기존과 동일한 상세 페이지 레이아웃, 댓글 인터랙션 작동

**Step 4: 커밋**

```bash
git add -A && git commit -m "feat: add app detail page with CommentSection React island"
```

---

### Task 7: 정리 및 빌드 검증

**Files:**
- Delete: `src/data/apps.ts`
- Delete: `src/pages/Index.tsx`, `src/pages/AppDetail.tsx`, `src/pages/NotFound.tsx`
- Delete: `src/components/AppCard.tsx` (React 버전), `src/components/HeroSection.tsx` (React 버전), `src/components/CategoryTag.tsx` (React 버전)
- Delete: `src/components/NavLink.tsx` (if exists)
- Delete: `src/App.tsx`
- Delete: `src/main.tsx`
- Delete: `src/hooks/` (use-mobile, use-toast — 미사용)
- Delete: `src/components/ui/` (shadcn/ui 전체 — 미사용)
- Delete: `vite.config.ts`, `eslint.config.js`
- Delete: `index.html` (Astro가 자체 생성)
- Create: `src/pages/404.astro`

**Step 1: 404 페이지 생성**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---
<BaseLayout title="페이지를 찾을 수 없습니다">
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <p class="text-muted-foreground text-sm mb-4">페이지를 찾을 수 없습니다.</p>
      <a href="/" class="text-sm text-foreground underline underline-offset-4 hover:text-muted-foreground">
        ← 돌아가기
      </a>
    </div>
  </div>
</BaseLayout>
```

**Step 2: 기존 React SPA 파일 삭제**

```bash
rm -f src/data/apps.ts src/App.tsx src/main.tsx vite.config.ts index.html
rm -f src/pages/Index.tsx src/pages/AppDetail.tsx src/pages/NotFound.tsx
rm -f src/components/AppCard.tsx src/components/HeroSection.tsx src/components/CategoryTag.tsx src/components/NavLink.tsx
rm -rf src/components/ui/ src/hooks/
rm -f eslint.config.js tsconfig.app.json tsconfig.json.bak
```

**Step 3: 전체 빌드 확인**

```bash
bun run build
```

Expected: 정적 사이트 빌드 성공. `dist/` 에 index.html + app/*/index.html + pagefind 인덱스

**Step 4: 프리뷰 확인**

```bash
bun run preview
```

Expected: 전체 페이지 정상 작동, 검색/필터/댓글 인터랙션 확인

**Step 5: 커밋**

```bash
git add -A && git commit -m "chore: remove legacy React SPA files, add 404 page"
```

---

### Task 8: Pagefind 검색 통합 (선택적 강화)

**Files:**
- Modify: `src/components/SearchFilter.tsx` (Pagefind API 연동)

**Step 1: SearchFilter에 Pagefind 검색 추가**

현재 SearchFilter는 `data-*` 속성으로 DOM 필터링. Pagefind를 추가하면 description 포함 전문 검색 가능.

```tsx
// SearchFilter.tsx 상단에 추가
useEffect(() => {
  async function loadPagefind() {
    try {
      // @ts-ignore - Pagefind는 빌드 후 생성
      const pf = await import('/pagefind/pagefind.js');
      await pf.init();
      pagefindRef.current = pf;
    } catch {
      // dev 모드에서는 pagefind 없음 — DOM 필터링 fallback
    }
  }
  loadPagefind();
}, []);
```

Pagefind 사용 가능 시 검색어에 대해 Pagefind API 호출, 결과 ID로 카드 show/hide. 불가 시 기존 DOM 필터링 fallback.

**Step 2: 빌드 + 프리뷰에서 Pagefind 검색 확인**

```bash
bun run build && bun run preview
```

Expected: 빌드 로그에 "Pagefind indexed N pages", 프리뷰에서 검색 시 전문 검색 작동

**Step 3: 커밋**

```bash
git add -A && git commit -m "feat: integrate Pagefind full-text search"
```

---

## 실행 순서 요약

| Task | 내용 | 의존성 |
|------|------|--------|
| 1 | Astro 프로젝트 초기 설정 | 없음 |
| 2 | 스타일 + BaseLayout | Task 1 |
| 3 | Content Collections + 데이터 변환 | Task 1 |
| 4 | Astro 정적 컴포넌트 | Task 3 |
| 5 | 메인 페이지 + SearchFilter | Task 2, 3, 4 |
| 6 | 상세 페이지 + CommentSection | Task 2, 3, 4 |
| 7 | 정리 + 빌드 검증 | Task 5, 6 |
| 8 | Pagefind 검색 강화 | Task 7 |

Task 2와 3은 병렬 실행 가능. Task 5와 6도 병렬 실행 가능.
