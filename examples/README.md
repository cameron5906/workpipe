# WorkPipe Examples

Learn WorkPipe by example. This showcase contains 23 working examples that demonstrate WorkPipe's features, from basic syntax to advanced multi-agent orchestration patterns.

Every example compiles and generates valid GitHub Actions YAML.

---

## Getting Started

### Prerequisites

Install the WorkPipe CLI:
```bash
npm install -g workpipe
```

### Compile an Example

```bash
# Navigate to the examples directory
cd examples

# Compile any example
workpipe build cross-platform-matrix-test/workflow.yml

# Or validate without writing output
workpipe check smart-pr-workflow/workflow.yml
```

### Example Structure

Each example directory contains:

| File | Purpose |
|------|---------|
| `workflow.yml` or `*.workpipe` | The WorkPipe source specification |
| `expected.yml` | Generated GitHub Actions workflow |
| `README.md` | Documentation explaining the example |

---

## Example Categories

### Phase 1: Core WorkPipe Features (8 examples)

These examples demonstrate WorkPipe's fundamental capabilities: matrix builds, typed outputs, guard conditions, dependency graphs, and iterative cycles.

| Example | Difficulty | Key Features | Description |
|---------|------------|--------------|-------------|
| [cross-platform-matrix-test](./cross-platform-matrix-test/) | Intermediate | Matrix builds, typed outputs, parallel execution | Run tests across Node.js versions and OS platforms |
| [smart-pr-workflow](./smart-pr-workflow/) | Intermediate | Guard conditions, helper functions, conditionals | Intelligent PR filtering based on draft state and labels |
| [typed-release-pipeline](./typed-release-pipeline/) | Intermediate | Cross-file imports, nested types, string literals | Release workflow with shared type definitions |
| [environment-matrix-deploy](./environment-matrix-deploy/) | Intermediate | Matrix + guards, environment configs | Deploy across environments with conditional logic |
| [cycle-convergence](./cycle-convergence/) | Advanced | Cycles, guard conditions, iteration state | Iterative quality improvement with convergence |
| [diamond-dependency](./diamond-dependency/) | Intermediate | Fan-out/fan-in, parallel builds | Classic diamond pattern with typed build outputs |
| [staged-approval](./staged-approval/) | Intermediate | Stage gating, sequential dependencies | Multi-stage pipeline with approval gates |
| [parallel-iterative-agents](./parallel-iterative-agents/) | Advanced | Cycles, parallel agents, state passing | Multiple AI agents iterating in parallel |

### Phase 2: Fragment System (5 examples)

Fragments enable code reuse by defining parameterized job and step templates. These examples progress from basic fragment usage to complex composition patterns.

| Example | Difficulty | Key Features | Description |
|---------|------------|--------------|-------------|
| [fragment-basics](./fragment-basics/) | Beginner | `job_fragment`, `steps_fragment`, params | Introduction to reusable workflow components |
| [agent-task-fragments](./agent-task-fragments/) | Intermediate | Agent fragments, parameterized AI tasks | Reusable AI agent templates |
| [cross-file-fragments](./cross-file-fragments/) | Intermediate | Fragment imports, cross-file reuse | Share fragments across multiple workflow files |
| [microservices-with-fragments](./microservices-with-fragments/) | Intermediate | Service fragments, parallel builds | Build multiple services using shared templates |
| [fragment-composition](./fragment-composition/) | Advanced | Fragment nesting, composition patterns | Combine fragments to build complex workflows |

### Phase 3: Multi-Agent Orchestration (10 examples)

These examples showcase WorkPipe's AI agent capabilities, demonstrating team-based workflows with specialized agents, fan-out/fan-in patterns, and structured output schemas.

| Example | Difficulty | Key Features | Description |
|---------|------------|--------------|-------------|
| [code-review-team](./code-review-team/) | Intermediate | Multi-reviewer, fan-out/fan-in, synthesis | 5 specialized reviewers analyze PRs in parallel |
| [documentation-team](./documentation-team/) | Intermediate | Doc agents, API extraction, guide generation | Team of agents to generate documentation |
| [security-audit-team](./security-audit-team/) | Intermediate | Security scanners, vulnerability analysis | Multi-agent security assessment workflow |
| [testing-team](./testing-team/) | Intermediate | Test agents, coverage analysis | Agents that analyze and generate tests |
| [issue-triage-team](./issue-triage-team/) | Intermediate | Issue classification, priority assignment | Automated issue triage with AI agents |
| [release-manager-team](./release-manager-team/) | Advanced | Release coordination, changelog generation | Orchestrate release process with AI agents |
| [pr-review-orchestrator](./pr-review-orchestrator/) | Advanced | Staged review, 6 specialized checkers | Comprehensive PR review with dependency ordering |
| [architecture-review-team](./architecture-review-team/) | Advanced | Design analysis, pattern detection | Team to evaluate architectural decisions |
| [onboarding-assistant-team](./onboarding-assistant-team/) | Advanced | Knowledge extraction, guide generation | Generate onboarding materials for new developers |
| [incident-response-team](./incident-response-team/) | Advanced | Parallel investigation, human approval gates | Production incident response with postmortem |

---

## Learning Path

New to WorkPipe? Follow this progression to build expertise:

### Level 1: Understanding Fragments

Start here to learn the foundation of code reuse in WorkPipe.

1. **[fragment-basics](./fragment-basics/)** - Learn `job_fragment` and `steps_fragment` syntax
2. **[agent-task-fragments](./agent-task-fragments/)** - Apply fragments to AI agent tasks
3. **[cross-file-fragments](./cross-file-fragments/)** - Share fragments across files

### Level 2: Matrix Builds and Typed Outputs

Learn to scale workflows across platforms and pass structured data.

