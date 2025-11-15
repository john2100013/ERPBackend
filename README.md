# AwesomeInvoice Web Backend

Express.js backend API for the AwesomeInvoice web application with multi-tenant business account support.

## Features

- 🔐 JWT Authentication & Authorization
- 🏢 Multi-tenant Business Architecture
- 📦 Item Management (CRUD operations)
- 🧾 Invoice Management (planned)
- 👥 Employee Management (planned)
- 🔒 Role-based Access Control
- 🛡️ Security Middleware (Rate limiting, CORS, Helmet)
- 📊 PostgreSQL Database with Migrations
- 🎯 TypeScript Support

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Tokens)
- **Language**: TypeScript
- **Security**: Helmet, CORS, Rate Limiting
- **Password Hashing**: bcryptjs

## Prerequisites

- Node.js (v16 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. **Clone and navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the backend root directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=awesome_invoice_web
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password

   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=24h

   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # Security Configuration
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX_REQUESTS=100
   FRONTEND_URL=http://localhost:5173
   ```

4. **Set up the database**:
   ```bash
   # Create the database
   createdb awesome_invoice_web

   # Run migrations
   npm run migrate
   ```

## Database Setup

The application uses PostgreSQL with the following main tables:

- **businesses**: Store business account information
- **users**: Store user accounts linked to businesses
- **items**: Store inventory items per business
- **invoices**: Store invoice records (planned)
- **invoice_lines**: Store invoice line items (planned)
- **employees**: Store employee information (planned)
- **order_signatures**: Store digital signatures (planned)

### Running Migrations

```bash
# Run the migration to create all tables
npm run migrate
```

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run test` - Run tests (when implemented)

## API Endpoints

### Authentication (`/api/auth`)

- `POST /register` - Register new business account
- `POST /login` - Login user
- `GET /profile` - Get user profile (protected)
- `PUT /password` - Update password (protected)
- `POST /logout` - Logout user (protected)

### Items (`/api/items`)

- `GET /` - Get all items (with pagination, search, sorting)
- `POST /` - Create new item
- `GET /stats` - Get item statistics
- `GET /:id` - Get specific item
- `PUT /:id` - Update item
- `DELETE /:id` - Delete item

### General

- `GET /api/health` - Health check endpoint

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer your_jwt_token_here
```

## Multi-Tenant Architecture

The application is designed with multi-tenancy where:

- Each business has its own isolated data
- Users belong to a specific business
- All data access is filtered by business_id
- Business owners can manage their own data only

## Error Handling

The API uses consistent error response format:

```json
{
  "success": false,
  "message": "Error description",
  "stack": "Error stack trace (development only)"
}
```

## Security Features

- **Rate Limiting**: Prevents abuse with configurable limits
- **CORS**: Configured for frontend communication
- **Helmet**: Security headers for protection
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Request validation and sanitization
- **JWT Security**: Secure token-based authentication

## Development

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **The API will be available at**:
   - Main API: `http://localhost:3000/api`
   - Health check: `http://localhost:3000/api/health`

3. **Test the API**:
   ```bash
   # Health check
   curl http://localhost:3000/api/health

   # Register a new business
   curl -X POST http://localhost:3000/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@example.com",
       "password": "password123",
       "first_name": "John",
       "last_name": "Doe",
       "business_name": "My Business"
     }'
   ```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts          # Database connection
│   ├── controllers/
│   │   ├── authController.ts    # Authentication logic
│   │   └── itemController.ts    # Item management logic
│   ├── middleware/
│   │   ├── auth.ts             # JWT authentication middleware
│   │   └── index.ts            # Security middleware
│   ├── routes/
│   │   ├── authRoutes.ts       # Authentication routes
│   │   ├── itemRoutes.ts       # Item routes
│   │   └── index.ts            # Route aggregation
│   ├── services/
│   │   ├── authService.ts      # Authentication business logic
│   │   └── itemService.ts      # Item business logic
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── migrations/
│   │   └── init.sql            # Database schema
│   └── app.ts                  # Express app setup
├── package.json
├── tsconfig.json
└── .env
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | awesome_invoice_web |
| `DB_USER` | Database user | - |
| `DB_PASSWORD` | Database password | - |
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_EXPIRES_IN` | Token expiration | 24h |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `FRONTEND_URL` | Frontend URL for CORS | http://localhost:5173 |

## Contributing

1. Follow the existing code structure and naming conventions
2. Add proper TypeScript types for all functions and interfaces
3. Include error handling for all database operations
4. Validate all user inputs
5. Follow the multi-tenant architecture pattern
6. Add appropriate middleware for security and validation

## License

This project is private and proprietary.