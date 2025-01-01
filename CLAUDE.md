# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Korean-language portfolio/showcase site for apps built by 우아한테크코스 (Woowahan Tech Course) crew members. Displays app catalog with search, category filtering, detail pages, and comments. All data is static (no backend API).

## Commands

```bash
npm run dev          # Dev server on localhost:8080
npm run build        # Production build → dist/
npm run build:dev    # Development mode build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
npm run preview      # Preview production build locally
```

Package manager: bun (bun.lockb present), but npm works too.

## Tech Stack

- **React 18** SPA with **Vite 5** (SWC plugin)
- **TypeScript 5.8** (lenient — strict mode OFF, noImplicitAny OFF)
- **React Router DOM v6** for client-side routing
- **Tailwind CSS 3** with Notion-inspired tag colors (`notion-tag-blue`, `notion-tag-green`, etc. in tailwind.config.ts)
- **shadcn/ui** (Radix primitives + Tailwind) — components in `src/components/ui/`
- **TanStack React Query** configured but currently unused (static data)
- **Vitest** + React Testing Library + jsdom

## Architecture

```
src/
├── pages/           # Route-level components (Index, AppDetail, NotFound)
├── components/      # Shared components (AppCard, CategoryTag, HeroSection, NavLink)
│   └── ui/          # shadcn/ui primitives (do not hand-edit these)
├── data/apps.ts     # Static app catalog, categories, comments (single source of truth)
├── hooks/           # Custom hooks (use-mobile, use-toast)
├── lib/utils.ts     # cn() helper (clsx + tailwind-merge)
├── App.tsx          # Root: QueryClientProvider + TooltipProvider + BrowserRouter
└── index.css        # CSS variables for theming (HSL-based)
```

**Routes:** `/` → Index, `/app/:id` → AppDetail, `*` → NotFound

**Data model:** `AppItem` and `Comment` types defined in `src/data/apps.ts`. Categories are Korean strings (`생산성`, `학습`, `게임`, `유틸리티`, `커뮤니티`, `라이프스타일`) with a `categoryColorMap` mapping each to a Notion tag color (blue, green, orange, purple, pink, yellow).

**Mobile:** Breakpoint at 768px via `use-mobile` hook; responsive layout uses Tailwind `md:` prefix.

## Conventions

- **Import alias:** `@/*` maps to `src/*` (configured in tsconfig + vite)
- **UI language:** All user-facing text is Korean (한글)
- **Font:** Noto Sans KR (declared in index.css, falls back to system sans-serif)
- **Component style:** Functional components with TypeScript interfaces for props
- **Styling:** Tailwind utility classes only; responsive via `md:` breakpoints; dark mode via class strategy
- **shadcn/ui:** Add new components via `npx shadcn-ui@latest add <component>` — don't manually create files in `src/components/ui/`
- **Origin:** Built with Lovable — `lovable-tagger` plugin runs in dev mode
