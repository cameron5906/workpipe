# Incident Response Team Example

Demonstrates a multi-agent workflow for production incident response with parallel investigation, sequential hotfix drafting, and a human approval gate.

## What This Demonstrates

- Multi-agent incident response pattern
- Sequential-then-parallel workflow topology
- Human approval gates for hotfix deployment
- Artifact passing for incident context
- Structured output schemas for incident reports
- Postmortem generation independent of hotfix approval

## Key Concepts

### Incident Response Pipeline

The workflow coordinates multiple specialized agents to investigate, assess, and respond to production incidents:

```
log_analyzer
     |
     +---> root_cause_investigator ---> hotfix_drafter ---> hotfix_approval
     |                                                              |
     +---> impact_assessor ---------------------------------------+
                    |
                    +---> postmortem_writer (runs independently)
```

### Agent Roles

| Agent | Purpose |
|-------|---------|
| Log Analyzer | Analyzes logs for error patterns, anomalies, timeline |
| Root Cause Investigator | Deep investigation to identify the source of the issue |
| Impact Assessor | Determines scope, affected users, business impact |
| Hotfix Drafter | Proposes minimal code changes with rollback plan |
| Postmortem Writer | Documents the incident for future reference |

### Parallel Investigation

After log analysis completes, two agents run in parallel:
- **Root Cause Investigator**: Traces errors back to their origin
- **Impact Assessor**: Evaluates the blast radius of the incident

```workpipe
agent_job root_cause_investigator {
  needs: [log_analyzer]
  // ...
}

agent_job impact_assessor {
  needs: [log_analyzer]
  // ...
}
```

### Human Approval Gate

The hotfix requires human approval before deployment. This is implemented as a job that displays the proposed changes and waits for review:

```workpipe
job hotfix_approval {
  runs_on: ubuntu-latest
  needs: [hotfix_drafter, impact_assessor]
  steps {
    // Download and display artifacts for review
    // Actual approval happens via GitHub Environment protection rules
  }
}
```

To enable the approval gate:

1. Go to **Settings > Environments** in your GitHub repository
2. Create an environment named `hotfix-approval`
3. Enable **Required reviewers**
4. Add team members authorized to approve hotfixes

When the workflow runs, it will pause at `hotfix_approval` until an authorized reviewer approves.

### Independent Postmortem

The postmortem writer runs after root cause and impact assessment are complete, but does not depend on hotfix approval:

```workpipe
agent_job postmortem_writer {
  runs_on: ubuntu-latest
  needs: [root_cause_investigator, impact_assessor]
  // ...
}
```

This allows documentation to proceed in parallel with the approval process.

### Structured Type Definitions

All agents produce structured outputs for consistency:

```workpipe
type LogAnalysis {
  error_patterns: [LogPattern]
  anomalies: [string]
  affected_services: [string]
  timeline_summary: string
}

type RootCauseReport {
  root_cause: string
  contributing_factors: [string]
  evidence: [string]
  confidence_level: "high" | "medium" | "low"
  affected_components: [string]
}

type ImpactAssessment {
  scope: "critical" | "major" | "minor" | "negligible"
  affected_users: string
  data_impact: string
  service_degradation: [string]
  estimated_duration: string
  business_impact: string
}

type HotfixDraft {
  proposed_changes: [string]
  affected_files: [string]
  risk_assessment: "high" | "medium" | "low"
  testing_notes: string
  rollback_plan: string
}

type PostmortemDoc {
  incident_summary: string
  timeline: [string]
  root_cause: string
  resolution: string
  action_items: [string]
  lessons_learned: [string]
}
```

## Workflow Graph

```
workflow_dispatch
       |
       v
  log_analyzer
       |
       +---------------+
       |               |
       v               v
root_cause     impact_assessor
       |               |
       v               |
hotfix_drafter        |
       |               |
       +-------+-------+
               |
       +-------+-------+
       |               |
       v               v
hotfix_approval  postmortem_writer
```

## Use Cases

- **Production Outages**: Rapid investigation and response to service disruptions
- **Security Incidents**: Analyze breach patterns and draft remediation
- **Performance Degradation**: Identify root causes of slowdowns
- **Data Inconsistencies**: Trace data corruption to its source

## Trigger Configuration

The workflow uses `workflow_dispatch` for on-demand triggering:

```workpipe
workflow incident_response_team {
  on: workflow_dispatch
  // ...
}
```

To trigger the workflow, go to **Actions > incident_response_team > Run workflow** in GitHub.

## Compiling

```bash
workpipe build incident-response-team.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
