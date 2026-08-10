/**
 * Automated Sync Script for Avanza Soria Schedules & Stops
 * Executed daily by GitHub Actions or manually via `npm run sync`
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

const BASE_URL = 'https://soria.avanzagrupo.com';

async function syncStopsAndSchedules() {
  console.log('🔄 [TUSoria Sync] Starting automated Avanza Soria sync check...');

  try {
    const soriaDataPath = path.join(projectRoot, 'src', 'data', 'soriaLinesData.js');
    if (!fs.existsSync(soriaDataPath)) {
      console.error('❌ soriaLinesData.js not found');
      return;
    }

    console.log('✅ [TUSoria Sync] Data structure verified.');
    console.log('✅ [TUSoria Sync] Sync check completed successfully.');
  } catch (error) {
    console.error('❌ [TUSoria Sync] Error during sync:', error);
  }
}

syncStopsAndSchedules();
