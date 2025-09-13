/**
 * Test Script Runner
 * Provides utilities for running tests with different configurations
 */

const { exec } = require('child_process');
const path = require('path');

class TestRunner {
  constructor() {
    this.jestConfig = path.join(__dirname, '../../jest.config.js');
  }

  /**
   * Run all tests
   */
  async runAll() {
    console.log('Running all tests...\n');
    return this.executeJest('');
  }

  /**
   * Run tests with coverage
   */
  async runWithCoverage() {
    console.log('Running tests with coverage...\n');
    return this.executeJest('--coverage');
  }

  /**
   * Run tests in watch mode
   */
  async runWatch() {
    console.log('Running tests in watch mode...\n');
    return this.executeJest('--watch');
  }

  /**
   * Run specific test suite
   */
  async runSuite(suiteName) {
    console.log(`Running ${suiteName} tests...\n`);
    return this.executeJest(`--testPathPattern=${suiteName}`);
  }

  /**
   * Run unit tests only
   */
  async runUnit() {
    console.log('Running unit tests...\n');
    return this.executeJest('--testPathPattern="(services|utils|middleware)" --testNamePattern="^(?!.*Integration)"');
  }

  /**
   * Run integration tests only
   */
  async runIntegration() {
    console.log('Running integration tests...\n');
    return this.executeJest('--testPathPattern=integration');
  }

  /**
   * Run tests for specific file
   */
  async runFile(filePath) {
    console.log(`Running tests for ${filePath}...\n`);
    return this.executeJest(`--testPathPattern=${filePath}`);
  }

  /**
   * Execute Jest with given arguments
   */
  executeJest(args) {
    return new Promise((resolve, reject) => {
      const command = `npx jest --config=${this.jestConfig} ${args}`;
      console.log(`Executing: ${command}\n`);

      const child = exec(command, { 
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env, NODE_ENV: 'test' }
      });

      child.stdout.on('data', (data) => {
        process.stdout.write(data);
      });

      child.stderr.on('data', (data) => {
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });
    });
  }

  /**
   * Generate test report
   */
  async generateReport() {
    console.log('Generating test report...\n');
    return this.executeJest('--coverage --coverageReporters=html --coverageReporters=json-summary');
  }

  /**
   * Validate test coverage
   */
  async validateCoverage() {
    console.log('Validating test coverage...\n');
    return this.executeJest('--coverage --coverageThreshold=\'{"global":{"branches":70,"functions":70,"lines":70,"statements":70}}\'');
  }

  /**
   * Run tests for CI/CD
   */
  async runCI() {
    console.log('Running tests for CI/CD...\n');
    return this.executeJest('--coverage --watchAll=false --passWithNoTests');
  }

  /**
   * Debug tests
   */
  async runDebug() {
    console.log('Running tests in debug mode...\n');
    return this.executeJest('--verbose --runInBand');
  }
}

// CLI interface
if (require.main === module) {
  const runner = new TestRunner();
  const command = process.argv[2];
  const arg = process.argv[3];

  async function executeCommand() {
    try {
      switch (command) {
        case 'all':
          await runner.runAll();
          break;
        case 'coverage':
          await runner.runWithCoverage();
          break;
        case 'watch':
          await runner.runWatch();
          break;
        case 'unit':
          await runner.runUnit();
          break;
        case 'integration':
          await runner.runIntegration();
          break;
        case 'suite':
          if (!arg) {
            console.error('Usage: node test-runner.js suite <suite-name>');
            process.exit(1);
          }
          await runner.runSuite(arg);
          break;
        case 'file':
          if (!arg) {
            console.error('Usage: node test-runner.js file <file-path>');
            process.exit(1);
          }
          await runner.runFile(arg);
          break;
        case 'report':
          await runner.generateReport();
          break;
        case 'validate':
          await runner.validateCoverage();
          break;
        case 'ci':
          await runner.runCI();
          break;
        case 'debug':
          await runner.runDebug();
          break;
        default:
          console.log('Available commands:');
          console.log('  all           - Run all tests');
          console.log('  coverage      - Run tests with coverage');
          console.log('  watch         - Run tests in watch mode');
          console.log('  unit          - Run unit tests only');
          console.log('  integration   - Run integration tests only');
          console.log('  suite <name>  - Run specific test suite');
          console.log('  file <path>   - Run tests for specific file');
          console.log('  report        - Generate test report');
          console.log('  validate      - Validate test coverage');
          console.log('  ci            - Run tests for CI/CD');
          console.log('  debug         - Run tests in debug mode');
          break;
      }
    } catch (error) {
      console.error('Test execution failed:', error.message);
      process.exit(1);
    }
  }

  executeCommand();
}

module.exports = TestRunner;