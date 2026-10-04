# Specialtecken (`chars.html`)

All strings are in `src/tools/chars/CharsApp.tsx` unless a pointer names
another file. The sidebar and header come from the shell (`shell.md`).

## Page title and start page

- **Specialtecken**
  The tool's name: browser tab, sidebar, start page card. `src/tools/registry.ts` · chars → `name`, and `chars.html` → `<title>`
- **Sök och kopiera tecken som tangentbordet saknar**
  Tagline on the start page. `src/tools/registry.ts` · chars → `tagline`
- **Sök bland typografiska, matematiska och andra specialtecken på svenska eller engelska. Kopiera tecknet eller dess HTML-entitet.**
  Description on the start page's tool card. `src/tools/registry.ts` · chars → `desc`

## Search

- **Sök tecken...**
  Placeholder in the search field. `<Input id="char-search">` → `placeholder`
- **Sök tecken** 🧪
  Screen-reader label for the search field. `<label htmlFor="char-search">`
- **Töm sökningen**
  aria-label of the × button, shown in the field once something is typed. `<Button aria-label>` next to the input

## Category chips

- **Kategori**
  Screen-reader name of the chip row. `role="group"` → `aria-label`
- **Alla**
  First chip, all categories. `[{ id: ALL, name: "Alla" }, …]`

The rest are in `src/tools/chars/data.ts` · `CATEGORIES`. A chip shows the
short name when there is one; the long name is used as the section heading
and on the "Kategori" line in the details panel.

- **Typografi**
- **Mellanrum**
- **Matematik**
- **Pilar och former** (chip: **Pilar**)
- **Grekiska**
- **Bokstäver (spanska, franska, tyska)** (chip: **Bokstäver**)
- **Valuta**
- **Symboler**
- **Upphöjt och nedsänkt** (chip: **Upphöjt/nedsänkt**)

## Grid section headings

- **Senast kopierade** 🧪
  First section, only with no search and "Alla" selected. `sectionsFor` → `"recent"` title
- **i den här fliken**
  Dimmed text after "Senast kopierade". `<h2>` → `s.id === "recent"` span
- **Tecken du kopierar hamnar här.**
  In the "Senast kopierade" row before anything has been copied in this tab. Placeholder row in the sections map
- **1 träff** / **{n} träffar**
  Heading over the results while searching; `{n}` is the number of hits. `sectionsFor` → `"hits"` title
- The category names above head their sections when not searching.

## Empty search

Shown when a search matches nothing.

- **Inga tecken matchar ”{query}”.** 🧪
  `{query}` is what was typed. First `<p>` in the `flat.length === 0` block
- **Sök på svenska eller engelska, på HTML-entitet (mdash) eller på kodpunkt (U+2192).**
  Second `<p>` in the same block

## Tiles

- A tile's screen-reader name is the character's Swedish name 🧪 (e.g.
  **Långt tankstreck**). Characters with no visible glyph (spaces, soft
  hyphen) show a dashed box with a short code instead: **NBSP**, **NNBSP**,
  **THIN**, **HAIR**, **EN**, **EM**, **FIG**, **SHY**, **ZWSP**, **WJ**.
  `data.ts` · `MARKS`
- The character names themselves (about 200) are catalogue data in
  `data.ts`, not reviewed here.
  > Say if you want them in a file of their own.

## Details panel (wide screens)

The panel to the right of the grid, showing the hovered or selected character.

- **Valt tecken**
  Screen-reader name of the panel. `Details` → `<section aria-label>`
- Heading: the character's Swedish name, with its English Unicode name
  under it in sentence case (generated, not written by hand).
- **Kategori**
  Label in the facts list. `Details` → first `<dt>`
- **Kodpunkt**
  Label in the facts list. `Details` → second `<dt>`
- **HTML**
  Label in the facts list. `Details` → third `<dt>`
- **Kopiera tecken**
  Main button. `Details` → first `CopyButton label`
- **HTML** 🧪
  Second button, copies the HTML entity. `Details` → second `CopyButton label`
- **Kopierat!**
  Replaces the label of the button just used, for 1.4 s. `CopyButton` → `done`
- **Förväxlas lätt med**
  Heading over lookalike characters, when the character has any. `Details` → `<h3>`
  > A comment in `data.ts` quotes this as "Förväxlas med"; updated with whatever this becomes.
- Lookalike buttons: screen-reader name **{name}, {code}**, tooltip
  **{name} · {code}** (e.g. "Kort tankstreck · U+2013"). `Details` → `like.map` button

## Hint under the panel (wide screens)

- **Klick kopierar. Enter i sökfältet kopierar första träffen, pilarna flyttar i rutnätet.**
  "Enter" is set as a key. `<aside>` → `<p>` after `<Details>`

## Bottom bar (narrow screens)

Replaces the panel below the `lg` breakpoint.

- **Valt tecken**
  Screen-reader name of the bar. `DetailsBar` → `<section aria-label>`
- Shows the name and **{code} · {html}** (e.g. "U+2014 · &mdash;").
- **Kopiera**
  The bar's button (shorter than the panel's "Kopiera tecken"). `DetailsBar` → `CopyButton label`
- **Kopierat!**
  As in the panel.

## Screen-reader status

Read aloud after a copy; not visible. `<p role="status">`, set in `copy`.

- **Kopierat: {name}** 🧪
  After copying the character.
- **Kopierat: {name} som HTML**
  After copying the HTML entity.
- **Kunde inte kopiera. Tecknet är markerat, tryck Ctrl+C.**
  When the clipboard refuses; the character in the panel is selected so it can be copied by hand.
