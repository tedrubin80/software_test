// Integration tests for TestLab complete system
const axios = require('axios');

describe('TestLab Integration Tests', () => {
    const BACKEND_URL = 'http://localhost:3001';
    const DIAGNOSTICS_URL = 'http://localhost:3002';
    
    test('Backend health check', async () => {
        const response = await axios.get(`${BACKEND_URL}/api/health`);
        expect(response.status).toBe(200);
    });
    
    test('Diagnostics health check', async () => {
        const response = await axios.get(`${DIAGNOSTICS_URL}/api/health`);
        expect(response.status).toBe(200);
    });
});
