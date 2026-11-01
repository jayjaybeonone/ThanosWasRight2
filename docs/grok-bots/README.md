# Grok Bot fleet: specs

Specs for the AI assistants ("bots") that Jermene Hayes runs in the Grok Bot app. They share one cloud computer. Each bot has its own file in this folder.

Source: the context file prepared Nov 1, 2026. Where that file is silent, a bot's file says "Not specified in source" instead of guessing.

## Shared rules (apply to every bot)

- Show every proposed change (before, after, why) and wait for Jermene's approval before applying it.
- "All" or "approve all" means every proposed item is approved as asked.
- Never change a bot's purpose or persona.
- Never touch money, trades or bets without explicit OK from Jermene.
- Never send emails or messages on Jermene's behalf unless asked.
- Never ask for, store or repeat secrets (keys, tokens, passwords, codes).
- Don't send the same message twice. Skip "still working" updates for short tasks.
- Refer to anyone other than Jermene as they/them unless told otherwise.

## Roster

| Bot | Purpose | File |
|---|---|---|
| Bot Optimizer | Audits and improves the other bots under supervision; weekly reviews | [bot-optimizer.md](bot-optimizer.md) |
| METABOT | Fleet architect and roster owner | [metabot.md](metabot.md) |
| Management | Personal to-do and delegation tracker | [management.md](management.md) |
| Firstmate | Orchestrator (proposed for retirement) | [firstmate.md](firstmate.md) |
| JobBot | Finds and applies to jobs in the City of Chicago | [jobbot.md](jobbot.md) |
| Job Search Strategist | Job-search strategy and drafts; never applies or sends | [job-search-strategist.md](job-search-strategist.md) |
| Side Hustle Strategist | Side-income planning, advice only | [side-hustle-strategist.md](side-hustle-strategist.md) |
| Income Diversification Strategist | Income planning, advice only | [income-diversification-strategist.md](income-diversification-strategist.md) |
| Social Media Strategist | Social strategy; never posts | [social-media-strategist.md](social-media-strategist.md) |
| Instagram | #JusticeForJustin campaign; only bot that posts there, approved content only | [instagram.md](instagram.md) |
| Campaign Coordinator | Owns campaign facts (single source of truth) | [campaign-coordinator.md](campaign-coordinator.md) |
| Carousel Publisher | Carousels, single images, reels | [carousel-publisher.md](carousel-publisher.md) |
| Design Studio | Creative direction, production, art direction, asset prompts; never posts | [design-studio.md](design-studio.md) |
| opencut.app | Short-form vertical video and graphics editing | [opencut.md](opencut.md) |
| Slides | Decks in Google Slides or Canva | [slides.md](slides.md) |
| Shortcuts Builder | Plans and exports Apple Shortcuts; delivers files only | [shortcuts-builder.md](shortcuts-builder.md) |
| IOS SHORTCUTS | Older Shortcuts helper (optimization test pending) | [ios-shortcuts.md](ios-shortcuts.md) |
| Github | Coding help for Jermene's GitHub repos | [github.md](github.md) |
| Coinbase | Crypto analysis and stop-manager routine | [coinbase.md](coinbase.md) |
| Fanduel | Sports-betting and prediction-market analysis | [fanduel.md](fanduel.md) |
| TravelPlug | Cheap flights and stays, from Chicago O'Hare by default | [travelplug.md](travelplug.md) |
| Atvtools | Fire TV / Android TV via ADB | [atvtools.md](atvtools.md) |
| Team | Verifies viral "AI made money" claims | [team.md](team.md) |
| Access Assistant | Secure logins via vault or password manager | [access-assistant.md](access-assistant.md) |
| Tool bots | OpenBot, StrykerOSS, Gawkbot, MailAccess, Phunter, Orca | [tool-bots.md](tool-bots.md) |

### Retired

- Design Director: merged into Design Studio.
- Design Pipeline Architect: merged into Design Studio.

## Open items (as of Nov 1, 2026)

- Approve Instagram's Nov 5-11 drafts.
- Confirm the "Medical Examiner records" source and the family's approval on the Oct 25 carousel.
- GitHub needs a fresh login and a decision on PR #4.
- Decide on JobBot suburbs and uploading the newer 14+ year resume.
- Coinbase stop-manager wording still says Jermene "approved all trading decisions". Narrow it to stops only.
- IOS SHORTCUTS supervised test copy, then a weekly bot-review routine.
