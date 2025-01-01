import { useState, useCallback, useEffect, useRef } from 'react';
import type { AppCategory } from '../lib/categories';
import { categoryColorMap } from '../lib/categories';

type SortOption = 'newest' | 'name' | 'author';

const PAGE_SIZE = 30;

interface Props {
  categories: AppCategory[];
  categoryCounts: Record<string, number>;
  totalCount: number;
}

const colorClasses: Record<string, string> = {
  blue: 'bg-notion-tag-blue text-notion-tag-blue-text',
  green: 'bg-notion-tag-green text-notion-tag-green-text',
  orange: 'bg-notion-tag-orange text-notion-tag-orange-text',
  pink: 'bg-notion-tag-pink text-notion-tag-pink-text',
  purple: 'bg-notion-tag-purple text-notion-tag-purple-text',
  yellow: 'bg-notion-tag-yellow text-notion-tag-yellow-text',
};

const sortLabelMap: Record<SortOption, string> = {
  newest: '최신순',
  name: '이름순',
  author: '작성자순',
};

function readUrlParams(): { q: string; category: string; sort: SortOption } {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const sortRaw = params.get('sort') ?? '';
  const sort: SortOption =
    sortRaw === 'name' || sortRaw === 'author' || sortRaw === 'newest'
      ? sortRaw
      : 'newest';
  return { q, category, sort };
}

function updateUrl(q: string, category: string | null, sort: SortOption) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (sort !== 'newest') params.set('sort', sort);
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  history.replaceState(null, '', url);
}

function setCountDisplay(el: HTMLElement, visibleCount: number, totalCount: number, isSearching: boolean) {
  // Clear existing content
  while (el.firstChild) el.removeChild(el.firstChild);

  if (!isSearching && visibleCount === totalCount) {
    // "총 {total}개의 앱"
    el.appendChild(document.createTextNode('총 '));
    const strong = document.createElement('strong');
    strong.className = 'text-foreground';
    strong.textContent = String(totalCount);
    el.appendChild(strong);
    el.appendChild(document.createTextNode('개의 앱'));
  } else {
    // "{visible} / {total}개의 앱"
    const strong = document.createElement('strong');
    strong.className = 'text-foreground';
    strong.textContent = String(visibleCount);
    el.appendChild(strong);
    el.appendChild(document.createTextNode(` / ${totalCount}개의 앱`));
  }
}

