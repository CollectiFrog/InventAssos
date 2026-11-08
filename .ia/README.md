# .ia/

Everything agents read as context. Rules themselves live in [`../AGENTS.md`](../AGENTS.md).

| Folder     | Holds                                                                   | Updated when                 |
|------------|-------------------------------------------------------------------------|------------------------------|
| `context/` | what the project is: purpose, users, stack, glossary, boundaries        | the project's scope changes  |
| `skills/`  | one folder per procedure, `<name>/SKILL.md` with `name` + `description` | a procedure changes          |
| `sources/` | external references worth keeping: specs, API notes, research           | a source is added or expires |

- Claude Code discovers `skills/` through the symlink `.claude/skills → ../.ia/skills`.
  On Windows, clone with symlinks enabled (`git config --global core.symlinks true` and Developer
  Mode on); otherwise the link becomes a text file and only the `AGENTS.md` pointer works.
- A new skill: `skills/<name>/SKILL.md`, frontmatter `name` (kebab-case) and `description`
  (what it does and **when** to use it), then add it to the table in `AGENTS.md`.
- Keep files short and true. Delete what no longer matches the code.
