/* The character catalogue for Specialtecken: a hand-picked set of the
   characters content work reaches for and a keyboard doesn't have. Not a
   Unicode database; add a row when one is missing.

   Each row: [character, Swedish name, extra search words (Swedish and
   English, space-separated), named HTML entity if it has one]. The official
   English name comes from Unicode, via names.ts, which
   scripts/gen-char-names.py writes; run it after adding a character. */

// With the extension, so the generator script can load this file in Node.
import { UNICODE_NAMES } from "./names.ts";

export interface Category {
  id: string;
  name: string;
  /** Chip label, when the name is long. */
  short?: string;
}

export interface Char {
  ch: string;
  name: string;
  /** Official Unicode name, "EN DASH". */
  en: string;
  cat: string;
  /** Search words beyond the name. */
  keys: string;
  /** Named HTML entity, without & and ;. */
  entity?: string;
  /** Short label for characters that don't show (spaces, soft hyphen). */
  mark?: string;
  /** "U+2014". */
  code: string;
}

type Row = [ch: string, name: string, keys: string, entity?: string];

const TYPOGRAPHY: Row[] = [
  ["–", "Kort tankstreck", "en dash tankstreck talstreck intervall streck", "ndash"],
  ["—", "Långt tankstreck", "em dash tankstreck pratminus streck", "mdash"],
  ["‑", "Hårt bindestreck", "non-breaking hyphen bindestreck", ""],
  ["‐", "Bindestreck", "hyphen", ""],
  ["…", "Ellips", "ellipsis tre punkter uteslutning", "hellip"],
  ["”", "Citattecken", "svenskt citattecken höger dubbelt right double quotation mark smart quote", "rdquo"],
  ["“", "Vänster citattecken", "engelskt öppnande left double quotation mark smart quote", "ldquo"],
  ["„", "Lågt citattecken", "tyskt citattecken tyska german double low-9 quotation mark", "bdquo"],
  ["’", "Apostrof", "enkelt citattecken höger right single quotation mark apostrophe", "rsquo"],
  ["‘", "Vänster enkelt citattecken", "left single quotation mark", "lsquo"],
  ["‚", "Lågt enkelt citattecken", "tyska german single low-9 quotation mark", "sbquo"],
  ["»", "Gåsögon höger", "guillemet vinkelcitat franska french right angle quotation", "raquo"],
  ["«", "Gåsögon vänster", "guillemet vinkelcitat franska french left angle quotation", "laquo"],
  ["›", "Enkelt gåsöga höger", "single guillemet angle quotation", "rsaquo"],
  ["‹", "Enkelt gåsöga vänster", "single guillemet angle quotation", "lsaquo"],
  ["§", "Paragraf", "section sign paragraftecken lag", "sect"],
  ["¶", "Stycketecken", "pilcrow paragraph mark alinea", "para"],
  ["•", "Punkt", "bullet listpunkt fet punkt", "bull"],
  ["·", "Mittpunkt", "middle dot interpunct halvhög punkt", "middot"],
  ["†", "Kors", "dagger död obelisk fotnot", "dagger"],
  ["‡", "Dubbelkors", "double dagger fotnot", "Dagger"],
  ["′", "Prim", "prime minut fot", "prime"],
  ["″", "Dubbelprim", "double prime sekund tum", "Prime"],
  ["№", "Nummertecken", "numero sign nummer", ""],
  ["&", "Et-tecken", "ampersand och", "amp"],
  ["@", "Snabel-a", "at sign kommersiellt a", ""],
  ["¿", "Inverterat frågetecken", "inverted question mark spanska spanish", "iquest"],
  ["¡", "Inverterat utropstecken", "inverted exclamation mark spanska spanish", "iexcl"],
];

