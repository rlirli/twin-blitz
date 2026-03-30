# Twin Blitz ⚡️

Personalize and print your own **pattern-matching card game**. Any two cards share exactly one matching symbol.

This generator uses finite projective planes ($p = 7$) to produce a full **57-card deck** from **57 unique symbols**.


## ✨ Key Features

- **Fully Customizable:** Swap default symbols with your photos or graphics.
- **Print-Ready Output:** 57-page PDF with one **84mm** card per page, scaled for either **9x13cm**, **10x15cm** or **13x18cm** photo paper.
- **Local & Private:** Everything runs in your browser. No uploads, no servers.
- **Progress Persisted:** Uploaded symbols are saved to `localStorage` and automatically restored on revisit. Compressed to 300×300 px JPEG client-side to stay well within the 5 MB browser storage limit.


## 🚀 Quick Start

### 1. Install dependencies
```bash
bun install
```

### 2. Start the development server
```bash
bun dev
```

### 3. Design your deck
Visit [http://localhost:3000](http://localhost:3000) to personalize your deck, then print the PDF.


## 🛠️ Tech Stack

- **Core:** Next.js (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, Framer Motion
- **State:** Zustand
- **Tooling:** Oxc (oxlint/oxfmt)
- **Runtime:** Bun


## ⚠️ Known Limitations

- **localStorage only:** Progress survives refresh but is tied to the device & browser. Data is cleared on "Clear All" or browser storage wipe.
- **PDF-only export:** Most print labs need image files; convert the PDF first.
- **Hardcoded to p=7:** Cannot generate other deck sizes aside from 57 cards (yet).


## 🎯 Roadmap

- [x] feat: Export as .zip of image files
- [ ] fix: "Load defaults" should not replace already filled slots
- [ ] feat: Other deck sizes (p=3, p=5, etc.)
- [ ] feat: Additional default symbol sets
- [ ] feat: Alternative print modes (4 cards per A4 page, etc.)
- [ ] feat: Persistent database storage (+ Auth first)
- [ ] feat: Sharable links to drafts for collaborative design