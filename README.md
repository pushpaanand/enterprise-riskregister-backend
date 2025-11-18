# ERM Next.js API (Azure SQL)

## Setup
1. In this folder, create a file named `.env.local` with:

```
MSSQL_SERVER=riskmanage.database.windows.net
MSSQL_DATABASE=riskmanagement
MSSQL_USER=riskmanagement@riskmanage
MSSQL_PASSWORD=RiskManagement
MSSQL_ENCRYPT=true
MSSQL_TRUST_SERVER_CERT=false
MSSQL_LOGIN_TIMEOUT=30
```

2. Install and run:
```
npm install
npm run dev
```
The API will run on http://localhost:4000.

## Endpoints
- GET /api/risks
- POST /api/risks
- GET /api/incidents
- POST /api/incidents
- GET /api/incidents/:id/history

## Notes
- Ensure your DB has the tables from the provided MSSQL schema.
- Seed data SQL is in your main chat; run it in your DB to test endpoints quickly.


