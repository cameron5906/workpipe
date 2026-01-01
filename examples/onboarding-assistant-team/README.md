# Onboarding Assistant Team Example

Demonstrates a multi-agent workflow that generates comprehensive onboarding materials for new developers using a fan-out/fan-in pattern.

## What This Demonstrates

- Multi-agent content generation with 5 specialized AI agents
- Fan-out/fan-in workflow topology
- Artifact passing between parallel and sequential stages
- Structured output schemas for onboarding materials
- Knowledge synthesis from multiple specialized generators

## Key Concepts

### Multi-Agent Content Generation

Multiple specialized agents analyze the same codebase from different perspectives. Each agent generates a specific type of onboarding content:

```workpipe
agent_job tour_generator {
  runs_on: ubuntu-latest
  steps {
    uses("actions/checkout@v4") {}
    agent_task("Analyze the codebase structure...") {
      model: "claude-sonnet-4-20250514"
      max_turns: 8
      tools: { allowed: ["Read", "Glob", "Grep", "Bash"] }
      output_schema: CodebaseTour
      output_artifact: "onboarding-tour"
    }
  }
}
```

### Fan-Out/Fan-In Topology

The workflow uses a fan-out/fan-in pattern:
1. **Fan-out**: Four content generators run in parallel
2. **Fan-in**: A knowledge compiler synthesizes all outputs into a comprehensive package

```
                        +-- tour_generator --------+
                        |                          |
workflow_dispatch --+-- faq_builder -----------+-- knowledge_compiler --> onboarding-package
                        |                          |
                        +-- example_finder --------+
                        |                          |
                        +-- getting_started -------+
```

### Structured Type Definitions

Type definitions ensure consistent output structure across all agents:

```workpipe
type TourSection {
  name: string
  directory: string
  purpose: string
  key_files: [string]
  related_sections: [string]
}

type CodebaseTour {
  project_name: string
  overview: string
  sections: [TourSection]
  architecture_summary: string
  navigation_tips: [string]
}

type OnboardingPackage {
  generated_at: string
  project_name: string
  tour_summary: string
  faq_highlights: [string]
  quick_start_steps: [string]
  key_examples: [string]
  next_steps: [string]
}
```

### Artifact Aggregation

The knowledge compiler downloads all onboarding artifacts and combines them:

```workpipe
uses("actions/download-artifact@v4") { with: { pattern: "onboarding-*" } }
```

## Workflow Graph

```
workflow_dispatch
     |
     +---> tour_generator ------+
     |                          |
     +---> faq_builder ---------+---> knowledge_compiler ---> onboarding-package artifact
     |                          |
     +---> example_finder ------+
     |                          |
     +---> getting_started -----+
```

## Agent Responsibilities

| Agent | Output Type | Purpose |
|-------|-------------|---------|
| Tour Generator | CodebaseTour | Creates guided tour of codebase structure |
| FAQ Builder | FAQSection | Generates FAQ from patterns and documentation |
| Example Finder | ExampleCollection | Curates relevant code examples |
| Getting Started Updater | GettingStartedGuide | Creates setup and first-steps guide |
| Knowledge Compiler | OnboardingPackage | Synthesizes everything into comprehensive package |

## Type Definitions

The workflow defines the following types:

- **TourSection**: A section of the codebase tour with directory, purpose, and key files
- **CodebaseTour**: Complete codebase tour with sections and navigation tips
- **FAQEntry**: Single FAQ question and answer with category
- **FAQSection**: Collection of FAQ entries for a category
- **CodeExample**: Curated code example with complexity level
- **ExampleCollection**: Collection of examples with learning path
- **SetupStep**: Step in the getting started guide with troubleshooting
- **GettingStartedGuide**: Prerequisites, setup steps, and first tasks
- **OnboardingPackage**: Synthesized summary of all onboarding materials

## Use Cases

- **New Hire Onboarding**: Generate up-to-date onboarding materials automatically
- **Documentation Refresh**: Schedule weekly regeneration to keep materials current
- **Project Handoffs**: Create comprehensive knowledge transfer packages
- **Open Source Projects**: Help new contributors get productive quickly

## Triggers

The workflow supports manual triggering via `workflow_dispatch`, allowing on-demand generation of onboarding materials.

## Compiling

```bash
workpipe build onboarding-assistant-team.workpipe -o .
```

## Output

The workflow produces the following artifacts:

- `onboarding-tour` - Codebase tour with structure and navigation
- `onboarding-faq` - FAQ entries organized by category
- `onboarding-examples` - Curated code examples with learning path
- `onboarding-getting-started` - Setup steps and first tasks
- `onboarding-package` - Synthesized comprehensive onboarding package
