// Simple glossary store & parser
export const glossaryDefinitions = {
  signature: 'A pattern used to identify known malicious activity in network or system data.',
  rule: 'A formal expression defining detection logic for matching events or packets.',
  anomaly: 'Behavior that deviates from a learned or expected baseline.',
};

const TERM_PATTERN = /\[\[([^\]]+)\]\]/g; // [[term]]

export function extractGlossaryTerms(markdown) {
  const terms = new Set();
  let m; while((m = TERM_PATTERN.exec(markdown))){ terms.add(m[1].trim().toLowerCase()); }
  return Array.from(terms);
}

export function replaceTermsWithSpans(markdown) {
  return markdown.replace(TERM_PATTERN, (_, raw) => {
    const term = raw.trim();
    const key = term.toLowerCase();
    return `<span class="glossary-term" data-term="${key}" tabindex="0">${term}</span>`;
  });
}
