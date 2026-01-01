# PR Review Orchestrator Example

Demonstrates a comprehensive multi-agent PR review workflow with specialized checkers and synthesized output using a fan-out/fan-in pattern with staged dependencies.

## What This Demonstrates

- Multi-stage PR review with 6 specialized AI agents
- Fan-out/fan-in workflow topology with dependency ordering
- Reusable job fragments with parameterized checker patterns
- Artifact passing between sequential and parallel stages
- Structured output schemas for each review phase
- Final synthesis from multiple independent analyses

## Key Concepts

### Multi-Stage Review Pattern

The workflow uses a staged approach:
1. **Stage 1**: Diff analyzer runs first to understand the PR scope
2. **Stage 2**: Four specialized checkers run in parallel (all depend on diff analysis)
3. **Stage 3**: Coordinator synthesizes all results into a final review

### User-Defined Types

Each agent produces structured output with explicit schemas:

```workpipe
type DiffAnalysis {
  total_files_changed: int
  total_additions: int
  total_deletions: int
  changed_files: [FileChange]
  affected_modules: [string]
  summary: string
}

type CoverageCheck {
  coverage_status: "adequate" | "insufficient" | "missing"
  tested_changes: [string]
  untested_changes: [string]
  recommendations: [string]
}

type PRReviewSummary {
  overall_verdict: "approve" | "request_changes" | "comment"
  blocking_issues: int
  warnings: int
  summary: string
  action_items: [string]
}
```

### Parameterized Job Fragments

A single `pr_checker` fragment is instantiated with different parameters for each checker type:

```workpipe
job_fragment pr_checker {
  params {
    checker_name: string
    focus_area: string
    analysis_input: string
  }
  runs_on: ubuntu-latest
  needs: [diff_analyzer]
  steps {
    uses("actions/checkout@v4") {}
    uses("actions/download-artifact@v4") { with: { name: "diff-analysis" } }
    agent_task("${{ params.analysis_input }}") {
      model: "claude-sonnet-4-20250514"
      max_turns: 5
      tools: { allowed: ["Read", "Glob", "Grep"] }
      output_artifact: "${{ params.checker_name }}-result"
    }
  }
}
```

### Fan-Out/Fan-In With Dependencies

The workflow uses explicit `needs:` dependencies to ensure proper ordering:

```
pull_request
     |
     v
diff_analyzer (Stage 1)
     |
     +---> test_coverage --------+
     |                           |
     +---> docs_checker ---------+---> review_coordinator (Stage 3)
     |                           |
     +---> breaking_change ------+
     |                           |
     +---> dependency_auditor ---+

           (Stage 2 - parallel)
```

### Artifact Aggregation

The coordinator downloads all checker results and the original diff analysis:

```workpipe
uses("actions/download-artifact@v4") { with: { pattern: "*-result" } }
uses("actions/download-artifact@v4") { with: { name: "diff-analysis" } }
```

## Workflow Graph

```
pull_request
     |
     v
[diff_analyzer] -----> diff-analysis artifact
     |
     +---> [test_coverage] -------> test-coverage-result
     |
     +---> [docs_checker] --------> docs-result
     |
     +---> [breaking_change] -----> breaking-changes-result
     |
     +---> [dependency_auditor] --> dependency-audit-result
     |
     v
[review_coordinator] <-- reads all artifacts
     |
     v
pr-review-summary (final output)
```

## Checker Focus Areas

| Checker | Purpose |
|---------|---------|
| Diff Analyzer | Understands the scope and nature of PR changes |
| Test Coverage | Verifies tests exist for changed code |
| Docs Checker | Ensures documentation is updated for public API changes |
| Breaking Change Detector | Identifies breaking changes and migration needs |
| Dependency Auditor | Checks new dependencies for security and license issues |
| Review Coordinator | Synthesizes all checks into a final verdict |

## Output Types

| Type | Purpose |
|------|---------|
| DiffAnalysis | Structured summary of all PR changes |
| CoverageCheck | Test coverage status and gaps |
| DocsCheck | Documentation completeness status |
| BreakingChangeCheck | Breaking change severity and migration notes |
| DependencyAudit | Dependency security and license status |
| PRReviewSummary | Final verdict with blocking issues and action items |

## Use Cases

- **Automated PR Review**: Comprehensive automated review before human review
- **Quality Gates**: Block PRs that fail critical checks
- **Documentation Enforcement**: Ensure docs stay in sync with code
- **Security Screening**: Catch dependency vulnerabilities early
- **Breaking Change Detection**: Prevent accidental breaking changes

## Compiling

```bash
workpipe build pr-review-orchestrator.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.

The workflow generates a GitHub Actions YAML file that:
1. Triggers on pull_request events
2. Runs the diff analyzer first
3. Runs all four checkers in parallel
4. Runs the coordinator to synthesize the final review
5. Produces a pr-review-summary artifact with the final verdict
