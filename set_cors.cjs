const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

function request(url, options, bodyData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

async function run() {
  try {
    const configPath = path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
    if (!fs.existsSync(configPath)) {
      throw new Error(`Firebase CLI config not found at: ${configPath}. Please run 'firebase login' first.`);
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const tokens = config.tokens || {};
    const refreshToken = tokens.refresh_token;
    
    if (!refreshToken) {
      throw new Error("No refresh token found in Firebase CLI config. Please run 'firebase login' in your terminal.");
    }
    
    console.log("Refreshing Google OAuth2 access token...");
    
    const tokenParams = new URLSearchParams({
      client_id: '763162099432-m544m2551tet192fg954shq01801c22n.apps.googleusercontent.com',
      client_secret: 'S-jV3JHF5Z5j4Jj_',
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    }).toString();
    
    const tokenRes = await request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(tokenParams)
      }
    }, tokenParams);
    
    let accessToken = tokens.access_token;
    if (tokenRes.statusCode === 200) {
      const tokenData = JSON.parse(tokenRes.body);
      accessToken = tokenData.access_token;
      console.log("Successfully refreshed access token.");
    } else {
      console.warn("Could not refresh token automatically, attempting to use current cached access token...");
    }
    
    if (!accessToken) {
      throw new Error("Access token is invalid or expired. Please run 'firebase login' to re-authenticate.");
    }

    const corsPath = path.join(__dirname, 'cors.json');
    if (!fs.existsSync(corsPath)) {
      throw new Error("cors.json file not found in the project root.");
    }
    const corsData = JSON.parse(fs.readFileSync(corsPath, 'utf8'));
    const corsBody = JSON.stringify({ cors: corsData });
    
    const possibleBuckets = [
      'cptracker911.firebasestorage.app',
      'cptracker911.appspot.com'
    ];
    
    let success = false;
    for (const bucket of possibleBuckets) {
      console.log(`Checking bucket: ${bucket}...`);
      const gcsUrl = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}`;
      
      const checkRes = await request(gcsUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (checkRes.statusCode === 200) {
        console.log(`Applying CORS configuration to bucket: ${bucket}...`);
        const updateRes = await request(gcsUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(corsBody)
          }
        }, corsBody);
        
        if (updateRes.statusCode === 200) {
          console.log(`CORS successfully configured on bucket: ${bucket}!`);
          console.log(JSON.parse(updateRes.body).cors);
          success = true;
        } else {
          console.error(`Failed to update CORS on ${bucket}: HTTP ${updateRes.statusCode} - ${updateRes.body}`);
        }
      } else {
        console.log(`Bucket ${bucket} could not be accessed (HTTP ${checkRes.statusCode}).`);
      }
    }
    
    if (!success) {
      console.error("\n[IMPORTANT] No active storage buckets found. Please ensure you have enabled Firebase Storage in your console (https://console.firebase.google.com/project/cptracker911/storage) and clicked 'Get Started' to provision the bucket.");
    }
    
  } catch (error) {
    console.error("Error setting CORS:", error.message);
  }
}

run();
