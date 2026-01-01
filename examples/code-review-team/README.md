# Code Review Team Example

Demonstrates a multi-agent code review workflow with specialized reviewers and synthesized output using a fan-out/fan-in pattern.

## What This Demonstrates

- Multi-reviewer pattern with 5 specialized AI agents
- Fan-out/fan-in workflow topology
- Reusable job fragments with parameterized focus areas
- Artifact passing between parallel and sequential stages
- Structured output schemas for review reports
- Final synthesis from multiple independent reviews

## Key Concepts

### Multi-Reviewer Pattern

Multiple specialized reviewers examine the same PR from different perspectives. Each reviewer has a focused area of expertise:

```workpipe
job security = specialized_reviewer {
  focus: "security vulnerabilities, injection risks, auth issues"
  reviewer_name: "security"
}

job performance = specialized_reviewer {
  focus: "performance bottlenecks, memory leaks, N+1 queries"
  reviewer_name: "performance"
}
```

### Fan-Out/Fan-In Topology

The workflow uses a fan-out/fan-in pattern:
1. **Fan-out**: Four specialized reviewers run in parallel
2. **Fan-in**: A synthesizer agent collects all reviews and produces a final verdict

```
                    +-- security ------+
                    |                  |
pull_request ---+-- performance ---+-- synthesizer --> final verdict
                    |                  |
                    +-- style ---------+
                    |                  |
                    +-- architecture --+
```

### Structured Type Definitions

Type definitions ensure consistent output structure across all agents:

```workpipe
type ReviewFinding {
  severity: "critical" | "warning" | "info"
  filepath: string
  description: string
}

type ReviewReport {
  reviewer: string
  verdict: "approve" | "request_changes" | "comment"
  findings: [ReviewFinding]
  summary: string
}

type SynthesizedReview {
  final_verdict: "approve" | "request_changes" | "comment"
  blocking_issues: int
  summary: string
}
```

### Parameterized Job Fragments

A single `specialized_reviewer` fragment is instantiated with different parameters for each reviewer type:

```workpipe
job_fragment specialized_reviewer {
  params {
    focus: string
    reviewer_name: string
  }
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    agent_task("Review the PR focusing on ${{ params.focus }}. Provide detailed findings.") {
      model: "claude-sonnet-4-20250514"
      max_turns: 5
      tools: { allowed: ["Read", "Glob", "Grep"] }
      output_schema: ReviewReport
      output_artifact: "review-${{ params.reviewer_name }}"
    }
  }
}
```

### Artifact Aggregation

The synthesizer downloads all review artifacts and combines them:

```workpipe
uses("actions/download-artifact@v4") { with: { pattern: "review-*" } }
```

## Workflow Graph

```
pull_request
     |
     +---> security --------+
     |                      |
     +---> performance -----+---> synthesizer ---> final-review artifact
     |                      |
     +---> style -----------+
     |                      |
     +---> architecture ----+
```

## Reviewer Focus Areas

| Reviewer | Focus |
|----------|-------|
| Security | Vulnerabilities, injection risks, auth issues |
| Performance | Bottlenecks, memory leaks, N+1 queries |
| Style | Code style, naming conventions, maintainability |
| Architecture | Design patterns, coupling, SOLID principles |

## Use Cases

- **Automated PR Review**: Comprehensive code review before human review
- **Quality Gates**: Enforce code quality standards automatically
- **Knowledge Capture**: Document findings for future reference
- **Team Augmentation**: Supplement human reviewers with AI perspectives

## Compiling

```bash
workpipe build code-review-team.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
