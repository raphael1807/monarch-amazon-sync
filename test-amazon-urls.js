#!/usr/bin/env node
/**
 * Test script to verify Amazon.ca URLs are correctly configured
 * Run with: node test-amazon-urls.js
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing Amazon URL Configuration for Canada\n');
console.log('='.repeat(50));

// Read the amazonApi.ts file
const amazonApiPath = join(__dirname, 'src', 'shared', 'api', 'amazonApi.ts');
let content;

try {
  content = readFileSync(amazonApiPath, 'utf-8');
} catch (error) {
  console.error('❌ Error reading amazonApi.ts:', error.message);
  process.exit(1);
}

// Test for expected Amazon.ca URLs
const tests = [
  {
    name: 'ORDER_PAGES_URL',
    pattern: /ORDER_PAGES_URL\s*=\s*['"]https:\/\/www\.amazon\.ca\//,
    description: 'Main order history URL should use amazon.ca',
  },
  {
    name: 'ORDER_RETURNS_URL',
    pattern: /ORDER_RETURNS_URL\s*=\s*['"]https:\/\/www\.amazon\.ca\//,
    description: 'Returns/refunds URL should use amazon.ca',
  },
  {
    name: 'ORDER_INVOICE_URL',
    pattern: /ORDER_INVOICE_URL\s*=\s*['"]https:\/\/www\.amazon\.ca\//,
    description: 'Invoice URL should use amazon.ca',
  },
];

// Check for any .com references (should not exist)
const antiTests = [
  {
    name: 'No amazon.com references',
    pattern: /amazon\.com/g,
    description: 'Should NOT contain amazon.com URLs',
    shouldNotMatch: true,
  },
];

let passed = 0;
let failed = 0;

console.log('\n✅ Canadian URL Tests:\n');

// Run positive tests
tests.forEach(test => {
  if (test.pattern.test(content)) {
    console.log(`✅ ${test.name}: PASS`);
    console.log(`   ${test.description}\n`);
    passed++;
  } else {
    console.log(`❌ ${test.name}: FAIL`);
    console.log(`   ${test.description}\n`);
    failed++;
  }
});

console.log('⚠️  Validation Tests:\n');

// Run negative tests
antiTests.forEach(test => {
  const matches = content.match(test.pattern);
  if (matches && test.shouldNotMatch) {
    console.log(`❌ ${test.name}: FAIL`);
    console.log(`   ${test.description}`);
    console.log(`   Found ${matches.length} occurrence(s) of amazon.com\n`);
    failed++;
  } else if (!matches && test.shouldNotMatch) {
    console.log(`✅ ${test.name}: PASS`);
    console.log(`   ${test.description}\n`);
    passed++;
  }
});

console.log('='.repeat(50));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 All tests passed! Amazon.ca URLs are correctly configured.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please check the amazonApi.ts file.\n');
  process.exit(1);
}
