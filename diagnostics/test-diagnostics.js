// Test script for Multi-AI Website Diagnostics Tool
const axios = require('axios');

const API_BASE = 'http://localhost:3002/api';

async function testHealth() {
    try {
        const response = await axios.get(`${API_BASE}/health`);
        console.log('✅ Health check passed:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Health check failed:', error.message);
        return false;
    }
}

async function testDiagnostics() {
    try {
        const response = await axios.post(`${API_BASE}/diagnose-website`, {
            url: 'https://example.com'
        });
        console.log('✅ Diagnostics test passed:', response.data);
        return true;
    } catch (error) {
        console.log('❌ Diagnostics test failed:', error.message);
        return false;
    }
}

async function runTests() {
    console.log('🔍 Running Multi-AI Diagnostics Tests...\n');
    
    const healthPass = await testHealth();
    const diagnosticsPass = await testDiagnostics();
    
    console.log('\n📊 Test Results:');
    console.log(`Health Check: ${healthPass ? 'PASS' : 'FAIL'}`);
    console.log(`Diagnostics: ${diagnosticsPass ? 'PASS' : 'FAIL'}`);
    
    if (healthPass && diagnosticsPass) {
        console.log('\n🎉 All tests passed! System is ready.');
        process.exit(0);
    } else {
        console.log('\n❌ Some tests failed. Check the server.');
        process.exit(1);
    }
}

runTests();
