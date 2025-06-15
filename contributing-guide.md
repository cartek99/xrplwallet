# Contributing to XRPL RLUSD Manager

First off, thank you for considering contributing to XRPL RLUSD Manager! It's people like you that make this tool better for everyone.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed after following the steps**
* **Explain which behavior you expected to see instead and why**
* **Include logs and error messages**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement**
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior and explain which behavior you expected to see instead**
* **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `develop`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Process

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/xrpl-rlusd-manager.git
   cd xrpl-rlusd-manager
   ```

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Make your changes**
   - Write meaningful commit messages
   - Add tests for new functionality
   - Update documentation as needed

5. **Run tests and linting**
   ```bash
   npm test
   npm run lint
   ```

6. **Push your changes**
   ```bash
   git push origin feature/your-feature-name
   ```

## Coding Standards

### JavaScript Style Guide

We use ESLint with Airbnb's style guide. Run `npm run lint` to check your code.

Key points:
- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings
- Add trailing commas in multiline objects/arrays
- Use meaningful variable names

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, semicolons, etc)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example:
```
feat: add RLUSD balance history chart

- Implement Chart.js integration
- Add 30-day history view
- Include export to CSV functionality
```

### Testing

- Write unit tests for all new functions
- Maintain test coverage above 80%
- Use descriptive test names
- Test edge cases and error scenarios

Example test:
```javascript
describe('sendRLUSD', () => {
  it('should successfully send RLUSD between valid accounts', async () => {
    // Test implementation
  });

  it('should throw error when sender has insufficient balance', async () => {
    // Test implementation
  });
});
```

### Documentation

- Update README.md if you change functionality
- Add JSDoc comments to all functions
- Include examples in documentation
- Keep documentation up to date

## Project Structure

```
src/
├── core/           # Core business logic
├── web/            # Web interface
├── cli/            # Command-line tools
└── utils/          # Utility functions
```

## Security

- Never commit sensitive data (seeds, private keys)
- Always validate user input
- Use parameterized queries for any database operations
- Follow OWASP security guidelines
- Report security vulnerabilities privately

## Questions?

Feel free to open an issue with the tag "question" or reach out on our Discord channel.

## Recognition

Contributors will be recognized in our README.md file. Thank you for your contributions!