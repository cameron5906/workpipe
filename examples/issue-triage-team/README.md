# Issue Triage Team Example

Demonstrates a multi-agent GitHub issue triage workflow with specialized agents analyzing issues from different perspectives, then synthesizing recommendations into a final triage decision.

## What This Demonstrates

- Multi-agent pattern with 6 specialized AI agents
- Fan-out/fan-in workflow topology with parallel and sequential stages
- User-defined types for structured agent outputs
- Artifact passing between parallel and sequential stages
- Dependency management with `needs:` for proper ordering
- Real-world GitHub issue automation pattern

## Key Concepts

### Multi-Agent Triage Pattern

Multiple specialized agents examine the same issue from different perspectives:

```workpipe
agent_job classifier {
  // Classifies as bug/feature/question/enhancement/documentation
}

agent_job priority_assessor {
  // Determines P0-P3 priority based on impact/urgency
}

agent_job label_suggester {
  // Suggests appropriate labels based on content
}

agent_job assignee_recommender {
  // Recommends team members based on expertise
}
```

### Fan-Out/Fan-In Topology

The workflow uses a multi-stage fan-out/fan-in pattern:

1. **First Fan-out**: Classifier and Priority Assessor run in parallel (independent analysis)
2. **Second Fan-out**: Label Suggester and Assignee Recommender run in parallel
3. **Sequential Stage**: Response Drafter needs classification and priority first
4. **Fan-in**: Synthesizer collects all outputs and produces final triage decision

```
                    +-- classifier --------+
                    |                      |
issues (opened) ----+                      +-- response_drafter --+
                    |                      |                      |
                    +-- priority_assessor -+                      |
                    |                                             +-- synthesizer
                    +-- label_suggester --------------------------+
                    |                                             |
                    +-- assignee_recommender ---------------------+
```

### Structured Type Definitions

Type definitions ensure consistent output structure across all agents:

```workpipe
type IssueClassification {
  category: "bug" | "feature" | "question" | "enhancement" | "documentation"
  confidence: float
  reasoning: string
  suggested_template: string
}

type PriorityAssessment {
  priority: "P0" | "P1" | "P2" | "P3"
  impact: "critical" | "high" | "medium" | "low"
  urgency: "immediate" | "soon" | "normal" | "backlog"
  reasoning: string
  affected_users_estimate: string
}

type TriageDecision {
  classification: string
  priority: string
  assigned_labels: [string]
  assigned_to: [string]
  initial_response: string
  action_items: [string]
  triage_summary: string
}
```

### Dependency Management

The `needs:` keyword controls execution order:

```workpipe
// Response drafter waits for classification and priority
agent_job response_drafter {
  needs: [classifier, priority_assessor]
  // ...
}

// Synthesizer waits for all agents to complete
agent_job synthesizer {
  needs: [classifier, priority_assessor, label_suggester, assignee_recommender, response_drafter]
  // ...
}
```

### Artifact Aggregation

The synthesizer downloads all analysis artifacts and combines them:

```workpipe
uses("actions/download-artifact@v4") { with: { pattern: "classification" } }
uses("actions/download-artifact@v4") { with: { pattern: "priority" } }
uses("actions/download-artifact@v4") { with: { pattern: "labels" } }
uses("actions/download-artifact@v4") { with: { pattern: "assignees" } }
uses("actions/download-artifact@v4") { with: { pattern: "response-draft" } }
```

## Workflow Graph

```
issues (opened)
     |
     +---> classifier -----------+
     |                           |
     +---> priority_assessor ----+---> response_drafter ---+
     |                                                     |
     +---> label_suggester --------------------------------+---> synthesizer ---> triage-decision
     |                                                     |
     +---> assignee_recommender ---------------------------+
```

## Agent Responsibilities

| Agent | Focus | Output |
|-------|-------|--------|
| Classifier | Categorize issue type | IssueClassification |
| Priority Assessor | Determine P0-P3 priority | PriorityAssessment |
| Label Suggester | Recommend labels | LabelSuggestion |
| Assignee Recommender | Suggest team members | AssigneeRecommendation |
| Response Drafter | Draft initial reply | ResponseDraft |
| Synthesizer | Combine all recommendations | TriageDecision |

## Trigger Configuration

The workflow triggers on issue events:

```workpipe
on: issues
```

## Use Cases

- **Automated Issue Triage**: Reduce manual triage burden on maintainers
- **Consistent Categorization**: Apply uniform classification standards
- **Faster Response Times**: Auto-draft initial responses to reporters
- **Smart Routing**: Route issues to appropriate team members
- **Label Automation**: Apply consistent labeling based on content analysis

## Compiling

```bash
workpipe build issue-triage-team.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.

The workflow produces the following artifacts:

- `classification` - Issue category and reasoning
- `priority` - Priority level with impact/urgency assessment
- `labels` - Suggested labels organized by type
- `assignees` - Recommended team members with expertise matching
- `response-draft` - Ready-to-post initial response
- `triage-decision` - Final synthesized triage action
