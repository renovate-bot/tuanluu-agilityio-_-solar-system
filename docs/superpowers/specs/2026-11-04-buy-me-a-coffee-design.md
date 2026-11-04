# Buy Me a Coffee CTA Design

## Intent

Add a support link to the existing “Thông tin” (credits) dialog, directing visitors to the supplied MoMo contribution page.

## Goals

- Add a distinct “Buy me a coffee” call to action below the existing credits and above the close button.
- Point it to `https://me.momo.vn/bbk9x`.
- Keep the English CTA label, “Buy me a coffee”, in both locale tables through the existing localization system.
- Open the external destination in a new tab with `rel="noopener noreferrer"`.

## Non-goals

- Embed payment, QR, or donation processing in the app.
- Change the existing credits, modal behavior, or other controls.

## Constraints

- Every user-visible string uses `t()` and is present in both `vi` and `en`.
- Preserve the existing DOM-based credits modal and its accessible external-link conventions.
- The CTA must be a semantic link, not a button that performs navigation.

## Approaches

- **Distinct CTA below the credits (selected):** separates visitor support from attribution and is easy to identify.
- **Fourth credits-list item:** minimal layout change, but visually conflates support with required attribution.

Use the distinct CTA. Keep the label “Buy me a coffee” in both English and Vietnamese UI. Keep the visual treatment consistent with the existing modal controls.

## What's left to the builder

Choose the smallest styling change that makes the link recognizable as a CTA while fitting the existing dialog on mobile and desktop.
