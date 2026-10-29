## Agent skills

### Issue tracker

Issues live in GitHub Issues (`zdenkolini/nuxt-belot`), via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` + `docs/adr/`. See `docs/agents/domain.md`.

## Coding standards

Follow `docs/coding-standards.md`.

## Dependencies

A dependency used by more than one workspace goes in the `catalog` in the root `package.json`; workspaces reference it as `"catalog:"`.