const SPACES: Row[] = [
  [" ", "Hårt mellanslag", "non-breaking space nbsp fast mellanslag", "nbsp"],
  [" ", "Smalt hårt mellanslag", "narrow no-break space nnbsp tusentalsavgränsare franska french", ""],
  [" ", "Smalt mellanslag", "thin space", "thinsp"],
  [" ", "Hårfint mellanslag", "hair space", "hairsp"],
  [" ", "Halv fyrkant", "en space", "ensp"],
  [" ", "Fyrkant", "em space helfyrkant", "emsp"],
  [" ", "Siffermellanslag", "figure space", "numsp"],
  ["­", "Mjukt bindestreck", "soft hyphen shy avstavning", "shy"],
  ["​", "Nollbrett mellanslag", "zero width space zwsp osynligt", ""],
  ["⁠", "Ordsammanfogare", "word joiner wj", ""],
];

/** What an invisible character shows on its tile. */
const MARKS: Record<string, string> = {
  " ": "NBSP",
  " ": "NNBSP",
  " ": "THIN",
  " ": "HAIR",
  " ": "EN",
  " ": "EM",
  " ": "FIG",
  "­": "SHY",
  "​": "ZWSP",
  "⁠": "WJ",
};

// Every fraction Unicode has as one character. Searchable as written: 1/4.
const FRACTIONS: [ch: string, n: number, d: number, name: string, en: string][] = [
  ["½", 1, 2, "En halv", "one half"],
  ["⅓", 1, 3, "En tredjedel", "one third"],
  ["⅔", 2, 3, "Två tredjedelar", "two thirds"],
  ["¼", 1, 4, "En fjärdedel", "one quarter"],
  ["¾", 3, 4, "Tre fjärdedelar", "three quarters"],
  ["⅕", 1, 5, "En femtedel", "one fifth"],
  ["⅖", 2, 5, "Två femtedelar", "two fifths"],
  ["⅗", 3, 5, "Tre femtedelar", "three fifths"],
  ["⅘", 4, 5, "Fyra femtedelar", "four fifths"],
  ["⅙", 1, 6, "En sjättedel", "one sixth"],
  ["⅚", 5, 6, "Fem sjättedelar", "five sixths"],
  ["⅐", 1, 7, "En sjundedel", "one seventh"],
  ["⅛", 1, 8, "En åttondel", "one eighth"],
  ["⅜", 3, 8, "Tre åttondelar", "three eighths"],
  ["⅝", 5, 8, "Fem åttondelar", "five eighths"],
  ["⅞", 7, 8, "Sju åttondelar", "seven eighths"],
  ["⅑", 1, 9, "En niondel", "one ninth"],
  ["⅒", 1, 10, "En tiondel", "one tenth"],
];
/** HTML has named entities for these (&frac14;), not for 1/7, 1/9, 1/10. */
const NAMED_FRACTIONS = new Set(["12", "13", "23", "14", "34", "15", "25", "35", "45", "16", "56", "18", "38", "58", "78"]);

function fractions(): Row[] {
  return FRACTIONS.map(([ch, n, d, name, en]) => [
    ch,
    name,
    `${n}/${d} ${n}⁄${d} ${en} bråk fraction`,
    NAMED_FRACTIONS.has(`${n}${d}`) ? `frac${n}${d}` : "",
  ]);
}

