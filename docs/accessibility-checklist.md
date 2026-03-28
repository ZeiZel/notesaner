# WCAG 2.1 AA Accessibility Checklist — Notesaner

Manual testing checklist for WCAG 2.1 Level AA compliance.
Use alongside the automated test suite in `apps/web/src/__tests__/accessibility/`.

---

## How to Use This Checklist

- Test each item on **all key pages**: Login, Register, Workspace, Editor, Settings.
- Mark items as **Pass**, **Fail**, or **N/A**.
- Record failures with the affected page, element description, and WCAG success criterion.
- Retest after fixes are applied.

---

## 1. Perceivable

### 1.1 Text Alternatives (SC 1.1.1)

- [ ] All `<img>` elements have `alt` attributes
- [ ] Decorative images use `alt=""` or `aria-hidden="true"`
- [ ] Complex images (diagrams, charts) have long descriptions
- [ ] SVG icons inside buttons/links have `aria-hidden="true"` when the parent has text
- [ ] Standalone meaningful SVGs have `role="img"` and `aria-label`
- [ ] Icon fonts (if any) have screen-reader-accessible text alternatives
- [ ] CSS background images that convey meaning have text alternatives

### 1.2 Time-Based Media (SC 1.2.1 - 1.2.5)

- [ ] Pre-recorded video has captions (`<track kind="captions">`)
- [ ] Pre-recorded audio has a text transcript
- [ ] Pre-recorded video has audio description (or media alternative)
- [ ] Live video (e.g., collaboration cursors) has captions if applicable
- [ ] Media player controls are keyboard accessible

### 1.3 Adaptable (SC 1.3.1 - 1.3.5)

- [ ] Page uses semantic HTML (`<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`)
- [ ] Headings follow a logical hierarchy (h1 > h2 > h3, no skipped levels)
- [ ] Each page has exactly one `<h1>`
- [ ] Lists use `<ul>`, `<ol>`, or `<dl>` elements (not styled `<div>` sequences)
- [ ] Tables have `<th>` elements with `scope` attribute
- [ ] Form inputs have programmatic labels (`<label for>`, `aria-label`, `aria-labelledby`)
- [ ] Content meaning does not depend on sensory characteristics alone (shape, color, position)
- [ ] Content adapts to different orientations (portrait/landscape)
- [ ] Identity input fields have appropriate `autocomplete` values (`email`, `password`, `name`)

### 1.4 Distinguishable (SC 1.4.1 - 1.4.13)

- [ ] Color is not the sole means of conveying information (errors, required fields)
- [ ] Text has a contrast ratio of at least **4.5:1** (normal text) or **3:1** (large text)
- [ ] Non-text UI components (borders, icons) have a contrast ratio of at least **3:1**
- [ ] Text can be resized to 200% without loss of content or functionality
- [ ] No images of text (use real text instead)
- [ ] Content reflows at 320px viewport width (no horizontal scrolling)
- [ ] Custom text spacing can be applied without breaking layout
- [ ] Content on hover/focus is dismissable, hoverable, and persistent
- [ ] Focus indicators have at least **3:1** contrast ratio

---

## 2. Operable

### 2.1 Keyboard Accessible (SC 2.1.1 - 2.1.4)

- [ ] All functionality is available via keyboard only
- [ ] No keyboard traps (user can always Tab/Escape away)
- [ ] **Login page**: Tab through email, password, submit, SSO, register link
- [ ] **Register page**: Tab through name, email, password, submit
- [ ] **Editor**: Keyboard shortcuts work (Cmd+P, Cmd+S, Cmd+,)
- [ ] **Settings dialog**: Tab through nav items, content area, close button
- [ ] **Command palette**: Arrow keys navigate, Enter selects, Escape closes
- [ ] **File explorer**: Arrow keys navigate tree, Enter opens item
- [ ] **Modals/Dialogs**: Focus trapped inside, Escape closes, focus returns to trigger
- [ ] Character key shortcuts (single keys) do not accidentally trigger actions

### 2.2 Enough Time (SC 2.2.1 - 2.2.2)

