# VS Code Extension

The WorkPipe VS Code extension provides syntax highlighting and real-time diagnostics for `.workpipe` and `.wp` files.

## Installation

### From VSIX File

1. Download the `.vsix` file from the releases or build it locally
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the Command Palette
4. Type "Install from VSIX" and select **Extensions: Install from VSIX...**
5. Navigate to and select the `workpipe-vscode-x.x.x.vsix` file
6. Reload VS Code when prompted

### Building from Source

```bash
cd packages/vscode-extension
npm install
npm run build
npm run package
```

This creates a `.vsix` file in the `packages/vscode-extension` directory.

## Features

### Syntax Highlighting

The extension provides TextMate-based syntax highlighting for:
- Keywords (`workflow`, `job`, `on`, `runs_on`, `steps`, etc.)
- String literals
- Comments
- Numbers and booleans
- Built-in functions (`run`, `checkout`, `setup_node`, etc.)

Syntax highlighting works immediately when you open a `.workpipe` or `.wp` file.

### Real-Time Diagnostics

The extension integrates with the WorkPipe compiler to provide:

- **Error squiggles**: Red underlines on syntax errors and semantic issues
- **Warnings**: Yellow underlines for potential problems
- **Hover information**: Hover over an error to see the full message and hint

Diagnostics update automatically as you type, save, or open files.

### Diagnostic Hints

Many errors include helpful hints that appear in the hover tooltip:

```
Error: job 'build' is missing required property 'runs_on'

Hint: Add runs_on with a runner like 'ubuntu-latest', 'windows-latest', or 'macos-latest'
```

## Troubleshooting

### Extension Not Activating

The extension activates when you open a file with a `.workpipe` or `.wp` extension.

**Verify the extension is installed:**
1. Open the Extensions sidebar (`Ctrl+Shift+X`)
2. Search for "WorkPipe"
3. Confirm it shows as installed and enabled

**Verify file association:**
1. Open a `.workpipe` file
2. Look at the bottom-right corner of VS Code for the language mode
3. It should show "WorkPipe" - if it shows "Plain Text", click it and select "WorkPipe"

### No Diagnostics Appearing

If syntax highlighting works but you don't see error squiggles:

**1. Check the Output Panel**
1. Open the Output panel: `View > Output` or `Ctrl+Shift+U`
2. In the dropdown on the right, look for "WorkPipe" or "Extension Host"
3. Check for any error messages

**2. Reload the Window**
1. Press `Ctrl+Shift+P` to open Command Palette
2. Type "Reload Window" and select **Developer: Reload Window**

**3. Check Extension Host Logs**
1. Press `Ctrl+Shift+P`
2. Type "Show Logs" and select **Developer: Show Logs...**
3. Select "Extension Host" from the dropdown
4. Look for errors related to "workpipe"

**4. Verify the Extension Bundle**

The diagnostics feature requires the `@workpipe/compiler` package to be correctly bundled. If you built the extension from source, ensure:

```bash
cd packages/vscode-extension
npm install
npm run build
```

Then reinstall the VSIX.

### Diagnostics Not Updating

Diagnostics should update when you:
- Open a file
- Save a file
- Make changes to the file

If diagnostics seem stale, try:
1. Save the file (`Ctrl+S`)
2. Close and reopen the file
3. Reload the window

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot find module '@workpipe/compiler'" | Compiler not bundled | Rebuild extension with `npm run build` |
| No errors shown at all | Extension not activated | Reload window, check file extension |
| Highlighting works, errors don't | Compiler bundle issue | Reinstall extension |

## Verification

To verify the extension is working correctly:

### Test Syntax Highlighting

Create a file named `test.workpipe` with:

```workpipe
workflow test {
  on: push

  job build {
    runs_on: ubuntu-latest
    steps: [
      run("echo hello")
    ]
  }
}
```

Keywords like `workflow`, `job`, `on`, `runs_on`, and `steps` should be highlighted.

### Test Diagnostics

Create a file with an intentional error:

```workpipe
workflow test {
  on: push

  job build {
    steps: [
      run("echo hello")
    ]
  }
}
```

This file is missing `runs_on` in the job. You should see:
1. A red squiggly underline on the job
2. The error listed in the Problems panel (`Ctrl+Shift+M`)
3. A hover tooltip explaining the error and suggesting a fix

### Expected Problems Panel

When diagnostics are working, the Problems panel should show entries like:

```
job 'build' is missing required property 'runs_on' [workpipe]
```

If you see this error for the test file above, the extension is working correctly.

## Technical Details

### Activation Events

The extension activates on:
- `onLanguage:workpipe` - When a WorkPipe file is opened

### File Extensions

The following extensions are recognized:
- `.workpipe`
- `.wp`

### How Diagnostics Work

1. When you open or edit a `.workpipe` file, the extension captures the document text
2. The text is passed to the WorkPipe compiler's `compile()` function
3. The compiler returns any diagnostics (errors, warnings)
4. Diagnostics are converted to VS Code format and displayed as squiggles
5. Hints from the compiler are appended to error messages in tooltips
