import re
import ahocorasick
from typing import List, Dict, Any

class SignatureMatcher:
    def __init__(self, signatures: List[Dict[str, Any]]):
        self.automaton = ahocorasick.Automaton()
        self.regex_signatures = []
        for idx, sig in enumerate(signatures):
            # Ensure 'type' is always present
            if 'type' not in sig:
                sig['type'] = None
            if sig.get("regex"):
                sig["compiled"] = re.compile(sig["pattern"])
                self.regex_signatures.append(sig)
            else:
                self.automaton.add_word(sig['pattern'], (idx, sig))
        self.automaton.make_automaton()
        self.signatures = signatures

    def match(self, text: str) -> List[Dict[str, Any]]:
        results: List[Dict[str, Any]] = []
        # Aho–Corasick substring matches with offsets
        for end_index, (idx, sig) in self.automaton.iter(text):
            length = len(sig['pattern'])
            start = end_index - length + 1
            enriched = dict(sig)
            enriched['start'] = start
            enriched['end'] = end_index
            enriched['origin'] = 'aho'
            results.append(enriched)
        # Regex matches with first match offsets
        for sig in self.regex_signatures:
            m = sig["compiled"].search(text)
            if m:
                enriched = dict(sig)
                enriched['start'] = m.start()
                enriched['end'] = m.end() - 1
                enriched['origin'] = 'regex'
                results.append(enriched)
        return results

# Example usage:
# signatures = [
#     {"pattern": "nmap", "id": "nmap_scan", "description": "Nmap scan detected"},
#     {"pattern": "cat /etc/passwd", "id": "passwd_access", "description": "Sensitive file access"}
# ]
# matcher = SignatureMatcher(signatures)
# result = matcher.match("cat /etc/passwd && nmap 192.168.1.1")
# print(result)
