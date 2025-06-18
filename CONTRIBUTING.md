# Contributing to Wedged Platform

Thank you for your interest in contributing to the Wedged Platform! This document provides guidelines for contributing to the project.

## Code of Conduct

By participating in this project, you agree to abide by our Code of Conduct:
- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear description** of the bug
- **Steps to reproduce** the behavior
- **Expected behavior**
- **Actual behavior**
- **Environment details** (OS, Node.js version, browser)
- **Screenshots** if applicable

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:
- **Clear description** of the enhancement
- **Use case** and rationale
- **Potential implementation** approach
- **Impact assessment** on existing functionality

### Development Setup

1. **Fork the repository**
2. **Clone your fork**:
   ```bash
   git clone https://github.com/your-username/wedged-platform.git
   cd wedged-platform
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Start development server**:
   ```bash
   npm start
   ```

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the coding standards
3. **Write tests** for new functionality
4. **Update documentation** as needed
5. **Commit your changes**:
   ```bash
   git commit -m "feat: add your feature description"
   ```

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** with:
   - Clear title and description
   - Reference to related issues
   - Screenshots if UI changes
   - Testing instructions

## Coding Standards

### JavaScript/React Guidelines

- Use ES6+ features
- Follow React best practices
- Use functional components with hooks
- Implement proper error boundaries
- Use TypeScript for new features (gradual migration)

### Code Style

- Use Prettier for code formatting
- Follow ESLint rules
- Use meaningful variable names
- Add JSDoc comments for functions
- Keep functions small and focused

### Smart Contract Guidelines

- Follow Solidity best practices
- Use OpenZeppelin libraries when possible
- Implement comprehensive tests
- Add NatSpec documentation
- Consider gas optimization

### Git Commit Messages

Use conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Testing

- Write unit tests for all new functions
- Add integration tests for API endpoints
- Test smart contracts thoroughly
- Include edge cases in tests
- Maintain test coverage above 80%

### Documentation

- Update README.md if needed
- Add inline code documentation
- Update API documentation
- Include examples in documentation
- Keep changelog updated

## Project Structure

Understanding the project structure helps with contributions:

```
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── services/          # API and blockchain services
│   ├── hooks/             # Custom React hooks
│   ├── utils/             # Utility functions
│   └── styles/            # CSS styles
├── server/                # Backend server
│   ├── routes/            # API routes
│   ├── services/          # Backend services
│   └── middleware/        # Express middleware
├── contracts/             # Smart contracts
├── scripts/               # Deployment scripts
├── tests/                 # Test files
└── docs/                  # Documentation
```

## Areas for Contribution

### High Priority
- Smart contract security audits
- Frontend accessibility improvements
- API performance optimization
- Test coverage expansion
- Documentation improvements

### Medium Priority
- UI/UX enhancements
- Additional risk metrics
- Mobile responsiveness
- Internationalization
- Error handling improvements

### Low Priority
- Code refactoring
- Performance optimizations
- Developer tools
- Example implementations
- Tutorial content

## Review Process

1. **Automated checks** must pass (linting, tests)
2. **Code review** by maintainers
3. **Testing** in development environment
4. **Security review** for smart contract changes
5. **Documentation review** for user-facing changes

## Development Workflow

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: Feature development
- `hotfix/*`: Critical bug fixes
- `release/*`: Release preparation

### Release Process
1. Create release branch from develop
2. Update version numbers
3. Update changelog
4. Test thoroughly
5. Merge to main
6. Tag release
7. Deploy to production

## Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Discord**: Real-time community chat
- **Documentation**: Comprehensive guides and API docs

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Community highlights
- Annual contributor report

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Additional Resources

- [React Documentation](https://reactjs.org/docs)
- [Ethereum Development](https://ethereum.org/developers)
- [Solidity Documentation](https://docs.soliditylang.org)
- [Hardhat Documentation](https://hardhat.org/docs)
- [Web3 Best Practices](https://consensys.github.io/smart-contract-best-practices/)

Thank you for contributing to the Wedged Platform!