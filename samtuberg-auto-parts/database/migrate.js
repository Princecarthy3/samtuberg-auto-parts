import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaFile = path.join(__dirname, 'schema.sql');

const config = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER || process.env.MYSQL_USERNAME || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.DB_DATABASE || 'samtuberg_store',
  charset: 'utf8mb4'
};

async function ensureLegacyAdminSchema(connection) {
  const [columns] = await connection.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'admin_users'
       AND column_name = 'status'
     LIMIT 1`
  );

  if (!columns.length) {
    await connection.query(
      "ALTER TABLE admin_users ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active' AFTER role"
    );
  }
}

async function main() {
  if (!/^[A-Za-z0-9_]+$/.test(config.database)) {
    throw new Error('The configured MySQL database name may contain only letters, numbers, and underscores.');
  }

  const connection = await mysql.createConnection({ ...config, database: undefined });
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      [config.database]
    );
    await connection.query('USE ??', [config.database]);

    const schemaSql = await readFile(schemaFile, 'utf8');
    const statements = schemaSql
      .split(/;\s*\n/)
      .map(statement => statement.trim())
      .filter(statement => statement
        && !/^(--|\/\/)/.test(statement)
        && !/^CREATE\s+DATABASE\b/i.test(statement)
        && !/^USE\b/i.test(statement));

    for (const statement of statements) {
      if (!statement) continue;
      await connection.query(statement);
    }
    await ensureLegacyAdminSchema(connection);

    console.log(`Database migration complete. Tables are ready in "${config.database}".`);
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('Database migration failed:', error.message);
  process.exit(1);
});
