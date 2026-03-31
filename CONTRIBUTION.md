# Contribution Guide

Thanks for contributing to HAR Extractor.

## Development Setup

1. Clone your fork and switch to the project directory.
2. Install dependencies in the root project:

```bash
npm install
```

3. Use the smoke test workflow for validation.

## Testing

Run smoke tests from project root:

```bash
npm run smoke
npm run test:smoke
```

Clean generated test artifacts:

```bash
npm run clean
```

What `npm run smoke` does:
- Packs the module with `npm pack`
- Runs dynamic consumer scenarios (CommonJS, ESM, named exports)
- Creates an isolated temporary workspace at `__testrun__`
- Copies `tests/smokeTest.js` into that isolated workspace
- Generates a temporary `__testrun__/package.json`
- Installs the packed tarball there and runs `smokeTest.js`

`npm run clean` removes `__testrun__` if it exists.

## Pull Request Expectations

Suggested workflow:

1. Fork and create a feature branch.
2. Make focused changes with clear commit messages.
3. Run validation before opening a PR:

```bash
npm run clean
npm run smoke
```

4. Update docs/examples when behavior or API changes.
5. Open a pull request that includes:
- What changed
- Why it changed
- How it was tested

## High-Impact Areas

- Bug fixes in URL/path handling and extraction logic
- MIME extension mapping improvements
- Browser/Node.js compatibility fixes
- Test coverage and smoke-test improvements
