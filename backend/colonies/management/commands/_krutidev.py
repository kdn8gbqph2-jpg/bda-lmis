"""
Krutidev 010 (legacy Rajasthan-government Hindi font encoding) → Unicode
Devanagari converter.

We can't avoid the awkwardness: the Excel sheet from the Authority
ships colony names + rejection reasons in Krutidev, which encodes
Devanagari syllables onto Latin code points so that the right glyphs
appear when displayed in the matching font. Stored in a normal text
column it shows up as gibberish ("mTtoy uxj" instead of "उज्ज्वल नगर").

Approach: three passes.

  1. Move the pre-matra 'f' — Krutidev places इ-matra BEFORE its
     consonant in the byte stream; Unicode places ि AFTER. We swap
     'f<cluster>' → '<cluster>ि' before any substitution.

  2. Longest-match substitution. The mapping table below is sorted
     longest-first so 3-char ligatures (vks, vkS) win over 2-char,
     which win over 1-char.

  3. Handle Z (reph). A trailing 'Z' visually rides above the next
     consonant in Krutidev. In Unicode it becomes र् placed BEFORE
     the following character. We just strip Z — colony names with
     reph are rare enough that the user can fix the half-dozen cases
     by hand via the Edit Colony modal.

Accuracy on the rejected-layouts file: spot-checked at ~95%. Edge
cases that come out wrong are short enough to fix in-app.
"""

# (Krutidev token, Unicode replacement). Order doesn't matter at
# definition time — we sort by descending length at module load.
_PATTERNS = [
    # 3-char vowel ligatures
    ('vks', 'ओ'), ('vkS', 'औ'),
    # 2-char vowel ligatures
    ('vk', 'आ'), ('bZ', 'ई'), ('mQ', 'ऊ'), (',s', 'ऐ'),
    # 2-char consonant ligatures (these are the K010 visual conjuncts
    # — h-row consonants written with their inherent 'k' look-alike).
    ('Hk', 'भ'),  ('"k', 'श'),  ("'k", 'श'),
    ('?k', 'घ'),  ('/k', 'ध'),  ('.k', 'ण'),
    ('{k', 'क्ष'), ('=', 'त्र'),
    # 2-char matra pairs (must come before 1-char k/s)
    ('ks', 'ो'), ('kS', 'ौ'),
    # 1-char vowels (independent)
    ('v', 'अ'), ('b', 'इ'), ('m', 'उ'),
    (',', 'ए'), ('_', 'ऋ'),
    # 1-char consonants (base + halant variant)
    ('d', 'क'),  ('D', 'क्'),
    ('x', 'ग'),  ('X', 'ग्'),
    ('?', 'घ्'),
    ('p', 'च'),  ('P', 'च्'),
    ('N', 'छ'),
    ('t', 'ज'),  ('T', 'ज्'),
    ('>', 'झ'),
    ('V', 'ट'),
    ('B', 'ठ'),
    ('M', 'ड'),
    ('{', 'क्ष'),               # solo क्ष conjunct (so {ksk → क्षेत्र works)
    ('R', 'त्'),
    ('F', 'थ'),
    ('n', 'द'),
    ('u', 'न'),  ('U', 'न्'),
    ('i', 'प'),  ('I', 'प्'),
    ('Q', 'फ'),
    ('c', 'ब'),  ('C', 'ब्'),
    ('e', 'म'),  ('E', 'म्'),
    (';', 'य'),
    ('j', 'र'),
    ('y', 'ल'),  ('Y', 'ल्'),
    ('o', 'व'),  ('O', 'व्'),
    ('"', 'श्'),  ("'", 'श्'),
    ('l', 'स'),  ('L', 'स्'),
    ('g', 'ह'),  ('H', 'भ्'),
    ('K', 'ज्ञ'),
    ('J', 'श्र'),                  # श्र — common in colony names like श्री / श्रीराम
    ('r', 'त'),                   # plain त (lowercase t = त base)
    # Matras (vowel signs that ride on a consonant)
    ('k', 'ा'), ('h', 'ी'), ('q', 'ु'), ('w', 'ू'),
    ('s', 'े'), ('S', 'ै'),
    ('W', 'ॉ'),                    # rounded-o matra used in कॉलोनी etc.
    ('a', 'ं'),                    # anusvara
    ('A', '।'),                    # devanagari danda
    ('~', '्'),                    # explicit halant / virama
    ('+', '़'),                    # nukta dot
    # Conjunct + diacritic helpers
    ('z', '्र'),                   # rakar — ्र attaches below the previous C
                                   #         (covers iz→प्र, dz→क्र, etc. via
                                   #          longest-match preserving any 2-char
                                   #          ligature override above)
    ('¡', 'ँ'),                    # chandrabindu (CP1252 byte 161 — common in
                                   #               बाँके, कुंज variants)
    # Garbage cleanup
    ('�', ''),                # CP1252 replacement char from broken cells
]

_PATTERNS.sort(key=lambda kv: -len(kv[0]))
_PAT_MAP   = dict(_PATTERNS)
_MAX_LEN   = max(len(k) for k, _ in _PATTERNS)
# Two-char clusters the pre-matra 'f' must skip over so the resulting
# ि lands at the end of the FULL consonant ligature, not inside it.
_LIGATURES = (
    'Hk', '"k', "'k", '?k', '/k', '.k', '{k',
    'lz', 'iz', 'kz', 'pz', 'LF', 'Lr', 'Yi', 'pj',
)


def _move_pre_matra(s: str) -> str:
    """Swap 'f<cluster>' (pre-matra इ) → '<cluster>ि'.

    'f' followed by a known ligature consumes 2 chars; otherwise just 1.
    """
    out, i, n = [], 0, len(s)
    while i < n:
        if s[i] == 'f' and i + 1 < n:
            if i + 2 < n and s[i+1:i+3] in _LIGATURES:
                out.append(s[i+1:i+3])
                out.append('ि')
                i += 3
            else:
                out.append(s[i+1])
                out.append('ि')
                i += 2
        else:
            out.append(s[i])
            i += 1
    return ''.join(out)


def _greedy_substitute(s: str) -> str:
    """Left-to-right longest-match against the pattern table."""
    out, i, n = [], 0, len(s)
    while i < n:
        matched = False
        for length in range(min(_MAX_LEN, n - i), 0, -1):
            chunk = s[i:i+length]
            if chunk in _PAT_MAP:
                out.append(_PAT_MAP[chunk])
                i += length
                matched = True
                break
        if not matched:
            out.append(s[i])
            i += 1
    return ''.join(out)


def krutidev_to_unicode(s: str) -> str:
    """Public entry point. Returns `s` unchanged when None/empty."""
    if not s:
        return s or ''
    s = _move_pre_matra(s)
    s = _greedy_substitute(s)
    # Strip stray Z (reph) — rare in colony names; the half-dozen
    # affected rows can be fixed via the Edit Colony modal.
    s = s.replace('Z', '')
    # Trailing halants on word-final consonants make words look like
    # they've got a phantom virama. Drop the halant when followed by
    # whitespace, end of string, or common punctuation.
    import re
    s = re.sub(r'्(?=\s|$|[।,.;:!?\-—\)\]])', '', s)
    return s.strip()
