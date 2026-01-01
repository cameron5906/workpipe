# WorkPipe

**Write workflows in minutes, not hours.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)

WorkPipe is a domain-specific language that compiles to GitHub Actions YAML. Write expressive, type-safe CI/CD pipelines with a clean syntax that eliminates the verbosity and foot-guns of raw YAML.

---

## The Problem

GitHub Actions YAML is powerful but painful. Complex workflows become walls of repetitive configuration. Matrix builds, job outputs, and conditional logic create deeply nested structures that are hard to read, harder to maintain, and easiest to break.

## The Solution

WorkPipe gives you the same power with a fraction of the complexity.

### Before: 72 lines of YAML

```yaml
name: microservices_build
on:
  - push
  - pull_request
jobs:
  build_api:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.build.outputs.image_tag }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - id: build
        run: |
          docker build -t myorg/api:${{ github.sha }} ./services/api
          echo image_tag=myorg/api:${{ github.sha }} >> $GITHUB_OUTPUT
  build_web:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.build.outputs.image_tag }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - id: build
        run: |
          docker build -t myorg/web:${{ github.sha }} ./services/web
          echo image_tag=myorg/web:${{ github.sha }} >> $GITHUB_OUTPUT
  test_api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd services/api && npm ci && npm run test:unit
  test_web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cd services/web && npm ci && npm run test:unit
  integration_tests:
    runs-on: ubuntu-latest
    needs: [build_api, build_web, test_api, test_web]
    steps:
      - uses: actions/checkout@v4
      - run: docker-compose -f docker-compose.test.yml up -d
      - run: sleep 30
      - run: npm run test:integration
      - run: docker-compose -f docker-compose.test.yml down
  e2e_tests:
    runs-on: ubuntu-latest
    needs: [integration_tests]
    steps:
      - uses: actions/checkout@v4
      - run: docker-compose -f docker-compose.e2e.yml up -d
      - run: npx playwright test
      - run: docker-compose -f docker-compose.e2e.yml down
  publish_images:
    runs-on: ubuntu-latest
    needs: [e2e_tests]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: echo Publishing all service images
```

### After: 52 lines of WorkPipe

```workpipe
workflow microservices_build {
  on: [push, pull_request]

  job build_api {
    runs_on: ubuntu-latest
    outputs: { image_tag: string }
    steps {
      uses("actions/checkout@v4") {}
      uses("docker/setup-buildx-action@v3") {}
      shell { docker build -t myorg/api:${{ github.sha }} ./services/api }
      shell { echo image_tag=myorg/api:${{ github.sha }} >> $GITHUB_OUTPUT }
    }
  }

  job build_web {
    runs_on: ubuntu-latest
    outputs: { image_tag: string }
    steps {
      uses("actions/checkout@v4") {}
      uses("docker/setup-buildx-action@v3") {}
      shell { docker build -t myorg/web:${{ github.sha }} ./services/web }
      shell { echo image_tag=myorg/web:${{ github.sha }} >> $GITHUB_OUTPUT }
    }
  }

  job test_api {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      shell { cd services/api && npm ci && npm run test:unit }
    }
  }

  job test_web {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      shell { cd services/web && npm ci && npm run test:unit }
    }
  }

  job integration_tests {
    runs_on: ubuntu-latest
    needs: [build_api, build_web, test_api, test_web]
    steps {
      uses("actions/checkout@v4") {}
      shell { docker-compose -f docker-compose.test.yml up -d }
      shell { sleep 30 }
      shell { npm run test:integration }
      shell { docker-compose -f docker-compose.test.yml down }
    }
  }

  job e2e_tests {
    runs_on: ubuntu-latest
    needs: [integration_tests]
    steps {
      uses("actions/checkout@v4") {}
      shell { docker-compose -f docker-compose.e2e.yml up -d }
      shell { npx playwright test }
      shell { docker-compose -f docker-compose.e2e.yml down }
    }
  }

  job publish_images {
    runs_on: ubuntu-latest
    needs: [e2e_tests]
    if: github.ref == "refs/heads/main"
    steps {
      uses("actions/checkout@v4") {}
      shell { echo Publishing all service images }
    }
  }
}
```

Less noise. Same power. Compile-time validation catches errors before you push.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **User-Defined Types** | Define reusable data structures with compile-time property validation |
| **Cross-File Imports** | Share type definitions across workflows with `import { Type } from "./path"` |
| **AI Agent Tasks** | Integrate Claude directly into workflows with structured output schemas |
| **Smart Cycles** | Iterative workflows that span multiple runs with automatic state management |
| **Guards** | Conditional job execution with JavaScript expressions |
| **Matrix Builds** | First-class matrix support with typed axes and fingerprinting |
| **Typed Outputs** | Declare job outputs with types; the compiler validates references |
| **Clean Syntax** | No YAML indentation anxiety; brackets and braces make structure explicit |
| **Escape Hatches** | Use `raw_yaml` blocks for edge cases not yet in the DSL |

