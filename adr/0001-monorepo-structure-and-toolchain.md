# ADR-0001: Monorepo Structure and TypeScript Toolchain

**Date**: 2025-12-30
**Status**: Accepted
**Deciders**: Architecture Team

## Context

WorkPipe is a compiler project that transforms a DSL into GitHub Actions YAML. The codebase requires multiple interconnected packages:

1. **Grammar/Parser**: Lezer-based grammar and generated parser tables
2. **Compiler Core**: AST, type checking, cycle lowering, YAML emission
3. **CLI**: Command-line interface for end users
4. **Action**: GitHub Action wrapper for CI integration

These packages have clear dependency relationships and share common tooling (TypeScript, testing, linting). We need to establish:

- How to organize these packages in the repository
- Which package manager to use for workspace management
- TypeScript configuration strategy
- Code quality tooling choices

The project targets Node 20 to align with GitHub Actions' runner environment, ensuring generated workflows execute in a compatible runtime.

## Decision

### 1. Monorepo with pnpm Workspaces

We will use a monorepo structure managed by **pnpm workspaces**.

Package layout:
```
workpipe/
  packages/
    lang/           @workpipe/lang
    compiler/       @workpipe/compiler
    cli/            @workpipe/cli
    action/         @workpipe/action
  examples/
  adr/
```

### 2. Scoped Package Names

All packages will use the `@workpipe/` npm scope:
- `@workpipe/lang`
- `@workpipe/compiler`
- `@workpipe/cli`
- `@workpipe/action`

### 3. TypeScript Project References

We will use TypeScript project references for:
- Incremental compilation across packages
- Proper build ordering
- IDE navigation between packages

Configuration structure:
- `tsconfig.base.json`: Shared compiler options
- `tsconfig.json`: Root config with references to all packages
- `packages/*/tsconfig.json`: Package-specific configs extending base

Compiler options:
- `target`: ES2022
- `module`: NodeNext
- `moduleResolution`: NodeNext
- `strict`: true
- `declaration`: true
- `declarationMap`: true
- `composite`: true (required for references)

### 4. ESLint with TypeScript Support

ESLint configuration:
- Parser: `@typescript-eslint/parser`
- Plugins: `@typescript-eslint/eslint-plugin`
- Integration: `eslint-config-prettier` to avoid conflicts
- Shared config at root, extended by packages

### 5. Prettier for Formatting

Prettier configuration at root with:
- 2-space indentation
- Single quotes
- No trailing commas (ES5 style)
- Print width: 100

### 6. Vitest for Testing

Vitest will be the test runner:
- Workspace configuration at root
- Each package can have its own vitest config if needed
- Native ESM support aligns with our module system
- Faster than Jest for TypeScript projects

### 7. Node 20 Target

All packages target Node 20.x:
- Matches GitHub Actions `ubuntu-latest` runner default
- Supports ES2022 features natively
- Long-term support until April 2026

## Alternatives Considered

### npm Workspaces Instead of pnpm

**Pros**:
- No additional tooling to install
- Built into Node.js

**Cons**:
- Less strict node_modules structure allows phantom dependencies
- Slower installation
- Less mature workspace protocol support

**Decision**: Rejected. pnpm's strictness catches dependency issues earlier and the performance benefit is significant for development iteration.

### Yarn (Classic or Berry)

**Pros**:
- Mature workspace support
- Plug'n'Play for faster resolution (Berry)

**Cons**:
- Berry's PnP has compatibility issues with some tools
- Additional complexity for marginal benefit
- Less adoption momentum than pnpm

**Decision**: Rejected. pnpm offers the best balance of strictness, performance, and ecosystem compatibility.

### Nx or Turborepo Build System

**Pros**:
- Sophisticated caching
- Task orchestration
- Dependency graph visualization

**Cons**:
- Overhead for a project of this size
- Additional learning curve
- TypeScript project references already provide incremental builds

**Decision**: Rejected for v1. May reconsider if build times become problematic at scale.

### Bundling with esbuild/tsup

**Pros**:
- Faster builds
- Single-file distribution for CLI

**Cons**:
- Additional tooling complexity
- Not needed for library packages
- TypeScript project references sufficient for development

**Decision**: Deferred. May add esbuild bundling for CLI distribution in later phases.

### Jest Instead of Vitest

**Pros**:
- More established ecosystem
- Broader documentation

**Cons**:
- Slower execution
- ESM support requires configuration workarounds
- TypeScript requires ts-jest transformer

**Decision**: Rejected. Vitest's native ESM and TypeScript support aligns better with our module strategy.

## Consequences

### Positive

1. **Clear package boundaries**: Each package has a defined responsibility, making the codebase navigable
2. **Incremental builds**: Project references mean only changed packages rebuild
3. **Dependency safety**: pnpm's strict node_modules prevents accidental phantom dependencies
4. **Consistent code style**: ESLint + Prettier enforced across all packages
5. **Fast test iteration**: Vitest's speed supports TDD workflow
6. **Future-ready**: ES2022 target and NodeNext modules align with ecosystem direction

### Negative

1. **pnpm installation**: Contributors must install pnpm (mitigated by corepack)
2. **Learning curve**: Project references require understanding of TypeScript's build mode
3. **Initial setup complexity**: More configuration files than a single-package project

### Neutral

1. **Package versioning**: All packages start at 0.1.0; independent versioning can be added later
2. **Publishing**: Scoped packages require npm organization setup before first publish

## References

- [pnpm Workspaces Documentation](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Vitest Workspace Mode](https://vitest.dev/guide/workspace.html)
- [Node 20 Release Schedule](https://nodejs.org/en/about/releases/)
- PROJECT.md Section 11.2: Implementation language requirements
- CLAUDE.md Section 11: Recommended repo layout
