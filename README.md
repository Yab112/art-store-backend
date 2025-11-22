# Finder API - Modern NestJS Backend

A production-ready, event-based API built with NestJS, featuring modern authentication, comprehensive security, automated code quality, and CI/CD pipeline.

## 🚀 Features

### **🔐 Enhanced Authentication System**

- **Multi-Factor Authentication (MFA)** with TOTP support
- **Credential-based authentication** (email/password) with strong validation
- **Google OAuth 2.0** integration
- **JWT token management** with refresh token rotation
- **Role-based access control** (USER, ADMIN, SUPER_ADMIN)
- **Session management** with active session tracking
- **Passwordless authentication** support (magic links)

### **🛡️ Advanced Security Features**

- **Password hashing** with Argon2 (industry standard)
- **Rate limiting** and brute force protection
- **Input validation** with class-validator decorators
- **CORS configuration** with security headers
- **Helmet security headers** for enhanced protection
- **JWT token validation** with algorithm enforcement
- **Secure cookie management**

### **⚡ Code Quality & Development Experience**

- **Automated code formatting** with Prettier
- **Linting** with ESLint and TypeScript rules
- **Pre-commit hooks** with Husky and lint-staged
- **Pre-push validation** (type-check, lint, tests)
- **Conventional commit messages** enforcement
- **Automated dependency management** with pnpm

### **🏗️ Infrastructure & Architecture**

- **PostgreSQL database** with Prisma ORM
- **Event-driven architecture** with built-in event emitter
- **Real-time WebSocket** connections
- **Comprehensive logging** with Winston
- **Email service** with Nodemailer and templates
- **Modular design** for easy scaling

### **🚀 CI/CD Pipeline**

- **Automated testing** and quality checks
- **Security scanning** with dependency audits
- **Build automation** with artifact management
- **Code coverage** reporting
- **Multi-stage pipeline** (quality → security → build)

## 📁 Project Structure

```
src/
├── apps/
│   └── account/              # Account management modules
│       ├── auth/             # Authentication system
│       │   ├── dto/          # Data transfer objects
│       │   ├── strategies/   # Passport strategies
│       │   └── guards/       # Authentication guards
│       ├── user/             # User management
│       └── profile/          # Profile management
├── core/                     # Core infrastructure
│   ├── configuration/        # App configuration
│   ├── database/            # Database setup with Prisma
│   ├── exception/           # Error handling
│   ├── guard/               # Authentication & role guards
│   ├── logging/             # Logging system
│   ├── crypto/              # JWT & encryption utilities
│   ├── cors/                # CORS configuration
│   └── cookie/              # Cookie management
├── libraries/               # Reusable libraries
│   ├── email/               # Email service with templates
│   ├── logger/              # Logging utilities
│   ├── socket/              # WebSocket handling
│   ├── google/              # Google OAuth integration
│   └── event/               # Event system
└── common/                  # Shared utilities
    ├── constant/            # Application constants
    ├── dto/                 # Common DTOs
    ├── filters/             # Exception filters
    ├── interceptors/        # Response interceptors
    └── util/                # Utility functions
```

## 🛠️ Getting Started

### Prerequisites

- **Node.js** (v18+)
- **PostgreSQL** (v12+)
- **pnpm** (v9.2.0)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd Backend

# Install dependencies
pnpm install

# Set up environment variables
cp env/local.env.example env/local.env
# Edit env/local.env with your configuration

# Generate Prisma client
pnpm prisma:generate

# Run database migrations
pnpm migrate:dev

# Start development server
pnpm start:dev
```

### Environment Variables

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/finder"

# JWT Configuration
JWT_ACCESS_SECRET="your-super-secure-access-secret"
JWT_REFRESH_SECRET="your-super-secure-refresh-secret"
JWT_EXPIRY_TIME="15m"
JWT_REFRESH_EXPIRY_TIME="7d"

# Email (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# Google OAuth
SERVER_GOOGLE_CLIENT_ID="your-google-client-id"
SERVER_GOOGLE_CLIENT_SECRET="your-google-client-secret"

# App Configuration
PORT="3099"
NODE_ENV="development"
BASE_URL="http://localhost:3099"
SERVER_BASE_URL="http://localhost:3099"
BETTER_AUTH_URL="http://localhost:3099"
ENCRYPTION_KEY="your-encryption-key"
```

## 🔧 Available Scripts

### **Development**

- `pnpm start:dev` - Start development server with hot reload
- `pnpm start:debug` - Start with debugging enabled
- `pnpm build` - Build the application
- `pnpm clean` - Clean build artifacts

### **Database**

- `pnpm migrate:dev` - Run database migrations
- `pnpm migrate:reset` - Reset database and run migrations
- `pnpm prisma:studio` - Open Prisma Studio for database management
- `pnpm prisma:generate` - Generate Prisma client

### **Code Quality**

- `pnpm lint` - Run ESLint with auto-fix
- `pnpm lint:strict` - Run ESLint with strict rules
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm type-check` - Run TypeScript type checking

### **Testing**

- `pnpm test` - Run tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:cov` - Run tests with coverage
- `pnpm test:ci` - Run tests for CI environment

## 🚀 CI/CD Pipeline

The project includes a comprehensive GitHub Actions workflow:

### **Quality Checks Job**

- Type checking with TypeScript
- Linting with ESLint
- Code formatting validation
- Test execution
- Coverage reporting

### **Security Scan Job**

- Dependency vulnerability scanning
- Security audit with moderate threshold

### **Build Job**

- Application building
- Artifact generation
- Build artifact upload

## 🔐 Authentication Endpoints

### **User Registration**

```http
POST /api/auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "passwordConfirm": "SecurePassword123!"
}
```

### **User Login**

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "john.doe@example.com",
  "password": "SecurePassword123!",
  "rememberMe": false,
  "totpCode": "123456"  // Optional 2FA code
}
```

### **Token Refresh**

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

## 📚 API Documentation

Once the server is running, access the interactive API documentation:

```
http://localhost:3000/swagger
```

## 🏗️ Architecture Principles

This project follows modern architectural principles:

- **🔧 Modular Design**: Each feature is organized into its own module
- **⚡ Event-Driven**: Built-in event system for loose coupling
- **🏗️ Layered Architecture**: Clear separation between controllers, services, and infrastructure
- **🔒 Type Safety**: Full TypeScript support with Prisma-generated types
- **📈 Scalable Foundation**: Easy to extend and add new features
- **🛡️ Security First**: Comprehensive security measures at every layer
- **🧪 Quality Assurance**: Automated testing and code quality checks

## 🚀 Development Workflow

### **Pre-commit Hooks**

- Automatic code formatting with Prettier
- ESLint fixes for common issues
- Type checking validation

### **Pre-push Validation**

- Full TypeScript compilation
- Strict linting rules
- Test suite execution
- Code coverage verification

### **Commit Message Convention**

Follow conventional commit format:

```
type(scope): description

feat: add new feature
fix: resolve bug
docs: update documentation
style: formatting changes
refactor: code refactoring
test: add or update tests
chore: maintenance tasks
ci: CI/CD changes
```

## 🔮 Next Steps

This foundation provides everything needed to build:

- **Advanced user management** with MFA
- **Real-time features** with WebSockets
- **Event-driven business logic**
- **Scalable microservices**
- **Advanced security features**
- **Production-ready deployments**

## 🤝 Contributing

1. Follow the conventional commit format
2. Ensure all tests pass
3. Maintain code quality standards
4. Update documentation as needed

## 📄 License

This project is licensed under the MIT License.

---

**Built with ❤️ using NestJS, Prisma, and modern development practices**
