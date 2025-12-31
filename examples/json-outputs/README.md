# JSON Outputs Example

A workflow demonstrating the `json` type for passing structured data between jobs.

## What This Demonstrates

- Declaring `json` typed outputs on jobs
- Setting JSON output values using escaped JSON strings
- Consuming JSON outputs with `fromJSON()` in expressions
- Accessing nested fields from JSON objects

## Key Concepts

1. **JSON output declaration**: `outputs: { build_info: json }` declares a structured output
2. **Setting JSON values**: Use escaped JSON in echo: `echo "key={\"field\":\"value\"}" >> $GITHUB_OUTPUT`
3. **fromJSON() function**: Parse JSON in expressions: `${{ fromJSON(needs.job.outputs.data).field }}`
4. **Property access**: After parsing, access properties with dot notation: `.version`, `.replicas`

## Source

```workpipe
workflow json_outputs {
  on: push

  job gather_info {
    runs_on: ubuntu-latest
    outputs: {
      build_info: json
      deploy_config: json
    }
    steps: [
      run("echo \"build_info={\\\"version\\\":\\\"2.1.0\\\",\\\"commit\\\":\\\"${{ github.sha }}\\\"}\" >> $GITHUB_OUTPUT"),
      run("echo \"deploy_config={\\\"env\\\":\\\"staging\\\",\\\"replicas\\\":3}\" >> $GITHUB_OUTPUT")
    ]
  }

  job process_info {
    runs_on: ubuntu-latest
    needs: [gather_info]
    steps: [
      run("echo Build version: ${{ fromJSON(needs.gather_info.outputs.build_info).version }}"),
      run("echo Deploy env: ${{ fromJSON(needs.gather_info.outputs.deploy_config).env }}"),
      run("echo Replicas: ${{ fromJSON(needs.gather_info.outputs.deploy_config).replicas }}")
    ]
  }
}
```

## Compiling

```bash
workpipe build json-outputs.workpipe -o .
```

## Output

See [expected.yml](./expected.yml) for the generated GitHub Actions YAML.

## Important Caveats

### Size Limits

GitHub Actions limits output values to approximately 1MB. For larger structured data, use artifacts instead of JSON outputs.

### fromJSON() is Required

JSON outputs are strings at runtime. You must use `fromJSON()` to parse them before accessing properties:

```workpipe
// WRONG: Accesses the raw string, not the parsed object
run("echo ${{ needs.job.outputs.data }}.version")

// CORRECT: Parse first, then access properties
run("echo ${{ fromJSON(needs.job.outputs.data).version }}")
```

### Shell Escaping

Building JSON inline requires careful escaping. Each level of quoting adds escape characters:

```workpipe
// Escaped JSON in WorkPipe string (note the triple backslashes)
run("echo \"data={\\\"key\\\":\\\"value\\\"}\" >> $GITHUB_OUTPUT")
```

For complex JSON, consider using a script file or the GitHub Actions `toJSON()` function where applicable.

### No Compile-Time Validation

WorkPipe cannot verify that fields you access via `fromJSON()` exist. Typos like `.vesion` instead of `.version` will fail at runtime.

## When to Use JSON vs Alternatives

| Scenario | Use JSON | Use Artifacts |
|----------|----------|---------------|
| Small structured data (<1MB) | Yes | Overkill |
| Need data in `${{ }}` expressions | Yes | No (expressions cannot read artifact files) |
| Large files or binary data | No | Yes |
| Data needed by many downstream jobs | Yes | Yes (but each job re-downloads) |

## See Also

- [Job Outputs Example](../job-outputs/) - Basic typed outputs (string, int, bool)
- [Language Reference: The json Type](../../docs/language-reference.md#the-json-type) - Full documentation
