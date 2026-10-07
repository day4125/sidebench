# Specialtecken (`chars.html`)

All strings are in `src/tools/chars/CharsApp.tsx` unless a pointer names
another file. The sidebar and header come from the shell (`shell.md`).

## Page title and start page

- **Specialtecken**
  The tool's name: browser tab, sidebar, start page card. `src/tools/registry.ts` · chars → `name`, and `chars.html` → `<title>`
- **Sök och kopiera tecken som tangentbordet saknar**
  Tagline on the start page. `src/tools/registry.ts` · chars → `tagline`
- **Sök bland typografiska, matematiska och andra specialtecken på svenska eller engelska. Se kodpunkt och HTML-entitet och kopiera tecknet.**
  Description on the start page's tool card. `src/tools/registry.ts` · chars → `desc`

## Search

- **Sök tecken...**
  Placeholder in the search field. `<Input id="char-search">` → `placeholder`
- **Sök tecken** 🧪
  Screen-reader label for the search field. `<label htmlFor="char-search">`
- **Töm sökningen**
  aria-label of the × button, shown in the field once something is typed. `<Button aria-label>` next to the input

## Category menu

A button beside the search opens the list of categories. `CategoryMenu`

- **Alla**
  The button's label with no category chosen, and the first item in the
  list. `[{ id: ALL, name: "Alla" }, …]`
- **Kategori: {name}**
  Screen-reader name of the button, with the chosen category's full name.
  `CategoryMenu` → `aria-label`
- **Kategori**
  Screen-reader name of the list. `role="group"` → `aria-label`

The rest are in `src/tools/chars/data.ts` · `CATEGORIES`. The button, the
list and the band's "Kategori" show the short name when there is one; the
long name heads the section in the grid and is the list item's tooltip.

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

## Details band (wide screens)

The band over the search, showing the chosen character. `DetailsBand`

- **Valt tecken**
  Screen-reader name of the band. `<section aria-label>`
- Heading: the character's Swedish name, with its English Unicode name
  under it in sentence case (generated, not written by hand).
- **Kopiera tecken** 🧪
  The copy button, beside the heading. `CopyButton label`
- **Kopierat!** 🧪
  Replaces the button's label for 1.4 s. `CopyButton` → `done`
- **Kodpunkt**, **HTML**, **Kategori**
  Labels of the facts row under the heading. `<dt>`s
- **Förväxlas lätt med**
  Label before the lookalike characters, when the character has any. `Lookalikes` → `<h3>`
  > A comment in `data.ts` quotes this as "Förväxlas med"; updated with whatever this becomes.
- Lookalike buttons: screen-reader name **{name}, {code}**, tooltip
  **{name} · {code}** (e.g. "Kort tankstreck · U+2013"). A click chooses
  the character. `Lookalikes` → `like.map` button

## Bottom bar (narrow screens)

Replaces the band below the `lg` breakpoint.

- **Valt tecken**
  Screen-reader name of the bar. `DetailsBar` → `<section aria-label>`
- Shows the name and **{code} · {html}** (e.g. "U+2014 · &mdash;").
- **Kopiera**
  The bar's button (shorter than the band's "Kopiera tecken"). `DetailsBar` → `CopyButton label`
- **Kopierat!**
  As in the band.

## Screen-reader status

Read aloud after a copy; not visible. `<p role="status">`, set in `copy`.

- **Kopierat: {name}** 🧪
  After copying the character.
- **Kunde inte kopiera. Tecknet är markerat, tryck Ctrl+C.**
  When the clipboard refuses; the character in the band is selected so it can be copied by hand.
