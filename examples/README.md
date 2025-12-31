# WorkPipe Examples

Learn WorkPipe by example. This showcase contains working examples that demonstrate WorkPipe's features, from basic syntax to advanced patterns.

Every example compiles and generates valid GitHub Actions YAML.

---

## Quick Start

```bash
# Compile any example
workpipe build examples/minimal/minimal.workpipe -o examples/minimal/

# Compile all examples at once
workpipe build examples/**/*.workpipe
```

---

## Example Catalog

### Fundamentals

Start here to learn WorkPipe basics.

| Example | Difficulty | Key Features | Description |
|---------|------------|--------------|-------------|
| [minimal](./minimal/) | Beginner | `workflow`, `job`, `run()` | The simplest possible WorkPipe specification |
| [simple-job](./simple-job/) | Beginner | `needs`, `if`, `uses()` | Multiple jobs with dependencies and conditionals |
| [ci-pipeline](./ci-pipeline/) | Beginner | parallel jobs, dependency chains | Standard lint/test/build/deploy pipeline |

### Data Flow

Learn how to pass data between jobs.

| Example | Difficulty | Key Features | Description |
|---------|------------|--------------|-------------|
| [job-outputs](./job-outputs/) | Intermediate | typed outputs, `$GITHUB_OUTPUT` | Pass typed values (string, int, bool) between jobs |
| [json-outputs](./json-outputs/) | Intermediate | `json` type, `fromJSON()` | Pass structured data with nested objects and arrays |
| [user-defined-types](./user-defined-types/) | Intermediate | `type`, type references, property validation | Define reusable types with compile-time property checking |

### Workflow Patterns

Common patterns for real-world workflows.

| Example | Difficulty | Key Features | Description |
|---------|------------|--------------|-------------|
| [release-workflow](./release-workflow/) | Intermediate | `workflow_dispatch`, fan-in | Manual release process with parallel build and changelog |
| [microservices-build](./microservices-build/) | Intermediate | fan-out/fan-in, parallel builds | Build multiple services concurrently, then converge for testing |
| [guard-job](./guard-job/) | Intermediate | `guard_js`, step-level guards | Conditional execution using JavaScript guard expressions |

### AI Integration

WorkPipe's unique agent task integration with Claude Code.

| Example | Difficulty | Key Features | Description |
|---------|------------|--------------|-------------|
| [agent-task](./agent-task/) | Intermediate | `agent_job`, `agent_task`, inline schemas | AI-powered code review with structured output |
| [iterative-refinement](./iterative-refinement/) | Advanced | cycles, agent tasks, state passing | AI documentation improvement with iterative cycles |

### Advanced Patterns

Complex workflows for enterprise use cases.

| Example | Difficulty | Key Features | Description |
|---------|------------|--------------|-------------|
| [cycle-basic](./cycle-basic/) | Advanced | `cycle`, `guard_js`, `until` | Iterative refinement loops that span multiple workflow runs |

### Planned Examples

These examples are documented but not yet fully implemented.

| Example | Status | Description |
|---------|--------|-------------|
| [matrix-build](./matrix-build/) | Planned | Matrix builds for multi-version/multi-OS testing |
| [enterprise-e2e-pipeline](./enterprise-e2e-pipeline/) | Syntax Update Needed | Environment provisioning, parallel tests, guaranteed cleanup |
| [multi-environment-deploy](./multi-environment-deploy/) | Syntax Update Needed | Build-once deploy-many with environment promotion |

---

## Learning Path

New to WorkPipe? Follow this progression:

### Level 1: Basics
1. **[minimal](./minimal/)** - Understand the basic structure: workflow, job, steps
2. **[simple-job](./simple-job/)** - Learn job dependencies with `needs` and conditionals with `if`

### Level 2: CI Patterns
3. **[ci-pipeline](./ci-pipeline/)** - See parallel execution and stage gating in action
4. **[release-workflow](./release-workflow/)** - Manual triggers and fan-in patterns

### Level 3: Data Passing
5. **[job-outputs](./job-outputs/)** - Pass typed data between jobs
6. **[json-outputs](./json-outputs/)** - Work with structured JSON data
7. **[user-defined-types](./user-defined-types/)** - Create reusable types with compile-time validation

### Level 4: Advanced Features
8. **[guard-job](./guard-job/)** - JavaScript guards for conditional execution
9. **[agent-task](./agent-task/)** - AI-powered automation with Claude Code
10. **[cycle-basic](./cycle-basic/)** and **[iterative-refinement](./iterative-refinement/)** - Iterative workflows

### Level 5: Enterprise Patterns
11. **[microservices-build](./microservices-build/)** - Fan-out/fan-in for parallel service builds

---

## Example Structure

Each example directory contains:

| File | Purpose |
|------|---------|
| `*.workpipe` | The WorkPipe source specification |
| `*.yml` | Generated GitHub Actions workflow |
| `README.md` | Documentation explaining the example |

---

## Running Examples

### Single Example

```bash
workpipe build examples/minimal/minimal.workpipe -o examples/minimal/
```

### All Examples

```bash
workpipe build examples/**/*.workpipe
```

### Validate Without Writing

```bash
workpipe check examples/minimal/minimal.workpipe
```

---

## Feature Reference

Quick reference for which examples demonstrate each feature.

| Feature | Examples |
|---------|----------|
| Basic job syntax | [minimal](./minimal/), [simple-job](./simple-job/) |
| Job dependencies (`needs`) | [simple-job](./simple-job/), [ci-pipeline](./ci-pipeline/) |
| Conditionals (`if`) | [simple-job](./simple-job/), [ci-pipeline](./ci-pipeline/) |
| Typed outputs | [job-outputs](./job-outputs/), [json-outputs](./json-outputs/) |
| JSON data passing | [json-outputs](./json-outputs/) |
| User-defined types | [user-defined-types](./user-defined-types/) |
| Agent tasks | [agent-task](./agent-task/), [iterative-refinement](./iterative-refinement/) |
| Inline output schemas | [agent-task](./agent-task/) |
| Cycles | [cycle-basic](./cycle-basic/), [iterative-refinement](./iterative-refinement/) |
| Guard expressions | [guard-job](./guard-job/), [cycle-basic](./cycle-basic/) |
| Manual triggers | [release-workflow](./release-workflow/), [iterative-refinement](./iterative-refinement/) |
| Parallel execution | [ci-pipeline](./ci-pipeline/), [microservices-build](./microservices-build/) |
| Fan-out/fan-in | [microservices-build](./microservices-build/), [release-workflow](./release-workflow/) |

---

## Contributing Examples

When adding new examples:

1. Create a directory matching the example name
2. Add the `.workpipe` source file
3. Generate the output YAML with `workpipe build`
4. Write a README explaining:
   - What the example demonstrates
   - Key WorkPipe features used
   - How to compile and run it
5. Update this index

See [minimal](./minimal/) for the reference README structure.
