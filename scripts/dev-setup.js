/**
 * Development Setup Script
 * Sets up the development environment for Ray Browser Extension
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Ray Browser Extension development environment...\n');

// Check if Node.js is installed
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`✓ Node.js version: ${nodeVersion}`);
} catch (error) {
  console.error('❌ Node.js is not installed. Please install Node.js first.');
  process.exit(1);
}

// Check if npm is installed
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✓ npm version: ${npmVersion}`);
} catch (error) {
  console.error('❌ npm is not installed. Please install npm first.');
  process.exit(1);
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✓ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Create necessary directories if they don't exist
const directories = [
  'dist',
  '.wxt',
  'logs'
];

console.log('\n📁 Creating necessary directories...');
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created ${dir} directory`);
  } else {
    console.log(`✓ ${dir} directory already exists`);
  }
});

// Check if Chrome is available for development
console.log('\n🌐 Checking Chrome availability...');
try {
  if (process.platform === 'win32') {
    execSync('where chrome', { stdio: 'ignore' });
  } else if (process.platform === 'darwin') {
    execSync('which /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome', { stdio: 'ignore' });
  } else {
    execSync('which google-chrome', { stdio: 'ignore' });
  }
  console.log('✓ Chrome browser found');
} catch (error) {
  console.log('⚠️  Chrome browser not found in PATH. You may need to specify Chrome path manually.');
}

// Create development configuration
const devConfig = {
  development: {
    watch: true,
    hmr: true,
    browser: 'chrome'
  },
  build: {
    minify: false,
    sourcemap: true
  }
};

const configPath = path.join(process.cwd(), '.wxt/dev.config.json');
if (!fs.existsSync(path.dirname(configPath))) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}

fs.writeFileSync(configPath, JSON.stringify(devConfig, null, 2));
console.log('✓ Development configuration created');

// Display next steps
console.log('\n🎉 Development setup complete!\n');
console.log('Next steps:');
console.log('1. Run "npm run dev" to start development server');
console.log('2. Load the extension in Chrome:');
console.log('   - Open Chrome and go to chrome://extensions/');
console.log('   - Enable "Developer mode"');
console.log('   - Click "Load unpacked" and select the dist folder');
console.log('   - The extension will auto-reload on changes');
console.log('\n3. Run "npm run lint" to check code quality');
console.log('4. Run "npm run build" to create production build');
console.log('\n📚 For more information, see README.md');
console.log('\nHappy coding! 🚀'); * Development Setup Script
 * Sets up the development environment for Ray Browser Extension
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Ray Browser Extension development environment...\n');

// Check if Node.js is installed
try {
  const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
  console.log(`✓ Node.js version: ${nodeVersion}`);
} catch (error) {
  console.error('❌ Node.js is not installed. Please install Node.js first.');
  process.exit(1);
}

// Check if npm is installed
try {
  const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
  console.log(`✓ npm version: ${npmVersion}`);
} catch (error) {
  console.error('❌ npm is not installed. Please install npm first.');
  process.exit(1);
}

// Install dependencies
console.log('\n📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✓ Dependencies installed successfully');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Create necessary directories if they don't exist
const directories = [
  'dist',
  '.wxt',
  'logs'
];

console.log('\n📁 Creating necessary directories...');
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created ${dir} directory`);
  } else {
    console.log(`✓ ${dir} directory already exists`);
  }
});

// Check if Chrome is available for development
console.log('\n🌐 Checking Chrome availability...');
try {
  if (process.platform === 'win32') {
    execSync('where chrome', { stdio: 'ignore' });
  } else if (process.platform === 'darwin') {
    execSync('which /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome', { stdio: 'ignore' });
  } else {
    execSync('which google-chrome', { stdio: 'ignore' });
  }
  console.log('✓ Chrome browser found');
} catch (error) {
  console.log('⚠️  Chrome browser not found in PATH. You may need to specify Chrome path manually.');
}

// Create development configuration
const devConfig = {
  development: {
    watch: true,
    hmr: true,
    browser: 'chrome'
  },
  build: {
    minify: false,
    sourcemap: true
  }
};

const configPath = path.join(process.cwd(), '.wxt/dev.config.json');
if (!fs.existsSync(path.dirname(configPath))) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}

fs.writeFileSync(configPath, JSON.stringify(devConfig, null, 2));
console.log('✓ Development configuration created');

// Display next steps
console.log('\n🎉 Development setup complete!\n');
console.log('Next steps:');
console.log('1. Run "npm run dev" to start development server');
console.log('2. Load the extension in Chrome:');
console.log('   - Open Chrome and go to chrome://extensions/');
console.log('   - Enable "Developer mode"');
console.log('   - Click "Load unpacked" and select the dist folder');
console.log('   - The extension will auto-reload on changes');
console.log('\n3. Run "npm run lint" to check code quality');
console.log('4. Run "npm run build" to create production build');
console.log('\n📚 For more information, see README.md');
console.log('\nHappy coding! 🚀');