- [ ] Session timeouts (if any) allow extension or warning
- [ ] Auto-save does not interrupt user workflow
- [ ] Animations can be paused, stopped, or hidden
- [ ] No content auto-updates that cannot be paused (unless essential)

### 2.3 Seizures and Physical Reactions (SC 2.3.1)

- [ ] No content flashes more than 3 times per second
- [ ] Theme transitions do not cause rapid flashing

### 2.4 Navigable (SC 2.4.1 - 2.4.10)

- [ ] **Skip navigation link** is present and functional on every page
- [ ] Each page has a descriptive `<title>`
- [ ] Focus order is logical and meaningful (matches visual layout)
- [ ] Link text is descriptive (not "click here" or "read more")
- [ ] Multiple navigation mechanisms are available (sidebar, command palette, breadcrumbs)
- [ ] Headings and labels are descriptive
- [ ] **Focus visible**: All interactive elements show a visible focus indicator
- [ ] Section headings are used to organize content

### 2.5 Input Modalities (SC 2.5.1 - 2.5.4)

- [ ] Complex gestures (drag-and-drop) have single-pointer alternatives
- [ ] Pointer events can be cancelled (mousedown does not trigger action — use click)
- [ ] Visible labels match accessible names (what you see is what screen reader says)
- [ ] Motion-triggered actions have alternative controls

---

## 3. Understandable

### 3.1 Readable (SC 3.1.1 - 3.1.2)

- [ ] `<html>` element has `lang` attribute set to correct language (`en`)
- [ ] Content in other languages is marked with `lang` attribute on the container

### 3.2 Predictable (SC 3.2.1 - 3.2.4)

- [ ] Focus does not cause unexpected context changes
- [ ] Input does not cause unexpected context changes
- [ ] Navigation is consistent across pages
- [ ] Components are identified consistently (same icon + label everywhere)

### 3.3 Input Assistance (SC 3.3.1 - 3.3.4)

- [ ] **Error identification**: Error messages are displayed in text (not just color)
- [ ] **Labels or instructions**: All form fields have labels or instructions
- [ ] **Error suggestion**: Error messages suggest how to fix the issue
- [ ] **Error prevention**: Destructive actions (delete workspace, remove member) require confirmation
- [ ] Error messages use `role="alert"` for screen reader announcement
- [ ] Invalid fields use `aria-invalid="true"`
- [ ] Error messages are associated with inputs via `aria-describedby`
- [ ] Required fields are programmatically indicated (`required` or `aria-required`)

---

## 4. Robust

### 4.1 Compatible (SC 4.1.1 - 4.1.3)

- [ ] HTML is valid (no duplicate IDs, proper nesting)
- [ ] All interactive elements have accessible names
- [ ] ARIA roles are used correctly (not conflicting with native semantics)
- [ ] Custom components follow WAI-ARIA authoring practices
- [ ] Status messages use `role="status"` or `aria-live="polite"`
- [ ] Alert messages use `role="alert"` or `aria-live="assertive"`

---

## Page-Specific Checks

### Login Page (`/login`)

- [ ] h1: "Sign in"
- [ ] Email input: `label[for="email"]`, `autocomplete="email"`, `required`
- [ ] Password input: `label[for="password"]`, `autocomplete="current-password"`, `required`
- [ ] "Forgot password?" link is keyboard accessible
- [ ] Submit button text changes to "Signing in..." during submission
- [ ] Error messages appear with `role="alert"`
- [ ] SSO button is keyboard accessible
- [ ] "Create account" link is keyboard accessible

### Register Page (`/register`)

- [ ] h1 exists for the page
- [ ] Name input: `label[for="displayName"]`, `autocomplete="name"`, `required`
- [ ] Email input: `label[for="email"]`, `autocomplete="email"`, `required`
- [ ] Password input: `label[for="password"]`, `autocomplete="new-password"`, `required`
- [ ] Submit button text changes during submission
- [ ] Success message is announced to screen readers
- [ ] Error messages appear with `role="alert"`

### Workspace Page

- [ ] Skip navigation link targets `#main-content`
- [ ] Left sidebar is togglable via keyboard
- [ ] Right sidebar is togglable via keyboard (aria-pressed state)
- [ ] File explorer tree is navigable with arrow keys
- [ ] Status bar content is accessible
- [ ] Mobile bottom navigation tabs are keyboard accessible