const MATH: Row[] = [
  ["−", "Minus", "minus sign minustecken", "minus"],
  ["±", "Plus-minus", "plus minus ungefär", "plusmn"],
  ["×", "Gånger", "multiplication times multiplikation kryss", "times"],
  ["÷", "Division", "division delat med", "divide"],
  ["⋅", "Multiplikationspunkt", "dot operator gånger", "sdot"],
  ["≈", "Ungefär lika med", "almost equal approximately cirka", "asymp"],
  ["≠", "Inte lika med", "not equal skilt från", "ne"],
  ["≡", "Identiskt lika med", "identical to equivalent", "equiv"],
  ["≤", "Mindre än eller lika med", "less than or equal", "le"],
  ["≥", "Större än eller lika med", "greater than or equal", "ge"],
  ["≪", "Mycket mindre än", "much less than", ""],
  ["≫", "Mycket större än", "much greater than", ""],
  ["∞", "Oändligheten", "infinity oändligt", "infin"],
  ["√", "Kvadratrot", "square root rot", "radic"],
  ["∛", "Kubikrot", "cube root", ""],
  ["∑", "Summa", "summation sigma summatecken", "sum"],
  ["∏", "Produkt", "product pi", "prod"],
  ["∫", "Integral", "integral", "int"],
  ["∂", "Partiell derivata", "partial differential del", "part"],
  ["∆", "Differens", "increment delta förändring", ""],
  ["∇", "Nabla", "nabla del gradient", "nabla"],
  ["∝", "Proportionell mot", "proportional to", "prop"],
  ["∈", "Tillhör", "element of in mängd", "isin"],
  ["∉", "Tillhör inte", "not an element of", "notin"],
  ["⊂", "Delmängd", "subset of", "sub"],
  ["⊆", "Delmängd eller lika", "subset of or equal", "sube"],
  ["∪", "Union", "union mängd", "cup"],
  ["∩", "Snitt", "intersection mängd", "cap"],
  ["∅", "Tomma mängden", "empty set", "empty"],
  ["∀", "För alla", "for all allkvantor", "forall"],
  ["∃", "Det finns", "there exists existenskvantor", "exist"],
  ["¬", "Icke", "not negation logik", "not"],
  ["∧", "Och", "logical and konjunktion", "and"],
  ["∨", "Eller", "logical or disjunktion", "or"],
  ["∴", "Alltså", "therefore", "there4"],
  ["°", "Grader", "degree grad temperatur vinkel celsius fahrenheit gradtecken", "deg"],
  ["‰", "Promille", "per mille per thousand", "permil"],
  ...fractions(),
  ["⁄", "Bråkstreck", "fraction slash", "frasl"],
];

const ARROWS: Row[] = [
  ["→", "Pil höger", "right arrow", "rarr"],
  ["←", "Pil vänster", "left arrow", "larr"],
  ["↑", "Pil upp", "up arrow", "uarr"],
  ["↓", "Pil ned", "down arrow", "darr"],
  ["↔", "Pil höger-vänster", "left right arrow dubbelpil", "harr"],
  ["↕", "Pil upp-ned", "up down arrow", ""],
  ["↗", "Pil snett upp", "north east arrow ökning", "nearr"],
  ["↘", "Pil snett ned", "south east arrow minskning", "searr"],
  ["↩", "Pil tillbaka", "return arrow hook", ""],
  ["⇒", "Implikation", "pil dubbelpil rightwards double arrow implies medför", "rArr"],
  ["⇐", "Dubbelpil vänster", "pil dubbelpil leftwards double arrow", "lArr"],
  ["⇔", "Ekvivalens", "pil dubbelpil left right double arrow iff om och endast om", "hArr"],
  ["▲", "Triangel upp", "up triangle black", ""],
  ["▼", "Triangel ned", "down triangle black", ""],
  ["▶", "Triangel höger", "right triangle play", ""],
  ["◀", "Triangel vänster", "left triangle", ""],
];

const GREEK: Row[] = [
  ["α", "Alfa", "alpha", "alpha"],
  ["β", "Beta", "beta", "beta"],
  ["γ", "Gamma", "gamma", "gamma"],
  ["δ", "Delta", "delta", "delta"],
  ["ε", "Epsilon", "epsilon", "epsilon"],
  ["ζ", "Zeta", "zeta", "zeta"],
  ["η", "Eta", "eta", "eta"],
  ["θ", "Theta", "theta", "theta"],
  ["κ", "Kappa", "kappa", "kappa"],
  ["λ", "Lambda", "lambda våglängd", "lambda"],
  ["μ", "My", "mu grekiskt", "mu"],
  ["µ", "Mikro", "micro sign my mikrometer", "micro"],
  ["ν", "Ny", "nu frekvens", "nu"],
  ["ξ", "Xi", "xi", "xi"],
  ["π", "Pi", "pi", "pi"],
  ["ρ", "Rho", "rho densitet", "rho"],
  ["σ", "Sigma", "sigma standardavvikelse", "sigma"],
  ["τ", "Tau", "tau", "tau"],
  ["φ", "Fi", "phi", "phi"],
  ["χ", "Chi", "chi", "chi"],
  ["ψ", "Psi", "psi", "psi"],
  ["ω", "Omega", "omega", "omega"],
  ["Γ", "Versalt gamma", "capital gamma", "Gamma"],
  ["Δ", "Versalt delta", "capital delta skillnad", "Delta"],
  ["Θ", "Versalt theta", "capital theta", "Theta"],
  ["Λ", "Versalt lambda", "capital lambda", "Lambda"],
  ["Π", "Versalt pi", "capital pi", "Pi"],
  ["Σ", "Versalt sigma", "capital sigma", "Sigma"],
  ["Φ", "Versalt fi", "capital phi", "Phi"],
  ["Ψ", "Versalt psi", "capital psi", "Psi"],
  ["Ω", "Versalt omega", "capital omega", "Omega"],
  ["\u2126", "Ohm", "ohm sign resistans", ""],
];

