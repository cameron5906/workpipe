# Release Manager Team Example

Demonstrates a multi-agent release management workflow with sequential pipeline pattern and human approval gate.

## What This Demonstrates

- Sequential pipeline with parallel branches
- Multi-agent collaboration for release automation
- User-defined types for structured release data
- Artifact passing between pipeline stages
- Human approval gate pattern for release control
- Manual workflow trigger (`workflow_dispatch`)

## Key Concepts

### Sequential Pipeline with Parallel Branches

The workflow uses a hybrid sequential/parallel pattern:

1. **Commit Analyzer** runs first (no dependencies)
2. **Version Determiner** and **Changelog Generator** run in parallel (both depend on commit analysis)
3. **Release Notes Writer** waits for both parallel jobs
4. **Human Approval Gate** blocks until release notes are ready
5. **Release Publisher** runs only after approval

```
workflow_dispatch
       |
       v
  commit_analyzer
       |
       +-------+-------+
       |               |
       v               v
version_determiner  changelog_generator
       |               |
       +-------+-------+
               |
               v
       release_notes_writer
               |
               v
       human_approval_gate  <-- requires environment approval
               |
               v
       release_publisher
```

### User-Defined Types

Structured types ensure consistent data flow between agents:

```workpipe
type CommitInfo {
  sha: string
  message: string
  author: string
  category: "feature" | "fix" | "docs" | "chore" | "refactor" | "test" | "breaking"
}

type CommitAnalysis {
  commits: [CommitInfo]
  feature_count: int
  fix_count: int
  breaking_count: int
  summary: string
}

type VersionBump {
  current_version: string
  new_version: string
  bump_type: "major" | "minor" | "patch"
  reason: string
}
```

### Human Approval Gate

The `human_approval_gate` job provides a manual checkpoint before publishing:

```workpipe
job human_approval_gate {
  runs_on: ubuntu-latest
  needs: [release_notes_writer]
  steps {
    uses("actions/download-artifact@v4") { with: { name: "release-notes" } }
    uses("actions/download-artifact@v4") { with: { name: "version-bump" } }
    shell {
      echo "=== RELEASE APPROVAL REQUIRED ==="
      cat version-bump || echo "Version bump artifact not found"
      cat release-notes || echo "Release notes artifact not found"
    }
  }
}
```

To enable actual approval gating in GitHub Actions, you need to:

1. Create a GitHub environment called `production` (or your preferred name)
2. Add required reviewers to that environment
3. Add `environment: production` to the generated YAML file's `human_approval_gate` job

Example of the manual edit needed in the generated YAML:

```yaml
human_approval_gate:
  runs-on: ubuntu-latest
  environment: production  # <-- Add this line
  needs:
    - release_notes_writer
  steps:
    ...
```

### Agents and Their Roles

| Agent | Role | Output |
|-------|------|--------|
| commit_analyzer | Categorizes commits since last release | CommitAnalysis artifact |
| version_determiner | Determines semver bump (major/minor/patch) | VersionBump artifact |
| changelog_generator | Generates formatted changelog entries | ChangelogEntry artifact |
| release_notes_writer | Creates user-friendly release notes | ReleaseNotes artifact |
| release_publisher | Creates GitHub release with tag and notes | ReleaseArtifact artifact |

## Workflow Graph

```
workflow_dispatch
       |
       v
+------------------+
| commit_analyzer  |
|   (categorize)   |
+------------------+
       |
       +---------+---------+
       |                   |
       v                   v
+------------------+ +------------------+
| version_determiner| | changelog_generator|
|   (semver bump)  | |   (format entries) |
+------------------+ +------------------+
       |                   |
       +---------+---------+
               |
               v
    +--------------------+
    | release_notes_writer|
    |   (combine all)    |
    +--------------------+
               |
               v
    +--------------------+
    | human_approval_gate|
    |   (manual review)  |
    +--------------------+
               |
               v
    +--------------------+
    | release_publisher  |
    |   (create release) |
    +--------------------+
```

## Use Cases

- **Automated Release Pipeline**: Streamline the release process from commit analysis to publication
- **Semantic Versioning**: Automatically determine version bumps based on commit history
- **Changelog Generation**: Generate consistent, categorized changelogs
- **Controlled Releases**: Maintain human oversight before publishing releases
- **Release Documentation**: Create user-friendly release notes automatically

## Compiling

```bash
workpipe build release-manager-team.workpipe -o .
```

## Post-Compilation Setup

For the human approval gate to function as a true approval checkpoint:

1. Go to your GitHub repository settings
2. Navigate to Environments
3. Create an environment named `production`
4. Add required reviewers
5. Edit the generated YAML to add `environment: production` to the `human_approval_gate` job

## Output

The workflow produces the following artifacts:

- `commit-analysis`: Categorized commit data
- `version-bump`: Version bump decision and reasoning
- `changelog`: Formatted changelog entries
- `release-notes`: User-friendly release notes
- `release-result`: GitHub release creation result
