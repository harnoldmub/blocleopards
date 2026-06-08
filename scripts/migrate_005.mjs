import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

// Manually parse .env if it exists
if (fs.existsSync('.env')) {
  const envContent = fs.readFileSync('.env', 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      // Remove surrounding quotes if present
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set in environment or .env file.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const migrationPath = path.resolve('db/migrations/005_mondial_tirage.sql');

try {
  console.log(`Reading migration from ${migrationPath}...`);
  const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  
  console.log("Executing migration queries...");
  // Split query by semicolons to execute statements
  const statements = sqlContent
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
    
  for (const stmt of statements) {
    console.log(`Executing: ${stmt.substring(0, 50)}...`);
    await sql(stmt);
  }
  
  console.log("Migration executed successfully!");
} catch (error) {
  console.error("Failed to run migration:", error);
  process.exit(1);
}