const CURRENCY: Row[] = [
  ["€", "Euro", "euro valuta", "euro"],
  ["£", "Pund", "pound sterling valuta", "pound"],
  ["$", "Dollar", "dollar valuta", ""],
  ["¢", "Cent", "cent valuta", "cent"],
  ["¥", "Yen", "yen yuan valuta", "yen"],
  ["₹", "Rupie", "indian rupee valuta", ""],
  ["₽", "Rubel", "ruble valuta", ""],
  ["₺", "Lira", "turkish lira valuta", ""],
  ["₩", "Won", "won valuta", ""],
  ["₿", "Bitcoin", "bitcoin kryptovaluta", ""],
  ["¤", "Valutatecken", "currency sign", "curren"],
];

const SYMBOLS: Row[] = [
  ["©", "Copyright", "copyright upphovsrätt", "copy"],
  ["®", "Registrerat varumärke", "registered trademark", "reg"],
  ["™", "Varumärke", "trademark tm", "trade"],
  ["℗", "Fonogram", "sound recording copyright", ""],
  ["℃", "Grader Celsius", "degree celsius temperatur", ""],
  ["℉", "Grader Fahrenheit", "degree fahrenheit temperatur", ""],
  ["✓", "Bock", "check mark checkmark rätt", "check"],
  ["✗", "Kryss", "ballot x fel", "cross"],
  ["★", "Stjärna", "black star betyg", "starf"],
  ["☆", "Tom stjärna", "white star betyg", "star"],
  ["♀", "Kvinna", "female sign venus", "female"],
  ["♂", "Man", "male sign mars", "male"],
  ["⚠", "Varning", "warning sign", ""],
  ["♥", "Hjärta", "heart suit", "hearts"],
  ["☐", "Kryssruta", "ballot box checkbox", ""],
  ["☑", "Ikryssad ruta", "ballot box with check checkbox", ""],
  ["●", "Fylld cirkel", "black circle", ""],
  ["○", "Tom cirkel", "white circle", ""],
  ["■", "Fylld kvadrat", "black square", ""],
  ["□", "Tom kvadrat", "white square", ""],
];

// Superscript and subscript: every digit and sign, and the letters Unicode
// has (not all of them exist, see the Textmanipulator).
const DIGIT_NAMES = ["noll", "ett", "två", "tre", "fyra", "fem", "sex", "sju", "åtta", "nio"];
const EN_DIGITS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const SUB_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const SUP_SIGNS: [string, string, string][] = [
  ["⁺", "plus", "plus"], ["⁻", "minus", "minus"], ["⁼", "lika med", "equals"], ["⁽", "vänsterparentes", "left parenthesis"], ["⁾", "högerparentes", "right parenthesis"],
];
const SUB_SIGNS: [string, string, string][] = [
  ["₊", "plus", "plus"], ["₋", "minus", "minus"], ["₌", "lika med", "equals"], ["₍", "vänsterparentes", "left parenthesis"], ["₎", "högerparentes", "right parenthesis"],
];
const SUP_LETTERS = "ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ";
const SUP_LETTER_BASES = "abcdefghijklmnoprstuvwxyz";
const SUB_LETTERS = "ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ";
const SUB_LETTER_BASES = "aehijklmnoprstuvx";

