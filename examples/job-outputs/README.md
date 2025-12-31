# Job Outputs Example

A workflow demonstrating typed job outputs and cross-job data passing.

## What This Demonstrates

- Typed output declarations on jobs
- Setting outputs using `$GITHUB_OUTPUT`
- Consuming outputs from dependent jobs via `needs`

## Key Concepts

1. **Typed outputs**: `outputs: { version: string, build_number: int }` declares what the job produces
2. **Setting outputs**: Use `echo "key=value" >> $GITHUB_OUTPUT` in run steps
3. **Cross-job references**: `${{ needs.build.outputs.version }}` accesses outputs from dependencies

## Source

```workpipe
workflow job_outputs {
  on: push

  job build {
    runs_on: ubuntu-latest
    outputs: {
      version: string
      build_number: int
    }
    steps: [
      run("echo \"version=1.2.3\" >> $GITHUB_OUTPUT"),
      run("echo \"build_number=42\" >> $GITHUB_OUTPUT")
    ]
  }

  job deploy {
    runs_on: ubuntu-latest
    needs: [build]
    steps: [
      run("echo Deploying v${{ needs.build.outputs.version }} (build ${{ needs.build.outputs.build_number }})")
    ]
  }
}
```

## Compiling

```bash
workpipe build job-outputs.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.
