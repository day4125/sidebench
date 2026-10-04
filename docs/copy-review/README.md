# Copy review

Temporary. One file per page, listing every string the page can show.
See "Copy review" in `docs/TODO.md` for why.

## How it works

1. Claude writes a page's file from the source and commits it untouched.
2. You rewrite strings in place. Don't add an "old/new" column: `git diff`
   shows what changed.
3. Claude maps each changed line back into the source, using the pointer
   under it, and runs the tests.

A decision that holds for every page (du or no address, ellipsis,
"Kopiera" vs "Kopiera text") goes in `_style.md`, not just one page's
file, so it gets applied everywhere.

## Format

- **The string as it shows**
  What it is and when it shows. `file` · component → prop
  🧪 = an e2e test looks it up by this text

`{n}`, `{name}` and the like are placeholders filled in at runtime. Keep
them in your rewrite, or say what should go there instead. A comment for
Claude can go on its own line starting with `>`.

## Mapping back (Claude)

- Strings marked 🧪 are e2e locators. Change the test in the same commit,
  and run the whole suite (`npm test` and the e2e run), not just that
  page's spec: shared strings show up in other specs too.
- Pointers aren't line numbers. Find the string by its old text (from the
  diff) in the named file and component. If it isn't unique there, the
  description says which one.
- Comments in the source that quote an old string get updated as well.

## Pages

- [x] `chars.md` Specialtecken (pilot)
- [ ] `shell.md` sidebar, header and other strings shared by every page
- [ ] `index.md` start page
- [ ] `text.md` Textmanipulator
- [ ] `diff.md` Diff checker
- [ ] `color.md` Färgväljare
- [ ] `svg.md` SVG-viewer
- [ ] `pdfview.md` PDF sida vid sida
- [ ] `deworder.md` html-deworder
