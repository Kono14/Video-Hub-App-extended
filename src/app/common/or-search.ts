/**
 * Split a search term at the word `OR` (capital letters, with a space on each side) into its alternatives:
 * `kuzu OR alpha` => `['kuzu', 'alpha']` -- a video matches the term if it matches any of them.
 * Without `OR` the term is returned as it is, which keeps the default of every term having to match (AND).
 * @param term -- the search term as typed
 */
export function splitOrTerms(term: string): string[] {
  const alternatives: string[] = term.split(/\s+OR\s+/).map((part: string) => part.trim()).filter(Boolean);
  return alternatives.length ? alternatives : [term];
}