### Editor Page

- [ ] Editor area is focusable and keyboard operable
- [ ] Editor mode toggle is keyboard accessible
- [ ] Frontmatter properties panel is accessible
- [ ] Toolbar buttons have aria-labels
- [ ] Formatting commands (bold, italic, etc.) work via keyboard shortcuts

### Settings Dialog

- [ ] Dialog has `aria-label="Settings"`
- [ ] Focus is trapped inside the dialog
- [ ] Escape closes the dialog
- [ ] Focus returns to the trigger element on close
- [ ] Navigation tabs use `role="tab"` and `aria-selected`
- [ ] Content area uses `role="tabpanel"`
- [ ] Tab navigation is keyboard accessible

### Settings Pages (Workspace Settings)

- [ ] Breadcrumb navigation uses `aria-label="Breadcrumb"`
- [ ] Active tab uses `aria-current="page"`
- [ ] Settings sidebar navigation is keyboard accessible
- [ ] Save indicator uses `role="alert"` for error states

### Command Palette

- [ ] Opens/closes with keyboard shortcut (Cmd+P)
- [ ] Search input is focused on open
- [ ] Arrow keys navigate command list
- [ ] Enter activates selected command
- [ ] Escape closes the palette
- [ ] Keyboard shortcuts are displayed as `<kbd>` elements

---

## Assistive Technology Testing

### Screen Readers

Test with at least one of the following:

- [ ] **VoiceOver** (macOS/iOS) — Safari/Chrome
- [ ] **NVDA** (Windows) — Firefox/Chrome
- [ ] **JAWS** (Windows) — Chrome/Edge
- [ ] **TalkBack** (Android) — Chrome

### Screen Reader Testing Steps

1. Navigate to each page using only keyboard (Tab, Arrow keys, Enter, Escape)
2. Verify all content is announced correctly
3. Verify form labels are read when fields receive focus
4. Verify error messages are announced when they appear
5. Verify heading hierarchy is correct (use screen reader heading navigation)
6. Verify landmark navigation works (screen reader landmark shortcut)
7. Verify dynamic content updates are announced (live regions)

### Zoom / Magnification

- [ ] Content is usable at **200% zoom**
- [ ] Content is usable at **400% zoom** (reflow, no horizontal scroll)
- [ ] Text remains readable and does not overlap
- [ ] Interactive elements remain clickable/tappable

### High Contrast Mode

- [ ] Windows High Contrast mode: content is visible and usable
- [ ] macOS Increase Contrast: content is visible and usable
- [ ] Custom high-contrast theme (if available): text and borders are clear

---

## Automated Testing Reference

Run the automated accessibility test suite:

```bash
# Full a11y test suite
pnpm exec playwright test --config apps/web/playwright/a11y.config.ts

# Specific test file
pnpm exec playwright test --config apps/web/playwright/a11y.config.ts keyboard-navigation

# With verbose output
pnpm exec playwright test --config apps/web/playwright/a11y.config.ts --reporter=list
```

Test files location: `apps/web/src/__tests__/accessibility/`

| File                          | Covers                                 |
| ----------------------------- | -------------------------------------- |
| `axe-setup.ts`                | axe-core integration, helper functions |
| `keyboard-navigation.test.ts` | SC 2.1.1, 2.1.2, 2.4.1, 2.4.3, 2.4.7   |
| `screen-reader.test.ts`       | SC 1.3.1, 2.4.2, 2.4.6, 4.1.2, 4.1.3   |
| `color-contrast.test.ts`      | SC 1.4.1, 1.4.3, 1.4.11                |
| `forms.test.ts`               | SC 1.3.5, 3.3.1, 3.3.2, 3.3.3, 3.3.4   |
| `media.test.ts`               | SC 1.1.1, 1.2.2, 1.4.5, 2.3.1          |

---

## Revision History

| Date       | Version | Changes                   |
| ---------- | ------- | ------------------------- |
| 2026-03-28 | 1.0     | Initial checklist created |
