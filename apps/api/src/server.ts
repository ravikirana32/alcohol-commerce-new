import 'dotenv/config';
import { createServer } from 'node:http';
import { app } from './app.js';
import { pool } from './db/pool.js';
import { validateEnvironmentConfig } from './services/environmentConfig.js';
import { parsePositiveInteger } from './services/configParsing.js';
import { beginDrain } from './runtime/state.js';

const environment = validateEnvironmentConfig(process.env);
if (!environment.ready) {
  throw new Error(
    `Invalid startup configuration: missing=${environment.missing.join(',') || 'none'}; weakJwtSecret=${environment.weakSecret}`
  );
}

const port = parsePositiveInteger(process.env.API_PORT, 8080, 1, 65535);
const server = createServer(app);
server.listen(port, '0.0.0.0', () => {
  console.log(`Alcohol Commerce API listening on ${port}`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`[shutdown] ${signal}: entering drain mode`);
  beginDrain();

  const forceExit = setTimeout(() => {
    console.error('[shutdown] Graceful shutdown timed out');
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  server.close(async (error) => {
    try {
      await pool.end();
      clearTimeout(forceExit);
      if (error) {
        console.error('[shutdown] HTTP server close failed', error);
        process.exitCode = 1;
      } else {
        console.info('[shutdown] HTTP server and database pool closed');
      }
    } catch (closeError) {
      console.error('[shutdown] Database pool close failed', closeError);
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
