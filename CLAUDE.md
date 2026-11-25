# Claude Code Instructions

Read and follow [AGENTS.md](./AGENTS.md) before making any changes. It contains the project architecture, coding standards, security requirements, validation commands, and pull-request workflow.

For every task:
1. Inspect the relevant code and current branch before editing.
2. Work on a dedicated branch; never commit directly to `main`.
3. Keep the change limited to the requested scope.
4. Add or update tests when behavior changes.
5. Run `npm run typecheck`, `npm test`, and `npm run build` for code changes. Report any check that could not be run.
6. Open or update a PR against `main`, including a clear summary, test results, risks, and outstanding questions.
7. Do not merge the PR. Wait for independent review and the repository owner's decision.

Do not claim that tests, builds, or reviews passed unless you have observed the successful result.
