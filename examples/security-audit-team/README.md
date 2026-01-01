# Security Audit Team Example

Demonstrates a multi-scanner security audit workflow with parallel scanning, risk aggregation, and remediation planning.

## What This Demonstrates

- Multi-scanner pattern with parallel security analyzers
- Risk aggregation from multiple scan sources
- Sequential remediation planning based on aggregated findings
- Hybrid parallel/sequential workflow topology
- Structured output schemas for security findings
- Multi-trigger workflow (push and pull_request)

## Key Concepts

### Multi-Scanner Pattern

Three specialized scanners run in parallel, each focusing on a different security domain:

```workpipe
agent_job dependency_scanner { ... }  // Known vulnerabilities in dependencies
agent_job code_scanner { ... }        // OWASP Top 10, code vulnerabilities
agent_job secrets_scanner { ... }     // Exposed credentials and secrets
```

### Parallel Scanning

All three scanners run concurrently without dependencies, maximizing efficiency:

```
push/pull_request
      |
      +---> dependency_scanner --+
      |                          |
      +---> code_scanner --------+---> risk_analyzer ---> remediation_planner
      |                          |
      +---> secrets_scanner -----+
```

### Risk Aggregation

The risk analyzer collects all scan results and produces a unified risk assessment:

```workpipe
agent_job risk_analyzer {
  runs_on: ubuntu-latest
  needs: [dependency_scanner, code_scanner, secrets_scanner]
  steps {
    uses("actions/checkout@v4") {}
    uses("actions/download-artifact@v4") { with: { pattern: "*-scan" } }
    agent_task("Analyze all scan results and produce a comprehensive risk assessment...") {
      model: "claude-sonnet-4-20250514"
      max_turns: 5
      tools: { allowed: ["Read"] }
      output_schema: AuditReport
      output_artifact: "audit-report"
    }
  }
}
```

### Structured Security Types

Type definitions ensure consistent security finding format:

```workpipe
type SecurityFinding {
  severity: "critical" | "high" | "medium" | "low"
  category: string
  location: string
  description: string
  recommendation: string
}

type AuditReport {
  findings: [SecurityFinding]
  critical_count: int
  risk_level: "high" | "medium" | "low"
}

type RemediationPlan {
  action_steps: [string]
  estimated_effort: string
  priority_order: [string]
}
```

### Multi-Trigger Activation

Workflow runs on both push and pull_request events for comprehensive coverage:

```workpipe
workflow security_audit_team {
  on: [push, pull_request]
  // ...
}
```

## Workflow Graph

```
push/pull_request
       |
       +-------> dependency_scanner (deps-scan) -----+
       |                                              |
       +-------> code_scanner (code-scan) -----------+---> risk_analyzer (audit-report)
       |                                              |            |
       +-------> secrets_scanner (secrets-scan) -----+            |
                                                                   v
                                                     remediation_planner (remediation-plan)
```

## Scanner Configurations

| Scanner | Focus | Max Turns | Tools |
|---------|-------|-----------|-------|
| Dependency Scanner | Known CVEs in packages | 5 | Read, Bash, Glob |
| Code Scanner | OWASP Top 10 vulnerabilities | 7 | Read, Glob, Grep |
| Secrets Scanner | Exposed credentials | 3 | Read, Glob, Grep |

### Dependency Scanner
- Checks package.json, requirements.txt, go.mod, etc.
- Uses Bash tool for running dependency analysis commands
- Quick scan with 5 max turns

### Code Scanner
- Comprehensive OWASP Top 10 analysis
- SQL injection, XSS, CSRF, path traversal
- More thorough with 7 max turns

### Secrets Scanner
- API keys, passwords, tokens, private keys
- Pattern matching in source and config files
- Focused scan with 3 max turns

## Aggregation and Planning

### Risk Analyzer
- Collects all *-scan artifacts
- Produces unified AuditReport with severity counts
- Calculates overall risk level

### Remediation Planner
- Creates prioritized action plan
- Estimates effort for fixes
- Orders by severity/impact

## Use Cases

- **CI/CD Security Gates**: Block deployments with critical findings
- **PR Security Review**: Automated security checks on pull requests
- **Continuous Security Monitoring**: Scan on every push
- **Compliance Auditing**: Document security posture

## Compiling

```bash
workpipe build security-audit-team.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
