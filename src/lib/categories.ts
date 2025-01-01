export type AppCategory = '학습' | '게임' | '유틸리티';
export type CategoryColor = 'green' | 'orange' | 'purple';

export const categoryColorMap: Record<AppCategory, CategoryColor> = {
  '학습': 'green',
  '게임': 'orange',
  '유틸리티': 'purple',
};

export const allCategories = Object.keys(categoryColorMap) as AppCategory[];
