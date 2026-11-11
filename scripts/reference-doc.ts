/**
 * Documents the verify script opens.
 *
 * The reference document exercises everything the extension themes (see the
 * fix-docs-breakage skill for its contents). It is private, so it opens only in
 * a browser profile signed in with `pnpm run sign-in`. Leave it `undefined`
 * until it exists; verify then falls back to the public document, which needs
 * no sign-in but shows Docs read-only, without the editing toolbar, comments or
 * suggestions.
 */
export const referenceDocUrl: string | undefined = undefined;

/** A public, view-only document with headings, coloured text, links and a table. */
export const publicDocUrl =
  "https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit";
