---
status: accepted
---

# Guest accounts, claimed by email

Supersedes ADR 0003. To lower the step before the first match, a player can start as a guest: an account with no email, created in one click, with an auto-generated username, living only in that browser. Guests play every casual match but never ranked. Email magic link stays the way to sign in; social providers come later. A guest keeps their account by claiming it: connecting an email through magic link.

A claim first takes the guest out of their room, so no room, seat, or running match ever changes owner mid-play: after a confirm, the seat is freed when the link is sent, and freed again without a prompt if the guest sat down before opening it. A claim is refused only when the link is opened during a running match; the guest goes back to their room and claims again after the match (amended by ADR 0008). Match history follows the claim by rewriting the guest's id in stored matches. When the email already has an account, the player chooses to keep only that account's history or to add the guest's; matches where both ids sat are never merged. History that is not moved is kept, not deleted, and every claim is recorded, so we can later measure how players choose before settling the rule.
