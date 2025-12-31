# WorkPipe Examples

This directory contains example WorkPipe specifications and their generated GitHub Actions workflows.

## Example Index

| Example | Description | Key Features |
|---------|-------------|--------------|
| [minimal](./minimal/) | Simplest possible workflow | Basic syntax, single job |
| [simple-job](./simple-job/) | Multiple jobs with dependencies | `needs`, `if` conditions, `uses()` |
| [agent-task](./agent-task/) | AI-powered code review | Claude Code integration, tool restrictions |
| [cycle-basic](./cycle-basic/) | Iterative refinement loop | Cycles, guard conditions, phased execution |
| [ci-pipeline](./ci-pipeline/) | Standard CI workflow | Parallel jobs, dependency chains |
| [job-outputs](./job-outputs/) | Typed job outputs | Output declarations, cross-job data passing |
| [release-workflow](./release-workflow/) | Manual release process | `workflow_dispatch`, fan-in pattern |
| [iterative-refinement](./iterative-refinement/) | AI doc improvement cycle | Cycles with agent tasks |
| [enterprise-e2e-pipeline](./enterprise-e2e-pipeline/) | Enterprise testing pipeline | Parallel tests, `if: always()`, teardown |
| [multi-environment-deploy](./multi-environment-deploy/) | Build-once deploy-many | Environment promotion, approval gates |
| [microservices-build](./microservices-build/) | Parallel service builds | Fan-out/fan-in, multi-stage testing |

## Running Examples

Each example can be compiled using the WorkPipe CLI:

```bash
# Compile a single example
workpipe build examples/minimal/minimal.workpipe -o examples/minimal/

# Compile all examples
workpipe build examples/**/*.workpipe
```

## Example Structure

Each example directory contains:

- `*.workpipe` - The WorkPipe source specification
- `expected.yml` - The generated GitHub Actions YAML
- `README.md` - Documentation explaining the example

## Learning Path

1. **Start here**: [minimal](./minimal/) - understand basic syntax
2. **Add complexity**: [simple-job](./simple-job/) - learn job dependencies
3. **CI patterns**: [ci-pipeline](./ci-pipeline/) - parallel stages and conditionals
4. **Release patterns**: [release-workflow](./release-workflow/) - manual triggers and fan-in
5. **AI integration**: [agent-task](./agent-task/) - Claude Code for automation
6. **Advanced**: [cycle-basic](./cycle-basic/) and [iterative-refinement](./iterative-refinement/) - iterative workflows
7. **Enterprise**: [enterprise-e2e-pipeline](./enterprise-e2e-pipeline/) - complex testing pipelines with cleanup
8. **Deployment**: [multi-environment-deploy](./multi-environment-deploy/) - build-once deploy-many pattern
9. **Microservices**: [microservices-build](./microservices-build/) - parallel service builds with fan-out/fan-in

## Contributing Examples

When adding new examples:

1. Create a directory matching the example name
2. Add the `.workpipe` source file
3. Generate `expected.yml` with `workpipe build`
4. Write a README explaining key concepts
5. Update this index table
