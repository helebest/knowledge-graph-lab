# Project Instructions

These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## Think Before Coding

- State assumptions explicitly before implementing.
- If multiple interpretations exist, present them instead of picking silently.
- If something is unclear and a reasonable assumption would be risky, ask.
- Push back when a simpler approach is better.

## Simplicity First

- Build only what was requested.
- Avoid speculative abstractions, configurability, or extra features.
- No abstractions for single-use code.
- If an implementation is much larger than needed, simplify it.

## Surgical Changes

- Touch only files required by the request.
- Do not refactor or reformat unrelated code.
- Match existing style when editing existing code.
- Remove only imports, variables, functions, and artifacts made unused by your own changes.
- Mention unrelated dead code instead of deleting it.

## Goal-Driven Execution

- Define success criteria for the task.
- For bugs, reproduce with a test or focused verification before fixing when practical.
- For visual/frontend work, verify with build output and browser screenshots.
- Loop until the requested behavior is verified or a concrete blocker is identified.
