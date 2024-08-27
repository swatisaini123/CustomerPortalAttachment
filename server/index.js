const express = require('express');
const multer = require('multer');
const axios = require('axios');
const cors = require('cors');
const FormData = require('form-data'); // Import form-data module
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3003;

// Configure multer for file upload handling
const storage = multer.memoryStorage(); // Store files in memory
const upload = multer({ storage });
app.use(cors());

const clientId = "1000.ASUBTHHM42Y6IKGEM9QKX0Z3O9KP4O";
const clientSecret = "ac6b1ad4bef873dc09df47a9a03685a9ba470357d0";
const redirectUri = "https://crm.zoho.com/crm/org730932612";
const refreshToken = "1000.0d5832856292297a31191f6c9ee3d0e3.1ca05bcea6e676b7ddb0276cd762ae14";

const tokenFilePath = path.join(__dirname, 'token.json'); // Path to store token

// Function to get the access token
async function getAccessToken() {
    let tokenData = {};

    // Read the existing token data if the file exists
    if (fs.existsSync(tokenFilePath)) {
        tokenData = await fs.promises.readFile(tokenFilePath, 'utf8').then(JSON.parse).catch(() => ({}));
    }

    const now = new Date();

    // Check if the existing token is valid
    if (tokenData.accessToken && tokenData.expiry && new Date(tokenData.expiry) > now) {
        return tokenData.accessToken;
    }

    // Token is not valid or does not exist; request a new one
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('refresh_token', refreshToken);
    params.append('redirect_uri', redirectUri);

    try {
        const tokenResponse = await axios.post('https://accounts.zoho.com/oauth/v2/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const accessToken = tokenResponse.data.access_token;
        const tokenExpiry = new Date(Date.now() + (3600 * 1000)); // Token valid for 1 hour

        tokenData = {
            accessToken,
            expiry: tokenExpiry
        };

        // Write the new token data to the file
        await fs.promises.writeFile(tokenFilePath, JSON.stringify(tokenData), 'utf8');

        return accessToken;
    } catch (error) {
        console.error('Token Fetch Error:', error.response ? error.response.data : error.message);
        throw new Error('Error fetching access token: ' + error.message);
    }
}

// Endpoint for handling file uploads
app.post('/uploading_Attachments', upload.array('files[]'), async (req, res) => {
    try {
        // Extract the deal ID and files from the request
        const dealId = req.body.dealId;
        const files = req.files;

        if (!dealId || !files || files.length === 0) {
            console.error('Deal ID or files missing.');
            return res.status(400).send('Deal ID or files missing.');
        }

        // Obtain access token from Zoho using our token management function
        const accessToken = await getAccessToken();
        console.log('Access Token:', accessToken);

        // Attach files to Zoho CRM deal
        const attachmentsPromises = files.map(file => {
            const form = new FormData();
            form.append('file', file.buffer, {
                filename: file.originalname,
                contentType: file.mimetype
            });

            return axios.post(`https://www.zohoapis.com/crm/v2/Deals/${dealId}/Attachments`, form, {
                headers: {
                    'Authorization': `Zoho-oauthtoken ${accessToken}`,
                    ...form.getHeaders() // Ensure correct Content-Type and boundary are set
                }
            }).catch(error => {
                console.error('Error uploading file:', error.response ? error.response.data : error.message);
            });
        });

        await Promise.all(attachmentsPromises);

        res.status(200).send('Files uploaded successfully!');
    } catch (error) {
        console.error('Upload Error:', error.response ? error.response.data : error.message); // Log detailed error message
        res.status(500).send('Error uploading files or fetching data from Zoho: ' + error.message);
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
