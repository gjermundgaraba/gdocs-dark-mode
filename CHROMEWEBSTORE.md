# Chrome Web Store listing: Dark Mode for Google Docs

> Last updated: 2026-11-17

Everything the developer dashboard asks for, ready to paste.

## Store listing tab

**Name** (from the manifest): Dark Mode for Google Docs

**Summary** (from the manifest's `description`, 132 characters at most):

```
A dark theme for Google Docs, including the document page, in your choice of colours.
```

**Description** (the store shows plain text, so paste it as is):

```
Dark Mode for Google Docs turns the whole of Google Docs dark: not just the toolbars and menus, but the document page itself, so you can write at night without a white page glaring at you.

FEATURES
• The document page goes dark. White paper becomes a dark background and black text becomes light text, while grey text keeps its contrast.
• Coloured text and highlights stay recognisable. Coloured text takes the closest of eight readable accent hues, and highlights become soft tints.
• Images are left exactly as they are.
• Toolbars, menus and dialogs match the page.
• Pick your own colours. The options page lets you set the background, text and eight accent hues, warns you when a combination is hard to read, and will not save colours that cannot make a readable dark theme.
• Share your colours. Export them to a file and import them on another computer.
• One click to switch. Click the toolbar icon to turn dark mode on or off; open documents reload with the change.

HOW TO USE
1. Pin the extension so its icon shows in the toolbar.
2. Open any Google Docs document. It opens dark.
3. Click the icon to switch dark mode off or back on.
4. To change the colours, right-click the icon and choose Options.

The default theme uses neutral dark greys with soft pastel accents.

PRIVACY
The extension collects nothing and sends nothing anywhere. Your settings and colours stay in your browser. It does not collect, keep or send the content of your documents.

PERMISSIONS
• "Read and change your data on docs.google.com": needed to recolour Google Docs documents. The extension runs only on Google Docs documents (docs.google.com/document), never on other sites.

Works with Google Docs documents. Sheets, Slides and other Google apps are not themed.

Not affiliated with or endorsed by Google. Google Docs is a trademark of Google LLC.
```

**Category:** Make Chrome Yours › Functionality & UI, or Accessibility, whichever the dashboard's list has; these names are from memory, not from Google's docs.

**Language:** English

## Graphics

Generate with `pnpm run store-assets [--url <doc>]`, which writes them to `store/`. By default it uses the demo document, [Dark Mode for Google Docs: demo](https://docs.google.com/document/d/1Y7nUlMTG2nWeZAmgZqrahTr7PNAtlJQ0wutPbc6p7Xk/edit), owned by the publisher's account and viewable by anyone with the link. Its photo is by Ionutzmovie, CC BY 3.0, via Wikimedia Commons, credited in the document.

| Asset | Size | File | Status |
| --- | --- | --- | --- |
| Store icon | 128×128 PNG | `src/extension/icons/on-128.png` | Ready |
| Screenshot 1: light and dark side by side | 1280×800 | `store/screenshot-1-before-after.jpg` | Ready |
| Screenshot 2: default theme | 1280×800 | `store/screenshot-2-default.jpg` | Ready |
| Screenshot 3: custom warm colours | 1280×800 | `store/screenshot-3-custom-colours.jpg` | Ready |
| Screenshot 4: options page | 1280×800 | `store/screenshot-4-options.jpg` | Ready |
| Small promo tile | 440×280 | `store/promo-small-440x280.jpg` | Ready; Google advises little text on promo images, since they are not translated |
| Marquee promo tile | 1400×560 | none | Optional; only used if the store features the extension |

The screenshots show the document signed out, so "Sign in" and "Request edit access" appear in the corner. That is accurate, but screenshots taken signed in, in your own Chrome, would look more like everyday use.

## Privacy practices tab

**Single purpose:**

```
Applies a dark colour theme, in default or user-chosen colours, to Google Docs documents and the Docs interface around them.
```

**Permission justifications:**

| Permission | Justification to paste |
| --- | --- |
| `scripting` | While dark mode is on, the extension registers the scripts that recolour Google Docs documents, and unregisters them when the user switches dark mode off. When the user changes their colours, it writes the new colours into open Docs tabs before reloading them, so they open in the new colours. |
| `storage` | Saves the user's two settings: whether dark mode is on, and the colours they chose on the options page. Nothing else is stored, and nothing leaves the device. |
| Host permission `https://docs.google.com/document/*` | Docs draws the document page itself rather than styling it with page CSS, so the extension must run in Google Docs document pages to recolour what Docs draws and to theme its toolbars and menus. It is limited to Docs documents and runs on no other site. |

**Are you using remote code?** No, I am not using remote code. Every script is in the package.

**Data usage:** tick none of the categories. The extension collects no personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity or website content. Then tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/gjermundgaraba/gdocs-dark-mode/blob/main/PRIVACY.md

The link only works for reviewers once the repository is public. The store requires a policy only when an item handles user data, which this one does not, but a policy that says so heads off reviewer questions.

## Distribution

- **Visibility:** Public, or Unlisted for a quiet first release.
- **Regions:** All regions.
- **Pricing:** Free.

## Account

- **Publisher name:** Gjermund Garaba
- **Contact email:** bjaanes@gmail.com (verified in the dashboard; Google sends policy notices here)
- **Support URL:** https://github.com/gjermundgaraba/gdocs-dark-mode/issues once the repository is public, or leave it empty and rely on the contact email
- **Homepage URL:** optional

## Before each upload

1. Bump `version` in `package.json`; the store rejects a version that is not higher than the last.
2. `pnpm run ready`, `pnpm run verify` and `pnpm run verify-options` all pass.
3. Load `dist/` unpacked in your everyday Chrome, signed in, and edit a document of your own: type, select text, use the menus and a dialog, and switch dark mode off and on.
4. If the UI or the default palette changed, rerun `pnpm run store-assets`.
5. If permissions or stored data changed, update the justifications above and `PRIVACY.md`.
6. `pnpm run package` and upload `gdocs-dark-mode-<version>.zip`.

## Version history

| Version | Date | Changes | Status |
| --- | --- | --- | --- |
| 0.1.0 | 2026-11-17 | First release: dark document page and interface, custom colours, import and export. | Draft |

## Review notes

Things a reviewer may ask about:

- **Why `scripting` and not a declared content script?** So that switching dark mode off removes the scripts entirely instead of leaving them running idle in every Docs tab.
- **Why one of the scripts runs in the page's own context:** it has to change how Docs draws, before Docs draws its first page. It holds only colour values and sends nothing.
- **The name:** "for Google Docs" names the product the extension works with; the description states it is not affiliated with Google.
