# Typed Release Pipeline Example

This example demonstrates cross-file type imports for a release workflow. Types are defined in a separate file and imported into the workflow, enabling type reuse across multiple workflows.

## Features

- **Cross-File Imports**: Types defined in separate files for reuse
- **Nested Types**: Complex types that reference other types
- **String Literal Types**: Enum-like constraints using union literals
- **Array Types**: Collections of structured data

## File Structure

```
typed-release-pipeline/
  types/
    release.workpipe    # Shared type definitions
  typed-release-pipeline.workpipe  # Main workflow
  README.md
```

## Type Definitions

### types/release.workpipe

```workpipe
type Version {
  major: int
  minor: int
  patch: int
}

type ChangelogEntry {
  change_type: "feature" | "fix" | "breaking"
  description: string
  pr_number: int
}

type ReleaseManifest {
  version: Version
  changelog: [ChangelogEntry]
  published_at: string
}
```

#### Version Type
Semantic versioning components:
- `major`: Breaking changes increment
- `minor`: Feature additions increment
- `patch`: Bug fixes increment

#### ChangelogEntry Type
Individual changelog items with:
- `change_type`: String literal union limiting values to "feature", "fix", or "breaking"
- `description`: Human-readable change description
- `pr_number`: Reference to the pull request

Note: Field names cannot be reserved keywords like `type` - use alternatives like `change_type`.

#### ReleaseManifest Type
Complete release metadata featuring:
- `version`: Nested `Version` type (type composition)
- `changelog`: Array of `ChangelogEntry` items
- `published_at`: ISO timestamp string

## Import Syntax

```workpipe
import { Version, ReleaseManifest } from "./types/release.workpipe"
```

Key import features:
- **Named imports**: Select specific types with `{ Type1, Type2 }`
- **Relative paths**: Use `./` or `../` for local files
- **File extension**: Include `.workpipe` in the path
- **Multiple imports**: Import several types in one statement

## Key Concepts

1. **Type Composition**: Types can reference other types (`version: Version`)
2. **Array Syntax**: Use `[Type]` for arrays of a type
3. **String Literals**: Use `"value1" | "value2"` for enum-like constraints
4. **Import Aliasing**: Use `import { Type as Alias }` for renamed imports
5. **Type Reuse**: Define types once, import in multiple workflows

## Benefits of Cross-File Types

- **DRY Principle**: Define types once, use everywhere
- **Consistency**: All workflows use the same type definitions
- **Maintainability**: Update types in one place
- **Documentation**: Type files serve as contracts
- **Validation**: Compiler checks type usage across files

## Generated Output

Both files are compiled together. The compiler:
1. Resolves import statements
2. Validates type references
3. Checks that outputs match declared types
4. Generates workflow YAML with proper structure

## Related Examples

- [user-defined-types](../user-defined-types/) - Basic type definitions
- [shared-types](../shared-types/) - More import patterns
