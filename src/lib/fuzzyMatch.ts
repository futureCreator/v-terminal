export interface FuzzyResult {
  score: number;
  indices: number[];
}

export interface FuzzyMatchable {
  label: string;
  category: string;
  subSection: string | null;
  description?: string;
}

export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  let qi = 0;
  let score = 0;
  const indices: number[] = [];
  let lastMatch = -1;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      indices.push(ti);
      if (lastMatch === ti - 1) score += 5; // consecutive
      if (ti === 0 || /[\s\-:_]/.test(t[ti - 1])) score += 3; // word boundary
      if (ti === qi) score += 2; // prefix
      score += 1;
      lastMatch = ti;
      qi++;
    }
  }

  if (qi < q.length) return null;
  return { score, indices };
}

export function fuzzyMatchFields(query: string, item: FuzzyMatchable): FuzzyResult | null {
  const results = [
    fuzzyMatch(query, item.label),
    fuzzyMatch(query, item.category),
    item.subSection ? fuzzyMatch(query, item.subSection) : null,
    item.description ? fuzzyMatch(query, item.description) : null,
  ].filter((r): r is FuzzyResult => r !== null);

  if (results.length === 0) return null;
  return results.reduce((best, r) => (r.score > best.score ? r : best));
}
