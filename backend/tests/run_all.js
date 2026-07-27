import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`[Suite Runner] Launching process for: ${path.basename(scriptPath)}...`);
    const child = fork(scriptPath);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Test process failed with exit code: ${code}`));
      }
    });
  });
}

async function runAll() {
  console.log('===================================================');
  console.log('    AUTO-RUNNING MASTER TEST SUITE DIAGNOSTICS      ');
  console.log('===================================================');
  
  try {
    
    await runScript(path.join(__dirname, 'resume.test.js'));
    console.log('\n---------------------------------------------------\n');

    await runScript(path.join(__dirname, 'job.test.js'));
    console.log('\n---------------------------------------------------\n');

    await runScript(path.join(__dirname, 'tailor.test.js'));
    
    console.log('\n===================================================');
    console.log('   ALL BACKEND INTEGRATION TEST SUITES PASSED! ✅  ');
    console.log('===================================================');
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Master test runner halted due to failure:`, err.message);
    process.exit(1);
  }
}

runAll();