function scripts(): Row[] {
  const rows: Row[] = [];
  const pairs = (sup: boolean): Row[] => {
    const [digits, signs, letters, bases] = sup
      ? [SUP_DIGITS, SUP_SIGNS, SUP_LETTERS, SUP_LETTER_BASES]
      : [SUB_DIGITS, SUB_SIGNS, SUB_LETTERS, SUB_LETTER_BASES];
    const [sv, en, alt] = sup
      ? ["Upphöjd", "superscript", "upphöjt exponent potens"]
      : ["Nedsänkt", "subscript", "nedsänkt index"];
    const out: Row[] = [];
    [...digits].forEach((ch, i) =>
      out.push([ch, `${sv} ${i}`, `${sv.toLowerCase()} ${DIGIT_NAMES[i]} ${en} ${EN_DIGITS[i]} ${i} ${alt}${sup && i === 2 ? " kvadrat squared" : ""}${sup && i === 3 ? " kubik cubed" : ""}`, sup && i >= 1 && i <= 3 ? `sup${i}` : ""]),
    );
    for (const [ch, name, enName] of signs) out.push([ch, `${sv} ${name}`, `${en} ${enName} ${alt}`, ""]);
    [...letters].forEach((ch, i) => out.push([ch, `${sv} ${bases[i]}`, `${en} ${bases[i]} ${alt} bokstav letter`, ""]));
    return out;
  };
  rows.push(...pairs(true), ...pairs(false));
  return rows;
}

// Letters for Spanish, French and German. Each lower-case row also gets its
// capital. The language words make "franska" list the French letters.
const LANG: Record<string, string> = { es: "spanska spanish", fr: "franska french", de: "tyska german" };
const MARK_NAMES: Record<string, [sv: string, en: string]> = {
  acute: ["akut accent", "acute accent"],
  grave: ["grav accent", "grave accent"],
  circ: ["cirkumflex", "circumflex"],
  uml: ["trema", "diaeresis umlaut"],
  cedil: ["cedilj", "cedilla"],
  tilde: ["tilde", "tilde"],
};
const ACCENTED: [ch: string, mark: string, langs: string][] = [
  ["á", "acute", "es"], ["à", "grave", "fr"], ["â", "circ", "fr"], ["ä", "uml", "de"],
  ["ç", "cedil", "fr"],
  ["é", "acute", "es fr"], ["è", "grave", "fr"], ["ê", "circ", "fr"], ["ë", "uml", "fr"],
  ["í", "acute", "es"], ["î", "circ", "fr"], ["ï", "uml", "fr"],
  ["ñ", "tilde", "es"],
  ["ó", "acute", "es"], ["ô", "circ", "fr"], ["ö", "uml", "de"],
  ["ú", "acute", "es"], ["ù", "grave", "fr"], ["û", "circ", "fr"], ["ü", "uml", "es fr de"],
  ["ÿ", "uml", "fr"],
];
const ENTITY_MARK: Record<string, string> = { acute: "acute", grave: "grave", circ: "circ", uml: "uml", cedil: "cedil", tilde: "tilde" };

function letters(): Row[] {
  const rows: Row[] = [];
  const langs = (l: string) => l.split(" ").map((k) => LANG[k]).join(" ");
  for (const [ch, mark, l] of ACCENTED) {
    const base = ch.normalize("NFD")[0];
    const [sv, en] = MARK_NAMES[mark];
    for (const c of [ch, ch.toUpperCase()]) {
      const b = c === ch ? base : base.toUpperCase();
      rows.push([c, `${b} med ${sv}`, `${b} ${en} ${langs(l)} bokstav letter`, `${b}${ENTITY_MARK[mark]}`]);
    }
  }
  rows.push(
    ["æ", "ae-ligatur", "ae ligature aesc franska french bokstav letter", "aelig"],
    ["Æ", "AE-ligatur", "ae ligature aesc franska french bokstav letter", "AElig"],
    ["œ", "oe-ligatur", "oe ligature franska french bokstav letter", "oelig"],
    ["Œ", "OE-ligatur", "oe ligature franska french bokstav letter", "OElig"],
    ["ß", "Skarpt s", "eszett sharp s ss tyska german bokstav letter", "szlig"],
    ["ẞ", "Versalt skarpt s", "capital eszett sharp s ss tyska german bokstav letter", ""],
    ["ª", "Feminin ordinalindikator", "feminine ordinal indicator primera spanska spanish", "ordf"],
    ["º", "Maskulin ordinalindikator", "masculine ordinal indicator primero numero spanska spanish", "ordm"],
  );
  return rows;
}

