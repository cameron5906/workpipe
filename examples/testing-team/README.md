# Testing Team Example

Demonstrates a multi-agent testing workflow with change-driven test generation, execution, coverage analysis, and flaky test detection using a staged fan-out/fan-in pattern.

## What This Demonstrates

- Change-driven test generation workflow with 6 specialized AI agents
- Staged fan-out/fan-in topology (detect -> generate -> execute -> analyze -> synthesize)
- Reusable job fragment for test writers (available for parallel scenarios)
- Artifact passing between sequential and parallel stages
- Structured output schemas for test plans, results, and reports
- Parallel analysis (coverage + flaky detection) after test execution

## Key Concepts

### Change-Driven Testing Pattern

The workflow starts by analyzing what changed, then generates appropriate tests:

```workpipe
agent_job change_detector {
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") { with: { fetch_depth: 0 } }
    agent_task("Analyze the PR diff to identify changed files...") {
      output_schema: ChangeAnalysis
      output_artifact: "change-analysis"
    }
  }
}
```

### Staged Fan-Out/Fan-In Topology

The workflow uses a multi-stage pattern:
1. **Stage 1**: Change detector analyzes the PR
2. **Stage 2**: Unit and integration test writers run in parallel (both depend on change_detector)
3. **Stage 3**: Test executor runs all generated tests
4. **Stage 4**: Coverage analyzer and flaky detector run in parallel (both depend on test_executor)
5. **Stage 5**: Final synthesis combines all results

```
                                    +-- coverage_analyzer --+
                                    |                       |
PR --> change_detector --+--> unit_test_writer ----+--> test_executor --+--> test_summary
                         |                         |                    |
                         +--> integration_writer --+                    |
                                                                        |
                                    +-- flaky_detector ----------------+
```

### Structured Type Definitions

Type definitions ensure consistent output structure across all agents:

```workpipe
type ChangeAnalysis {
  changed_files: [ChangedFile]
  affected_modules: [string]
  test_priority: "high" | "medium" | "low"
  summary: string
}

type TestPlan {
  test_cases: [TestCase]
  coverage_targets: [string]
  estimated_coverage_increase: int
  notes: string
}

type TestResult {
  total_tests: int
  passed: int
  failed: int
  skipped: int
  executions: [TestExecution]
  summary: string
}

type CoverageReport {
  overall_coverage: int
  line_coverage: int
  branch_coverage: int
  uncovered_paths: [UncoveredPath]
  recommendations: [string]
}

type FlakyTestReport {
  flaky_tests: [FlakyIndicator]
  total_analyzed: int
  high_risk_count: int
  summary: string
}
```

### Reusable Test Writer Fragment

The workflow includes a reusable `test_writer` fragment that can be used for parallel test generation scenarios (without dependencies):

```workpipe
job_fragment test_writer {
  params {
    test_type: string
    focus_description: string
    writer_name: string
  }
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    uses("actions/download-artifact@v4") { with: { name: "change-analysis" } }
    agent_task("Based on the change analysis artifact, write ${{ params.test_type }} tests...") {
      output_schema: TestPlan
      output_artifact: "test-plan-${{ params.writer_name }}"
    }
  }
}
```

### Parallel Test Writers with Dependencies

Since the test writers need the change_detector output, they use `agent_job` with `needs:` for proper dependency ordering while still running in parallel with each other:

```workpipe
agent_job unit_test_writer {
  runs_on: ubuntu-latest
  needs: [change_detector]
  steps {
    uses("actions/checkout@v4") {}
    uses("actions/download-artifact@v4") { with: { name: "change-analysis" } }
    agent_task("Write unit tests focusing on functions, edge cases, error handling...") {
      output_schema: TestPlan
      output_artifact: "test-plan-unit"
    }
  }
}

agent_job integration_test_writer {
  runs_on: ubuntu-latest
  needs: [change_detector]
  steps {
    // Similar pattern for integration tests
  }
}
```

## Workflow Graph

```
pull_request
     |
     v
change_detector (Stage 1: Analyze changes)
     |
     +---> unit_test_writer --------+
     |                              |
     +---> integration_test_writer -+
                                    |
                                    v
                            test_executor (Stage 3: Run tests)
                                    |
     +------------------------------+------------------------------+
     |                                                             |
     v                                                             v
coverage_analyzer (Stage 4a)                          flaky_detector (Stage 4b)
     |                                                             |
     +------------------------------+------------------------------+
                                    |
                                    v
                            test_summary (Stage 5: Final report)
                                    |
                                    v
                          final-test-report artifact
```

## Agent Responsibilities

| Agent | Purpose |
|-------|---------|
| Change Detector | Analyzes PR diff to identify what changed and testing priorities |
| Unit Test Writer | Generates unit tests for functions, edge cases, error handling |
| Integration Test Writer | Generates integration tests for APIs and module interactions |
| Test Executor | Runs the generated test suite and collects results |
| Coverage Analyzer | Identifies uncovered code paths and coverage gaps |
| Flaky Detector | Identifies tests with flakiness indicators and risk scores |

## Use Cases

- **PR Test Generation**: Automatically generate tests for changed code
- **Coverage Enforcement**: Identify and address coverage gaps before merge
- **Test Quality Gates**: Detect potentially flaky tests before they cause CI issues
- **Test Prioritization**: Focus testing effort on high-risk changes
- **Documentation**: Generate test documentation alongside test code

## Compiling

```bash
workpipe build testing-team.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
