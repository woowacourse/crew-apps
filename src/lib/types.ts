export interface AppItem {
  id: string;
  name: string;
  emoji: string;
  category: string;
  url: string;
  reason: string | null;
  features: string[];
  authors: { name: string; githubId: string }[];
  prNumber: number;
  prUrl: string;
}