export const CATEGORIES: Category[] = [
  { id: "typo", name: "Typografi" },
  { id: "space", name: "Mellanrum" },
  { id: "math", name: "Matematik" },
  { id: "arrow", name: "Pilar och former", short: "Pilar" },
  { id: "greek", name: "Grekiska" },
  { id: "letters", name: "Bokstäver (spanska, franska, tyska)", short: "Bokstäver" },
  { id: "currency", name: "Valuta" },
  { id: "symbol", name: "Symboler" },
  { id: "script", name: "Upphöjt och nedsänkt", short: "Upphöjt/nedsänkt" },
];

const SOURCES: Record<string, Row[]> = {
  typo: TYPOGRAPHY,
  space: SPACES,
  math: MATH,
  arrow: ARROWS,
  greek: GREEK,
  letters: letters(),
  currency: CURRENCY,
  symbol: SYMBOLS,
  script: scripts(),
};

export function codePoint(ch: string): string {
  return "U+" + ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0");
}

function unicodeName(ch: string): string {
  return UNICODE_NAMES[codePoint(ch).slice(2)] ?? "";
}

export const CHARS: Char[] = CATEGORIES.flatMap(({ id }) =>
  SOURCES[id].map(([ch, name, keys, entity]) => ({
    ch,
    name,
    en: unicodeName(ch),
    cat: id,
    keys,
    entity: entity || undefined,
    mark: MARKS[ch],
    code: codePoint(ch),
  })),
);

// Characters that look alike and get mixed up. Each group lists them in the
// order they're shown under "Förväxlas med".
const LOOKALIKES: string[][] = [
  ["-", "‐", "‑", "–", "—", "−"],
  ["”", "“", "„", '"', "″"],
  ["’", "‘", "'", "′"],
  ["»", "›", ">"],
  ["«", "‹", "<"],
  ["·", "⋅", "•"],
  ["µ", "μ"],
  ["\u2126", "Ω"],
  ["∆", "Δ"],
  ["∑", "Σ"],
  ["∏", "Π"],
  ["×", "x", "✗"],
  ["°", "º", "⁰"],
  ["⁄", "/"],
  [" ", " ", " ", " "],
];

const LIKE = new Map<string, string[]>();
for (const group of LOOKALIKES) for (const ch of group) LIKE.set(ch, group.filter((c) => c !== ch));

/** Every character the page can show: the catalogue and the lookalikes.
 * What scripts/gen-char-names.py names. */
export function allGlyphs(): string[] {
  return [...new Set([...CHARS.map((c) => c.ch), ...LOOKALIKES.flat()])];
}

/** The characters `ch` is easily mistaken for. */
export function lookalikes(ch: string): string[] {
  return LIKE.get(ch) ?? [];
}

/** A lookalike's entry, or a bare one for keyboard characters (-, ", x). */
export function describe(ch: string): Char {
  return (
    CHARS.find((c) => c.ch === ch) ?? {
      ch,
      name: KEYBOARD[ch] ?? "Tecken",
      en: unicodeName(ch),
      cat: "",
      keys: "",
      mark: ch === " " ? "SP" : undefined,
      code: codePoint(ch),
    }
  );
}

const KEYBOARD: Record<string, string> = {
  "-": "Bindestreck-minus (tangentbordet)",
  '"': "Rakt citattecken (tangentbordet)",
  "'": "Rak apostrof (tangentbordet)",
  ">": "Större än",
  "<": "Mindre än",
  x: "Bokstaven x",
  "/": "Snedstreck",
  " ": "Vanligt mellanslag",
};