4. **[cross-platform-matrix-test](./cross-platform-matrix-test/)** - Matrix builds with typed test results
5. **[typed-release-pipeline](./typed-release-pipeline/)** - Cross-file type imports and nested types
6. **[diamond-dependency](./diamond-dependency/)** - Fan-out/fan-in with typed build outputs

### Level 3: Conditional Execution

Control workflow behavior with guards and conditions.

7. **[smart-pr-workflow](./smart-pr-workflow/)** - JavaScript guards with helper functions
8. **[environment-matrix-deploy](./environment-matrix-deploy/)** - Combine matrices with guard conditions
9. **[staged-approval](./staged-approval/)** - Sequential stage gating

### Level 4: Advanced Patterns

Master complex workflow patterns including cycles and composition.

10. **[microservices-with-fragments](./microservices-with-fragments/)** - Fragment-based microservice builds
11. **[fragment-composition](./fragment-composition/)** - Nested and composed fragments
12. **[cycle-convergence](./cycle-convergence/)** - Iterative workflows with convergence

### Level 5: Multi-Agent Orchestration

Build AI-powered workflows with specialized agent teams.

13. **[code-review-team](./code-review-team/)** - Your first multi-agent workflow
14. **[pr-review-orchestrator](./pr-review-orchestrator/)** - Staged multi-agent review
15. **[incident-response-team](./incident-response-team/)** - Complex real-world scenario

### Level 6: Expert Patterns

Combine everything for production-ready workflows.

16. **[parallel-iterative-agents](./parallel-iterative-agents/)** - Cycles with parallel AI agents
17. **[release-manager-team](./release-manager-team/)** - Full release orchestration
18. **[architecture-review-team](./architecture-review-team/)** - Advanced multi-agent patterns

---

## Feature Reference

Quick reference for which examples demonstrate each feature.

### Workflow Patterns

| Feature | Examples |
|---------|----------|
| Matrix builds | [cross-platform-matrix-test](./cross-platform-matrix-test/), [environment-matrix-deploy](./environment-matrix-deploy/) |
| Fan-out/fan-in | [diamond-dependency](./diamond-dependency/), [code-review-team](./code-review-team/), [pr-review-orchestrator](./pr-review-orchestrator/) |
| Stage gating | [staged-approval](./staged-approval/), [pr-review-orchestrator](./pr-review-orchestrator/) |
| Cycles | [cycle-convergence](./cycle-convergence/), [parallel-iterative-agents](./parallel-iterative-agents/) |

### Type System

| Feature | Examples |
|---------|----------|
| User-defined types | [cross-platform-matrix-test](./cross-platform-matrix-test/), [diamond-dependency](./diamond-dependency/), [code-review-team](./code-review-team/) |
| Cross-file imports | [typed-release-pipeline](./typed-release-pipeline/), [cross-file-fragments](./cross-file-fragments/) |
| String literal types | [typed-release-pipeline](./typed-release-pipeline/), [code-review-team](./code-review-team/) |
| Array types | [typed-release-pipeline](./typed-release-pipeline/), [incident-response-team](./incident-response-team/) |

### Fragments

| Feature | Examples |
|---------|----------|
| Job fragments | [fragment-basics](./fragment-basics/), [microservices-with-fragments](./microservices-with-fragments/), [code-review-team](./code-review-team/) |
| Steps fragments | [fragment-basics](./fragment-basics/), [agent-task-fragments](./agent-task-fragments/) |
| Fragment parameters | [fragment-basics](./fragment-basics/), [pr-review-orchestrator](./pr-review-orchestrator/) |
| Fragment composition | [fragment-composition](./fragment-composition/) |
| Cross-file fragments | [cross-file-fragments](./cross-file-fragments/) |

### Guards and Conditionals

| Feature | Examples |
|---------|----------|
| JavaScript guards | [smart-pr-workflow](./smart-pr-workflow/), [environment-matrix-deploy](./environment-matrix-deploy/) |
| Guard helper functions | [smart-pr-workflow](./smart-pr-workflow/) |
| Cycle guards | [cycle-convergence](./cycle-convergence/) |

### AI Agent Features

| Feature | Examples |
|---------|----------|
| `agent_task` | [agent-task-fragments](./agent-task-fragments/), [code-review-team](./code-review-team/) |
| `agent_job` | [incident-response-team](./incident-response-team/), [parallel-iterative-agents](./parallel-iterative-agents/) |
| Output schemas | [code-review-team](./code-review-team/), [pr-review-orchestrator](./pr-review-orchestrator/) |
| Multi-agent teams | All Phase 3 examples |
| Artifact passing | [code-review-team](./code-review-team/), [incident-response-team](./incident-response-team/) |

---

## Legacy Examples

The following examples exist in the repository but are from earlier WorkPipe versions. They may use older syntax or demonstrate features that have been superseded:

- `agent-task`, `ci-pipeline`, `cycle-basic`, `enterprise-e2e-pipeline`
- `guard-job`, `iterative-refinement`, `job-outputs`, `json-outputs`
- `matrix-build`, `microservices-build`, `minimal`, `multi-environment-deploy`
- `release-workflow`, `shared-types`, `simple-job`, `user-defined-types`

These are preserved for reference but the 23 showcase examples above represent current best practices.

---

## Contributing Examples

When adding new examples:

1. Create a directory with a descriptive kebab-case name
2. Add the WorkPipe source file (`workflow.yml` or `*.workpipe`)
3. Generate the output YAML with `workpipe build`
4. Write a README explaining:
   - What the example demonstrates
   - Key WorkPipe features used
   - Workflow graph (for complex examples)
   - How to compile and run it
5. Update this index with the new example

See [fragment-basics](./fragment-basics/) for a good README template.
