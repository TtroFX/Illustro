# Illustro deployment operations

Canonical product/design requirements remain in `ILLUSTRO_DESIGN_MEMO.md`. This file records the operational deployment targets used by implementation and verification.

- Provider: Vercel
- Project: `illustro`
- Repository: `TtroFX/Illustro`
- Production branch: `main`
- Production behavior: pushes to `main` automatically create/update the Production deployment.
- Stable Preview branch: `preview`
- Stable Preview URL: `https://illustro-git-preview-ibukioike2009-7645s-projects.vercel.app`
- Preview diagnostics: `https://illustro-git-preview-ibukioike2009-7645s-projects.vercel.app/diagnostics/`

The Preview URL follows Vercel's persistent Git Branch URL contract. Commit-specific Preview URLs remain valid for immutable point-in-time verification.
