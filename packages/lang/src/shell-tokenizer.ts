import { ExternalTokenizer } from "@lezer/lr";
import { shellContent } from "./grammar.terms.js";

/**
 * External tokenizer for shell content inside `shell { ... }` blocks.
 *
 * The tokenizer implements brace-counting to determine where the shell block ends:
 * - Matches the entire `{ ... }` block including both braces
 * - Counts nested `{` and `}` characters
 * - Captures all content verbatim until brace depth returns to 0
 *
 * This allows shell code with nested braces (e.g., if-then-fi blocks,
 * command substitutions like ${var}) to be captured correctly.
 *
 * Example:
 *   shell { echo hello }           -> captures "{ echo hello }"
 *   shell { if [ $x ]; then { echo $x; } fi }  -> captures entire block
 */
export const shellTokenizer = new ExternalTokenizer(
  (input) => {
    // Skip any leading whitespace before the opening brace
    while (
      input.next === 32 || // space
      input.next === 9 || // tab
      input.next === 10 || // newline
      input.next === 13 // carriage return
    ) {
      input.advance();
    }

    // Must start with opening brace
    if (input.next !== 123) {
      // Not a '{', don't match
      return;
    }

    // Consume the opening brace
    input.advance();
    let depth = 1;

    while (depth > 0) {
      const code = input.next;
      if (code < 0) {
        // EOF - don't accept, let error recovery handle it
        return;
      }

      if (code === 123) {
        // '{' character
        depth++;
      } else if (code === 125) {
        // '}' character
        depth--;
      }

      input.advance();
    }

    // Successfully matched the entire block including closing brace
    input.acceptToken(shellContent);
  },
  {
    // This tokenizer should be invoked when the parser expects shellContent
    contextual: true,
  }
);
