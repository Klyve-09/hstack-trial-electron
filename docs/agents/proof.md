# Proof

Run these checks in order from the repository root. Every command must exit zero.

<!-- prettier-ignore -->
| Check           | Command             | Machine |
| --------------- | ------------------- | ------- |
| test            | `npm test`          |         |
| lint            | `npm run lint`      |         |
| typecheck       | `npm run typecheck` |         |
| package         | `npm run package`   |         |
| package-windows | `npm run package`   | windows |
| package-macos   | `npm run package`   | ci      |
| make-macos      | `bash scripts/release/macos-package.sh` | ci      |

## Requirements

- Node.js 22.13 or newer and npm on every machine that runs a check. The README asks for Node.js 22.12 or newer, but the locked Electron Forge 8.0.1 requires 22.13 or newer.
- Run `npm ci` from the repository root before the checks on each machine.
- `package-windows` runs on a Windows Hand.
- `package-macos` runs as the `package-macos` GitHub Actions job on a macOS runner.
- `make-macos` runs as the `make-macos` GitHub Actions job on a macOS runner.

## Coverage

- `lint`: `**`
- `make-macos`: `*.mts`
- `make-macos`: `index.html`
- `make-macos`: `package-lock.json`
- `make-macos`: `package.json`
- `make-macos`: `scripts/release/**`
- `make-macos`: `src/**`
- `make-macos`: `tsconfig.json`
- `package-macos`: `*.mts`
- `package-macos`: `index.html`
- `package-macos`: `package-lock.json`
- `package-macos`: `package.json`
- `package-macos`: `src/**`
- `package-macos`: `tsconfig.json`
- `package-windows`: `*.mts`
- `package-windows`: `index.html`
- `package-windows`: `package-lock.json`
- `package-windows`: `package.json`
- `package-windows`: `src/**`
- `package-windows`: `tsconfig.json`
- `package`: `*.mts`
- `package`: `index.html`
- `package`: `package-lock.json`
- `package`: `package.json`
- `package`: `src/**`
- `package`: `tsconfig.json`
- `test`: `package-lock.json`
- `test`: `package.json`
- `test`: `src/**`
- `test`: `tests/**`
- `test`: `tsconfig.json`
- `typecheck`: `*.mts`
- `typecheck`: `package-lock.json`
- `typecheck`: `package.json`
- `typecheck`: `src/**`
- `typecheck`: `tests/**`
- `typecheck`: `tsconfig.json`
- Review-only: `LICENSE`
