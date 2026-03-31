'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const staticTestDir = path.join(rootDir, 'tests');
const packageJsonPath = path.join(rootDir, 'package.json');
const runDir = path.join(rootDir, '__testrun__');

function run(command, args, cwd) {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(executable, args, {
    cwd,
    stdio: 'inherit',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status || 1}`);
  }

  return result;
}

function runCapture(command, args, cwd) {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(executable, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }
    if (result.stderr) {
      process.stderr.write(result.stderr);
    }
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status || 1}`);
  }

  return result.stdout;
}

function generateTestScenarios(tarballName) {
  return [
    {
      name: 'CommonJS consumer',
      packageJson: {
        name: 'test-cjs',
        version: '1.0.0',
        type: 'commonjs',
        dependencies: {
          'har-extract-core': `../${tarballName}`,
        },
      },
      testFile: 'test-cjs.js',
      code: `const lib = require('har-extract-core');
const assert = require('assert');
assert(typeof lib.extractFilesFromHar === 'function');
assert(typeof lib.sanitizeSegment === 'function');
assert(lib.WINDOWS_RESERVED_NAMES instanceof Set);
console.log('✓ CJS imports work');`,
    },
    {
      name: 'ESM consumer',
      packageJson: {
        name: 'test-esm',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          'har-extract-core': `../${tarballName}`,
        },
      },
      testFile: 'test-esm.mjs',
      code: `import assert from 'assert';
import lib from 'har-extract-core';
assert(typeof lib.extractFilesFromHar === 'function');
assert(typeof lib.sanitizeSegment === 'function');
assert(lib.WINDOWS_RESERVED_NAMES instanceof Set);
console.log('✓ ESM imports work');`,
    },
    {
      name: 'Named exports extraction',
      packageJson: {
        name: 'test-named',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          'har-extract-core': `../${tarballName}`,
        },
      },
      testFile: 'test-named.mjs',
      code: `import assert from 'assert';
import {
  extractFilesFromHar,
  sanitizeSegment,
  extensionFromMime,
  MIME_EXTENSIONS
} from 'har-extract-core';
assert(typeof extractFilesFromHar === 'function');
assert(typeof sanitizeSegment === 'function');
assert(typeof extensionFromMime === 'function');
assert(MIME_EXTENSIONS && Object.keys(MIME_EXTENSIONS).length > 0);
console.log('✓ Named exports work');`,
    },
  ];
}

function setupTestScenario(testDir, scenario) {
  const scenarioDir = path.join(testDir, scenario.name.replace(/\s+/g, '-'));
  if (!fs.existsSync(scenarioDir)) {
    fs.mkdirSync(scenarioDir, { recursive: true });
  }

  fs.writeFileSync(
    path.join(scenarioDir, 'package.json'),
    JSON.stringify(scenario.packageJson, null, 2)
  );

  fs.writeFileSync(
    path.join(scenarioDir, scenario.testFile),
    scenario.code
  );

  return scenarioDir;
}

function runTest(testDir, scenario) {
  const scenarioDir = path.join(testDir, scenario.name.replace(/\s+/g, '-'));
  console.log(`  Installing dependencies in ${scenario.name}...`);
  run('npm', ['install'], scenarioDir);

  console.log(`  Running ${scenario.testFile}...`);
  run(process.execPath, [scenario.testFile], scenarioDir);
}

function main() {
  let tarballSource = null;

  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  try {
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
    fs.mkdirSync(runDir, { recursive: true });

    console.log(`Testing ${pkg.name}@${pkg.version}`);
    console.log(`Using isolated workspace: ${runDir}`);
    console.log('Packing module...');
    const packOutput = runCapture('npm', ['pack', '--json'], rootDir);
    const packData = JSON.parse(packOutput);
    const tarballName = packData[0] && packData[0].filename;

    if (!tarballName) {
      throw new Error('npm pack did not return a tarball filename.');
    }

    tarballSource = path.join(rootDir, tarballName);
    const tarballTarget = path.join(runDir, tarballName);
    fs.copyFileSync(tarballSource, tarballTarget);
    console.log(`Copied ${tarballName} to isolated workspace.`);

    const smokeTestSource = path.join(staticTestDir, 'smokeTest.js');
    const smokeTestTarget = path.join(runDir, 'smokeTest.js');
    if (!fs.existsSync(smokeTestSource)) {
      throw new Error(`Required smoke test file not found: ${smokeTestSource}`);
    }
    fs.copyFileSync(smokeTestSource, smokeTestTarget);

    console.log('\nGenerating dynamic test scenarios...');
    const scenarios = generateTestScenarios(tarballName);

    for (const scenario of scenarios) {
      console.log(`\n[${scenario.name}]`);
      setupTestScenario(runDir, scenario);
      runTest(runDir, scenario);
    }

    console.log('\nRunning primary smoke test suite...');
    console.log('Setting up isolated test workspace dependencies...');
    const testPackageJson = {
      name: 'har-extract-core-smoke-test',
      version: '1.0.0',
      dependencies: {
        'har-extract-core': `./${tarballName}`,
        'jszip': '^3.10.1',
      },
    };
    fs.writeFileSync(
      path.join(runDir, 'package.json'),
      JSON.stringify(testPackageJson, null, 2)
    );

    console.log('Installing dependencies...');
    run('npm', ['install'], runDir);

    console.log('Running smokeTest.js...');
    run(process.execPath, ['smokeTest.js'], runDir);

    console.log(`\n✅ Pack-and-test completed for ${pkg.name}@${pkg.version}`);
  } finally {
    if (fs.existsSync(runDir)) {
      fs.rmSync(runDir, { recursive: true, force: true });
    }
    if (tarballSource && fs.existsSync(tarballSource)) {
      fs.unlinkSync(tarballSource);
    }
  }
}

try {
  main();
} catch (error) {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
}