# Architecture Review Team Example

Demonstrates a multi-agent architecture analysis workflow with specialized analyzers, documentation updates, and approval gates using a fan-out/fan-in pattern.

## What This Demonstrates

- Multi-agent pattern with 4 specialized architecture analyzers
- Fan-out/fan-in workflow topology
- Reusable job fragments with parameterized focus areas
- Artifact passing between parallel and sequential stages
- Structured output schemas for analysis reports
- Documentation update automation
- ADR (Architecture Decision Record) workflow integration

## Key Concepts

### Multi-Analyzer Pattern

Multiple specialized analyzers examine the same PR from different architectural perspectives:

```workpipe
job design_patterns = architecture_analyzer {
  focus: "design patterns usage, SOLID principles compliance..."
  analyzer_name: "design-patterns"
}

job dependencies = architecture_analyzer {
  focus: "module dependencies, import graphs, circular dependencies..."
  analyzer_name: "dependencies"
}
```

### Fan-Out/Fan-In Topology

The workflow uses a fan-out/fan-in pattern with sequential follow-up stages:

```
                        +-- design_patterns --+
                        |                     |
pull_request ----------+-- dependencies -----+-- synthesizer --> doc_updater --> approval_gate
                        |                     |
                        +-- performance ------+
                        |                     |
                        +-- tech_debt --------+
```

1. **Fan-out**: Four specialized analyzers run in parallel
2. **Fan-in**: Synthesizer agent collects all analyses
3. **Sequential**: Doc updater processes synthesis, then approval gate

### Structured Type Definitions

Type definitions ensure consistent output structure:

```workpipe
type DesignAnalysis {
  solid_compliance: {
    single_responsibility: "pass" | "warn" | "fail"
    open_closed: "pass" | "warn" | "fail"
    // ...
  }
  patterns_found: [PatternFinding]
  overall_score: int
  summary: string
}

type DependencyGraph {
  modules: [string]
  edges: [DependencyEdge]
  circular_dependencies: [string]
  coupling_issues: [string]
  cohesion_score: int
  summary: string
}
```

### Parameterized Job Fragments

A single `architecture_analyzer` fragment is instantiated with different parameters:

```workpipe
job_fragment architecture_analyzer {
  params {
    focus: string
    analyzer_name: string
  }
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    agent_task("Analyze the PR changes focusing on ${{ params.focus }}...") {
      model: "claude-sonnet-4-20250514"
      max_turns: 7
      tools: { allowed: ["Read", "Glob", "Grep"] }
      output_artifact: "analysis-${{ params.analyzer_name }}"
    }
  }
}
```

### Human Approval Gate

The approval gate produces a summary for architecture team review. To require manual approval before merge:

1. Go to **Settings > Environments** in your GitHub repository
2. Create a new environment named `architecture-review`
3. Enable **Required reviewers**
4. Add architecture team members as required reviewers
5. Modify the generated GitHub Actions YAML to add `environment: architecture-review` to the `approval_gate` job

The workflow will then pause at `approval_gate` until an approved reviewer clicks "Approve" in the Actions UI.

## ADR (Architecture Decision Record) Workflow

The doc updater agent automatically:

1. Reviews all analysis artifacts
2. Identifies if architectural changes warrant an ADR
3. Sets `adr_required: true` with a suggested title in `ArchDocUpdate`
4. Lists documentation that needs updating

When an ADR is required:

1. The `ArchDocUpdate` artifact indicates the need
2. Reviewers in the approval gate see the ADR recommendation
3. Team can create the ADR before approving
4. Merge proceeds only after architecture team approval

## Analyzer Focus Areas

| Analyzer | Focus |
|----------|-------|
| Design Patterns | SOLID principles, design patterns, abstractions, OOP quality |
| Dependencies | Import graphs, circular deps, coupling, cohesion |
| Performance | Bottlenecks, complexity, memory, I/O, scalability |
| Tech Debt | Code smells, TODOs, outdated patterns, refactoring needs |

## Output Types

### PatternFinding
- Pattern name and category (creational, structural, behavioral, architectural)
- Assessment (well-applied, misapplied, missing-opportunity)
- Location and recommendations

### DesignAnalysis
- SOLID compliance scores for each principle
- Pattern findings with assessments
- Overall architecture score

### DependencyEdge
- Source and target modules
- Coupling strength (tight, loose, decoupled)
- Dependency kind (import, inheritance, composition, runtime)

### DependencyGraph
- Module list and dependency edges
- Circular dependency detection
- Coupling and cohesion metrics

### PerformanceHotspot
- Location and category (algorithmic, io-bound, memory, network, rendering)
- Severity and estimated impact
- Optimization suggestions

### PerformanceReport
- Hotspot locations with severity
- Scalability concerns
- Optimization opportunities

### DebtItem
- Location and category
- Effort estimate and priority
- Description

### TechDebtAssessment
- Debt items with effort estimates
- Refactoring opportunities
- Legacy code identification

### ArchDocUpdate
- Diagrams and sections to update
- ADR requirement flag with suggested title
- Change summary

## Use Cases

- **Architectural Governance**: Ensure PRs follow architectural standards
- **Technical Debt Tracking**: Quantify debt introduced by changes
- **Knowledge Capture**: Document architectural decisions as ADRs
- **Team Alignment**: Approval gate ensures architecture team awareness
- **Dependency Management**: Catch coupling issues before merge

## Compiling

```bash
pnpm exec workpipe build examples/architecture-review-team/architecture-review-team.workpipe
```

## Workflow Graph

```
pull_request
     |
     +---> design_patterns ----+
     |                         |
     +---> dependencies -------+
     |                         +---> synthesizer
     +---> performance --------+          |
     |                         |          v
     +---> tech_debt ----------+     doc_updater
                                          |
                                          v
                                   approval_gate
                                          |
                                          v
                                  approval-summary artifact
```

## Artifacts Produced

| Artifact | Description |
|----------|-------------|
| `analysis-design-patterns` | Design pattern and SOLID analysis |
| `analysis-dependencies` | Dependency graph and coupling analysis |
| `analysis-performance` | Performance hotspot analysis |
| `analysis-tech-debt` | Technical debt assessment |
| `architecture-synthesis` | Combined analysis from all analyzers |
| `doc-update-plan` | Documentation update plan with ADR flags |
| `approval-summary` | Summary for architecture team review |
