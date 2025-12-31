# WI-087: Import System - Documentation

**ID**: WI-087
**Status**: Backlog
**Priority**: P0-Critical
**Milestone**: F (Import System)
**Created**: 2025-12-31
**Updated**: 2025-12-31

## Description

Create comprehensive documentation for the import system. This is Phase 8 of the import system implementation (ADR-0012).

## Acceptance Criteria

- [ ] Update `docs/language-reference.md` with import syntax
- [ ] Import statement syntax and semantics
- [ ] Path resolution rules documented
- [ ] Aliasing syntax documented
- [ ] Non-transitive import behavior explained
- [ ] Create import best practices guide
- [ ] When to use imports vs. inline types
- [ ] Project structure recommendations
- [ ] Create example: `examples/shared-types/`
- [ ] Multi-file project demonstrating imports
- [ ] Types file + workflow files that import
- [ ] Expected YAML output
- [ ] README explaining the pattern
- [ ] Update main README with import feature mention
- [ ] Update `docs/errors.md` with WP7xxx codes (if not done in WI-084)
- [ ] Migration guide: "Adding imports to existing projects"

## Technical Context

**Documentation structure**:

Language Reference additions:
```markdown
## Imports

WorkPipe supports importing type definitions from other files.

### Syntax

\`\`\`workpipe
import { TypeName } from "./path/to/file.workpipe"
import { TypeName as Alias } from "./path/to/file.workpipe"
\`\`\`

### Path Resolution

- Paths are relative to the importing file
- The `.workpipe` extension is required
- Absolute paths are not recommended

### Non-Transitive Imports

Types imported into a file are not automatically re-exported...
```

**Example project structure**:

```
examples/shared-types/
  README.md
  types/
    common.workpipe       # Shared type definitions
  workflows/
    ci.workpipe           # Imports from types/
    deploy.workpipe       # Imports from types/
  expected/
    ci.yml
    deploy.yml
```

**Files to create/modify**:
- `docs/language-reference.md`
- `docs/errors.md` (WP7xxx section)
- `examples/shared-types/` (new example)
- `README.md` (feature mention)

## Dependencies

- WI-080 through WI-086 (all import implementation phases)

## Notes

- Documentation should be written as implementation progresses
- Examples must compile and produce valid YAML
- Best practices should be grounded in real use cases
- Consider FAQ section for common import questions