---

## Quick Start

**Prerequisites:** Node.js 20+

```bash
# Install globally
npm install -g @workpipe/cli

# Verify installation
workpipe --version

# Create your first workflow
mkdir -p workpipe
```

Create `workpipe/ci.workpipe`:

```workpipe
workflow ci {
  on: [push, pull_request]

  job test {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      uses("actions/setup-node@v4") {
        with: { node-version: "20" }
      }
      shell {
        npm ci
        npm test
      }
    }
  }
}
```

Compile and commit:

```bash
# Compile to GitHub Actions YAML
workpipe build workpipe/ci.workpipe

# Review the generated workflow
cat .github/workflows/ci.yml

# Commit both files
git add workpipe/ci.workpipe .github/workflows/ci.yml
git commit -m "Add CI workflow with WorkPipe"
git push
```

Your workflow is now live on GitHub Actions.

---

## Example Showcase

### AI-Powered Code Review

Integrate Claude directly into your CI pipeline with structured output:

```workpipe
type ReviewResult {
  approved: bool
  rating: int
  issues: [{ filepath: string line: int severity: string message: string }]
}

workflow review {
  on: pull_request

  agent_job code_review {
    runs_on: ubuntu-latest
    steps {
      uses("actions/checkout@v4") {}
      agent_task("Review the code changes and provide structured feedback") {
        model: "claude-sonnet-4-20250514"
        max_turns: 5
        tools: { allowed: ["Read", "Glob", "Grep"] }
        output_schema: "ReviewResult"
        output_artifact: "review_result"
      }
    }
  }
}
```

### Iterative Refinement Cycles

Build workflows that iterate until a quality threshold is met:

```workpipe
workflow quality_gate {
  on: push

  cycle refine_loop {
    max_iters = 5
    until guard_js """
      return context.quality_score > 0.95;
    """

    body {
      agent_job analyze {
        runs_on: ubuntu-latest
        steps {
          agent_task("Analyze and improve code quality") {
            model: "claude-sonnet-4-20250514"
            max_turns: 10
          }
        }
      }

      job apply_fixes {
        runs_on: ubuntu-latest
        needs: analyze
        steps {
          shell { echo Applying fixes from analysis }
        }
      }
    }
  }
}
```

### Multi-Environment Deployment

Clean job dependencies with typed outputs:

```workpipe
workflow deploy {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: { image_tag: string }
    steps {
      uses("actions/checkout@v4") {}
      shell { docker build -t myapp:${{ github.sha }} . }
      shell { echo image_tag=myapp:${{ github.sha }} >> $GITHUB_OUTPUT }
    }
  }

  job deploy_staging {
    runs_on: ubuntu-latest
    needs: [build]
    environment: staging
    steps {
      shell { echo Deploying ${{ needs.build.outputs.image_tag }} to staging }
    }
  }

  job deploy_production {
    runs_on: ubuntu-latest
    needs: [deploy_staging]
    environment: production
    steps {
      shell { echo Deploying to production }
    }
  }
}
```

See the [examples/](examples/) directory for more complete workflows.

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `workpipe build [files...]` | Compile `.workpipe` files to GitHub Actions YAML |
| `workpipe check [files...]` | Validate syntax and semantics without generating output |
| `workpipe fmt [files...]` | Format source files consistently |
| `workpipe init --bootstrap` | Generate a WorkPipe auto-compile workflow |

---

## Documentation

| Resource | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Full walkthrough from installation to first workflow |
| [Language Reference](docs/language-reference.md) | Complete syntax and semantics documentation |
| [CLI Reference](docs/cli-reference.md) | All commands, flags, and options |
| [VS Code Extension](docs/vscode-extension.md) | Syntax highlighting and editor integration |
| [Troubleshooting](docs/troubleshooting.md) | Common errors and how to fix them |
| [Examples](examples/) | Real-world workflow examples |

---

## Project Status

WorkPipe is in active development. The current release includes:

- **5 packages:** `@workpipe/cli`, `@workpipe/compiler`, `@workpipe/lang`, `@workpipe/action`, VS Code extension
- **1000+ passing tests** covering lexer, parser, semantic analysis, and code generation
- **Full compiler pipeline** with comprehensive error diagnostics

---

## Contributing

Contributions are welcome! Please see:

- [GitHub Issues](https://github.com/your-org/workpipe/issues) for bug reports and feature requests
- [Pull Requests](https://github.com/your-org/workpipe/pulls) for code contributions

---

## License

MIT