export default function SearchFilter({ categories, categoryCounts, totalCount }: Props) {
  const initialised = useRef(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory | null>(null);
  const [sort, setSort] = useState<SortOption>('newest');
  const [page, setPage] = useState(1);

  // Central function that applies filter + sort + pagination + count + URL sync.
  // All parameters are passed explicitly to avoid stale closures.
  const applyAll = useCallback(
    (searchVal: string, category: AppCategory | null, sortVal: SortOption, pageVal: number) => {
      const grid = document.getElementById('app-grid');
      if (!grid) return;

      const cards = Array.from(grid.querySelectorAll<HTMLElement>('.app-card'));
      const query = searchVal.toLowerCase();
      const isSearching = !!query || !!category;

      // 1. Filter: determine which cards match
      const matched: HTMLElement[] = [];
      for (const card of cards) {
        const name = card.dataset.name ?? '';
        const author = card.dataset.author ?? '';
        const reason = card.dataset.reason ?? '';
        const cat = card.dataset.category ?? '';
        const matchesSearch =
          !query || name.includes(query) || author.includes(query) || reason.includes(query);
        const matchesCategory = !category || cat === category;
        if (matchesSearch && matchesCategory) {
          matched.push(card);
        }
      }

      // 2. Sort the matched cards
      matched.sort((a, b) => {
        if (sortVal === 'newest') {
          const prA = parseInt(a.dataset.pr ?? '0', 10);
          const prB = parseInt(b.dataset.pr ?? '0', 10);
          return prB - prA; // descending
        }
        if (sortVal === 'name') {
          return (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '', 'ko');
        }
        // author
        return (a.dataset.author ?? '').localeCompare(b.dataset.author ?? '', 'ko');
      });

      // 3. Reorder DOM: move all cards into sorted order (matched first, then unmatched)
      const matchedSet = new Set(matched);
      const unmatched = cards.filter((c) => !matchedSet.has(c));

      // Use a document fragment for efficient DOM reordering
      const noResults = document.getElementById('no-results');
      const fragment = document.createDocumentFragment();
      for (const card of matched) fragment.appendChild(card);
      for (const card of unmatched) fragment.appendChild(card);
      if (noResults) fragment.appendChild(noResults);
      grid.appendChild(fragment);

      // 4. Pagination: when browsing all (no search/filter active), paginate
      const showAll = isSearching;
      const visibleLimit = showAll ? matched.length : Math.min(pageVal * PAGE_SIZE, matched.length);

      for (let i = 0; i < matched.length; i++) {
        matched[i].style.display = i < visibleLimit ? '' : 'none';
      }
      for (const card of unmatched) {
        card.style.display = 'none';
      }

      const visibleCount = Math.min(visibleLimit, matched.length);

      // 5. No-results message
      if (noResults) {
        noResults.style.display = visibleCount === 0 ? '' : 'none';
      }

      // 6. Update count display
      const countEl = document.getElementById('app-count');
      if (countEl) {
        setCountDisplay(countEl, visibleCount, totalCount, isSearching);
      }

      // 7. Load-more button
      const loadMoreBtn = document.getElementById('load-more-btn');
      const loadMoreWrap = document.getElementById('load-more-wrap');
      if (loadMoreBtn && loadMoreWrap) {
        if (showAll || visibleLimit >= matched.length) {
          loadMoreWrap.style.display = 'none';
        } else {
          loadMoreWrap.style.display = '';
          const remaining = matched.length - visibleLimit;
          const nextBatch = Math.min(PAGE_SIZE, remaining);
          loadMoreBtn.textContent = `더 보기 (${nextBatch}개 더)`;
        }
      }

      // 8. URL sync
      updateUrl(searchVal, category, sortVal);
    },
    [totalCount],
  );

  // On mount: read URL params, restore state, apply
  useEffect(() => {
    if (initialised.current) return;
    initialised.current = true;

    const { q, category: catParam, sort: sortParam } = readUrlParams();
    const validCat = categories.includes(catParam as AppCategory)
      ? (catParam as AppCategory)
      : null;

    setSearch(q);
    setSelectedCategory(validCat);
    setSort(sortParam);
    setPage(1);

    applyAll(q, validCat, sortParam, 1);

    // Wire up the load-more button click handler
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        // Read the current page from a data attribute since this handler is outside React
        const currentPage = parseInt(loadMoreBtn.dataset.page ?? '1', 10);
        const nextPage = currentPage + 1;
        loadMoreBtn.dataset.page = String(nextPage);
        // Dispatch a custom event that our React component listens to
        window.dispatchEvent(new CustomEvent('load-more', { detail: { page: nextPage } }));
      });
    }
  }, [applyAll, categories]);

  // Listen for load-more custom events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ page: number }>).detail;
      const newPage = detail.page;
      setPage(newPage);
      applyAll(search, selectedCategory, sort, newPage);
    };
    window.addEventListener('load-more', handler);
    return () => window.removeEventListener('load-more', handler);
  }, [search, selectedCategory, sort, applyAll]);

  // Keep the load-more button's page data attribute in sync
  useEffect(() => {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.dataset.page = String(page);
    }
  }, [page]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    applyAll(val, selectedCategory, sort, 1);
  };

  const handleCategory = (cat: AppCategory | null) => {
    setSelectedCategory(cat);
    setPage(1);
    applyAll(search, cat, sort, 1);
  };

  const handleSort = (newSort: SortOption) => {
    setSort(newSort);
    setPage(1);
    applyAll(search, selectedCategory, newSort, 1);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="앱 이름, 제작자로 검색..."
            className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => handleSort(e.target.value as SortOption)}
          className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 transition-shadow cursor-pointer"
        >
          {(Object.keys(sortLabelMap) as SortOption[]).map((key) => (
            <option key={key} value={key}>
              {sortLabelMap[key]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleCategory(null)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-opacity ${
            selectedCategory === null
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground'
          }`}
        >
          전체 ({totalCount})
        </button>
        {categories.map((cat) => {
          const color = categoryColorMap[cat];
          const isActive = selectedCategory === null || selectedCategory === cat;
          const count = categoryCounts[cat] ?? 0;
          return (
            <button
              key={cat}
              onClick={() => handleCategory(selectedCategory === cat ? null : cat)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-opacity ${colorClasses[color]} ${isActive ? 'opacity-100' : 'opacity-40'}`}
            >
              {cat} ({count})
            </button>
          );
        })}
      </div>
    </div>
  );
}
