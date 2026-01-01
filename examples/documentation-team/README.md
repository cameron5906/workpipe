# Documentation Team Example

Demonstrates a sequential multi-agent documentation pipeline with specialized roles: analyzer, writer, editor, and reviewer.

## What This Demonstrates

- Sequential agent pipeline pattern
- Specialized agent roles for documentation workflow
- Artifact passing through sequential stages
- Progressive refinement of documentation
- Structured output schemas for drafts and suggestions
- On-demand workflow execution via workflow_dispatch

## Key Concepts

### Sequential Agent Pipeline

Agents execute in sequence, each building on the previous agent's output:

```
analyzer --> writer --> editor --> reviewer
```

Each stage depends on the output of the previous stage, creating a natural content refinement flow.

### Specialized Agent Roles

| Role | Responsibility |
|------|----------------|
| Analyzer | Scans codebase, identifies undocumented areas |
| Writer | Creates comprehensive documentation from analysis |
| Editor | Reviews for clarity, consistency, improvements |
| Reviewer | Final quality check, approve or request changes |

### Artifact Chain

Each agent produces an artifact that feeds into the next stage:

```
doc-needs --> doc-draft --> edit-suggestions --> doc-review
```

```workpipe
agent_job writer {
  runs_on: ubuntu-latest
  needs: [analyzer]
  steps {
    uses("actions/checkout@v4") {}
    uses("actions/download-artifact@v4") { with: { name: "doc-needs" } }
    agent_task("Write documentation for the identified areas...") {
      model: "claude-sonnet-4-20250514"
      max_turns: 10
      tools: { allowed: ["Read", "Write", "Glob"] }
      output_schema: DocDraft
      output_artifact: "doc-draft"
    }
  }
}
```

### Structured Output Types

Type definitions ensure consistent data flow between agents:

```workpipe
type DocDraft {
  content: string
  sections: [string]
  word_count: int
}

type EditSuggestions {
  suggestions: [string]
  quality_score: int
}
```

### On-Demand Execution

Triggered manually via workflow_dispatch rather than automatically on push/PR:

```workpipe
workflow documentation_team {
  on: workflow_dispatch
  // ...
}
```

## Workflow Graph

```
workflow_dispatch
     |
     v
  analyzer  (scans codebase, outputs doc-needs)
     |
     v
   writer   (creates documentation, outputs doc-draft)
     |
     v
   editor   (improves clarity, outputs edit-suggestions)
     |
     v
  reviewer  (final approval, outputs doc-review)
```

## Agent Configurations

### Analyzer
- **Purpose**: Identify documentation gaps
- **Max Turns**: 5
- **Tools**: Read, Glob, Grep (search/analysis)
- **Output**: doc-needs artifact

### Writer
- **Purpose**: Create documentation content
- **Max Turns**: 10 (more turns for content creation)
- **Tools**: Read, Write, Glob (content creation)
- **Output**: DocDraft with content, sections, word count

### Editor
- **Purpose**: Refine and improve documentation
- **Max Turns**: 5
- **Tools**: Read, Write (editing focus)
- **Output**: EditSuggestions with suggestions and quality score

### Reviewer
- **Purpose**: Final quality assessment
- **Max Turns**: 3 (quick decision)
- **Tools**: Read (review only)
- **Output**: doc-review artifact

## Use Cases

- **Automated Documentation**: Generate docs for undocumented code
- **Documentation Audits**: Identify and fill documentation gaps
- **Content Pipeline**: Multi-stage content refinement
- **Quality Gates**: Ensure documentation meets standards

## Compiling

```bash
workpipe build documentation-team.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
