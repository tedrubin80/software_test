#!/usr/bin/env node
// FILE LOCATION: /simple-server.js (root directory)
// This file ensures we use the correct server with volume support for Railway deployment

// Redirect to the frontend server which has proper volume support
require('./frontend/simple-server.js');