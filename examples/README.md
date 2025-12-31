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
| [release-workflow](./release-workflow/) | Manual release process | `workflow_dispatch`, fan-in pattern |
| [iterative-refinement](./iterative-refinement/) | AI doc improvement cycle | Cycles with agent tasks |
| [matrix-build](./matrix-build/) | Multi-config builds | *Planned* - matrix axes, sharding |

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

## Contributing Examples

When adding new examples:

1. Create a directory matching the example name
2. Add the `.workpipe` source file
3. Generate `expected.yml` with `workpipe build`
4. Write a README explaining key concepts
5. Update this index table
