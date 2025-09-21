# Finder API - Folder Structure

This is a clean, monolithic event-based API starter with the following structure:

```
Backend/
├── src/
│   ├── apps/                          # Application modules
│   │   └── account/                   # Account management
│   │       ├── auth/                  # Authentication
│   │       │   ├── auth.controller.ts # Auth endpoints
│   │       │   ├── auth.service.ts    # Auth business logic
│   │       │   ├── auth.module.ts     # Auth module
│   │       │   └── index.ts           # Module exports
│   │       ├── user/                  # User management
│   │       │   ├── user.controller.ts # User endpoints
│   │       │   ├── user.service.ts    # User business logic
│   │       │   ├── user.module.ts     # User module
│   │       │   ├── index.ts           # Module exports
│   │       │   └── infrastructure/    # User infrastructure
│   │       │       └── index.ts       # Infrastructure exports
│   │       └── profile/               # Profile management
│   │           ├── profile.controller.ts # Profile endpoints
│   │           ├── profile.service.ts    # Profile business logic
│   │           ├── profile.module.ts     # Profile module
│   │           └── index.ts              # Module exports
│   ├── core/                          # Core infrastructure
│   │   ├── configuration/             # App configuration
│   │   ├── database/                  # Database setup (Prisma)
│   │   ├── exception/                 # Error handling
│   │   ├── guard/                     # Authentication guards
│   │   ├── logging/                   # Logging system
│   │   ├── crypto/                    # Encryption utilities
│   │   ├── cors/                      # CORS configuration
│   │   └── cookie/                    # Cookie management
│   ├── libraries/                     # Reusable libraries
│   │   ├── email/                     # Email service (Nodemailer)
│   │   │   ├── templates/             # Email templates
│   │   │   │   └── verification.ejs   # Verification email template
│   │   │   ├── email.service.ts       # Email service
│   │   │   ├── email.module.ts        # Email module
│   │   │   └── index.ts               # Module exports
│   │   ├── logger/                    # Logging utilities (Winston)
│   │   ├── socket/                    # WebSocket handling
│   │   ├── google/                    # Google OAuth (simplified)
│   │   └── event/                     # Event system
│   ├── common/                        # Shared utilities
│   │   ├── constant/                  # Application constants
│   │   ├── dto/                       # Data transfer objects
│   │   ├── filters/                   # Exception filters
│   │   ├── interceptors/              # Response interceptors
│   │   ├── pipe/                      # Validation pipes
│   │   └── util/                      # Utility functions
│   ├── app.module.ts                  # Main application module
│   ├── app.infrastructure.module.ts   # Infrastructure module
│   └── main.ts                        # Application entry point
├── prisma/                            # Database schema and migrations
│   └── schema.prisma                  # Prisma schema
├── env/                               # Environment configurations
│   ├── local.env                      # Local development
│   ├── test.env                       # Testing/staging
│   └── production.env                 # Production
├── package.json                       # Dependencies and scripts
├── tsconfig.json                      # TypeScript configuration
├── README.md                          # Project documentation
└── FOLDER_STRUCTURE.md                # This file
```

## Key Features of This Structure:

### 🏗️ **Modular Architecture**

- Each feature has its own module with controller, service, and module files
- Clear separation of concerns
- Easy to extend and maintain

### 🔄 **Event-Driven Design**

- Built-in event emitter for loose coupling
- Modular event handling
- Real-time capabilities with WebSockets

### 🛡️ **Security & Infrastructure**

- JWT authentication with guards
- Role-based access control
- Comprehensive error handling
- Logging and monitoring
