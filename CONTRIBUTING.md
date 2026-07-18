# Contributing to AIOS Companion

Thank you for considering contributing to AIOS Companion! Please read the following guidelines to help make the contribution process smooth and effective.

## How to Contribute

1. **Fork the repository** on GitHub.
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/aios-companion.git
   cd aios-companion
   ```
3. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
   Use the prefix `feature/` for new features, `fix/` for bug fixes, `docs/` for documentation, etc.

4. **Install dependencies**:
   ```bash
   pnpm install
   ```

5. **Make your changes**, following the code style and conventions explained below.

6. **Run tests** to ensure nothing is broken:
   ```bash
   pnpm test
   pnpm run typecheck
   ```

7. **Commit your changes** using this repo’s format (`type: <gitmoji> …`), for example:
   ```
   feat: ✨ add new capability
   fix: 🐛 resolve MCP connection issue
   docs: 📝 update README troubleshooting
   refactor: ♻️ tidy without behavior change
   test: ✅ add missing tests
   chore: 🔧 update build tooling
   ```
   Author for maintained commits: `Kleilson Santos <kdsddesign1@gmail.com>` · no IDE `Co-authored-by` trailers.

8. **Push to your fork** and open a Pull Request (PR) against the `sandbox` branch (then `sandbox` → `main`).

9. **Wait for review** – maintainers will provide feedback and may request changes.

## Code Style

- We use **Prettier** for code formatting. Run `pnpm format` to format your code.
- ESLint is configured with recommended rules and the `jsx-a11y` plugin for accessibility.
- TypeScript strict mode is enabled; aim for zero type errors.

## Reporting Issues

- Use the GitHub Issues tracker.
- Please include:
  - A clear and descriptive title.
  - Steps to reproduce the issue.
  - Expected vs. actual behavior.
  - OS, Node.js version, and relevant logs.
  - Screenshots or screen recordings if applicable.

## Code of Conduct

Please note that this project is released with a Contributor Covenant Code of Conduct. By participating, you are expected to uphold this code. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

Thank you again for helping improve AIOS Companion!
