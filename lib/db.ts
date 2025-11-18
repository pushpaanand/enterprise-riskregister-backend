import sql, { config } from 'mssql';
import dotenv from 'dotenv';
// Ensure env is loaded in dev even if Next fails to pick up .env.local
dotenv.config({ path: '.env.local' });

function get(name: string, fallback: string): string {
  const v = process.env[name];
  if (v && v.trim() !== '') return v;
  return fallback;
}

function buildConfig(): config {
  return {
    server: process.env.DB_SERVER || 'riskmanage.database.windows.net',
  database: process.env.DB_NAME || 'riskmanagement',
  user: process.env.DB_USER || 'riskmanagement', // Updated username
  password: process.env.DB_PASSWORD || 'RiskManage@123', // Updated password
  port: Number(process.env.DB_PORT) || 1433,
  options: {
    encrypt: true,
    trustServerCertificate: false
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
    // Fallback to provided credentials if env is not available
    // server: get('MSSQL_SERVER', 'riskmanage.database.windows.net'),
    // database: get('MSSQL_DATABASE', 'riskmanagement'),
    // user: get('MSSQL_USER', 'riskmanagement@riskmanage'),
    // password: get('MSSQL_PASSWORD', 'RiskManagement@123'),
    // options: {
    //   encrypt: (process.env.MSSQL_ENCRYPT ?? 'true') !== 'false',
    //   trustServerCertificate: (process.env.MSSQL_TRUST_SERVER_CERT ?? 'false') === 'true'
    // },
    // connectionTimeout: (Number(process.env.MSSQL_LOGIN_TIMEOUT) || 30) * 1000
  };
}

let pool: sql.ConnectionPool | null = null;

export async function getPool() {
  if (pool && pool.connected) return pool;
  if (pool && !pool.connected) await pool.close();
  const cfg = buildConfig();
  pool = await new sql.ConnectionPool(cfg).connect();
  return pool;
}


