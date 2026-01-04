/**
 * Quick test script to verify NYC data APIs are working
 */

import { fetchDOBPermits, normalizeDOBPermit } from '../src/ingest/dob.js';
import { fetchZAPProjects, normalizeZAPProject } from '../src/ingest/zap.js';
import { fetchCapitalProjects, normalizeCapitalProject } from '../src/ingest/capital.js';

async function testDOB() {
  console.log('\n=== Testing DOB Permits API ===');
  try {
    const permits = await fetchDOBPermits({
      limit: 5,
      offset: 0,
    });
    console.log(`Fetched ${permits.length} DOB permits`);

    if (permits.length > 0) {
      console.log('\nSample raw permit:');
      console.log(JSON.stringify(permits[0], null, 2));

      const normalized = normalizeDOBPermit(permits[0]!);
      console.log('\nNormalized event:');
      console.log(JSON.stringify(normalized, null, 2));
    }
    return true;
  } catch (error) {
    console.error('DOB API error:', error);
    return false;
  }
}

async function testZAP() {
  console.log('\n=== Testing ZAP Projects API ===');
  try {
    const projects = await fetchZAPProjects({
      limit: 5,
      offset: 0,
    });
    console.log(`Fetched ${projects.length} ZAP projects`);

    if (projects.length > 0) {
      console.log('\nSample raw project:');
      console.log(JSON.stringify(projects[0], null, 2));

      const normalized = normalizeZAPProject(projects[0]!);
      console.log('\nNormalized event:');
      console.log(normalized ? JSON.stringify(normalized, null, 2) : 'null (status not tracked)');
    }
    return true;
  } catch (error) {
    console.error('ZAP API error:', error);
    return false;
  }
}

async function testCapital() {
  console.log('\n=== Testing Capital Projects API ===');
  try {
    const projects = await fetchCapitalProjects({
      limit: 5,
      offset: 0,
    });
    console.log(`Fetched ${projects.length} Capital projects`);

    if (projects.length > 0) {
      console.log('\nSample raw project:');
      console.log(JSON.stringify(projects[0], null, 2));

      const normalized = normalizeCapitalProject(projects[0]!);
      console.log('\nNormalized event:');
      console.log(normalized ? JSON.stringify(normalized, null, 2) : 'null');
    }
    return true;
  } catch (error) {
    console.error('Capital API error:', error);
    return false;
  }
}

async function main() {
  console.log('Testing NYC Data APIs...\n');

  const results = await Promise.all([
    testDOB(),
    testZAP(),
    testCapital(),
  ]);

  console.log('\n=== Summary ===');
  console.log(`DOB API: ${results[0] ? '✅ Working' : '❌ Failed'}`);
  console.log(`ZAP API: ${results[1] ? '✅ Working' : '❌ Failed'}`);
  console.log(`Capital API: ${results[2] ? '✅ Working' : '❌ Failed'}`);
}

main().catch(console.error);
