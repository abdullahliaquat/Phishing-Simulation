// Test script for sending emails with Nodemailer
const nodemailer = require('nodemailer');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to ask questions
function askQuestion(query) {
  return new Promise(resolve => {
    rl.question(query, answer => {
      resolve(answer);
    });
  });
}

async function testEmailFunctionality() {
  console.log('=== Email Test Tool ===');
  console.log('This script will test if Nodemailer can send emails using your credentials');
  
  // Get email credentials
  const email = await askQuestion('Enter your Gmail address: ');
  const password = await askQuestion('Enter your app password: ');
  const recipient = await askQuestion('Enter recipient email address: ');
  
  console.log('\nTesting email functionality...');
  
  // Create transporter with additional timeout options
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password
    },
    tls: {
      rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000 // 15 seconds
  });
  
  // Verify connection
  try {
    console.log('Verifying connection...');
    console.log('Attempting to connect to SMTP server...');
    const connectionResult = await transporter.verify();
    console.log('Connection verified successfully:', connectionResult);
    
    // Prepare test email
    const mailOptions = {
      from: `"Email Test" <${email}>`,
      to: recipient,
      subject: 'Test Email from Instagram Phishing Project',
      text: 'This is a test email to verify that the email functionality is working properly.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
          <h2>Test Email</h2>
          <p>This is a test email to verify that the email functionality is working properly.</p>
          <p>If you received this email, it means your email configuration is correct!</p>
          <p style="background-color: #f8f8f8; padding: 10px; border-radius: 5px;">
            <strong>Next steps:</strong><br>
            1. Update your .env file with these credentials<br>
            2. Restart your server<br>
            3. Create a campaign from the admin dashboard
          </p>
        </div>
      `
    };
    
    // Send test email with timeout
    console.log('Sending test email...');
    
    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Email sending timed out after 15 seconds')), 15000);
    });
    
    // Race the email sending against timeout
    const emailPromise = new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) reject(error);
        else resolve(info);
      });
    });
    
    const info = await Promise.race([emailPromise, timeoutPromise]);
    console.log('Test email sent successfully!');
    console.log('Message ID:', info.messageId);
    
    // Create .env file
    const envPath = path.join(__dirname, '.env');
    const envContent = `PORT=5678
EMAIL_USER=${email}
EMAIL_PASS=${password}
# Optional: EMAIL_TO=${recipient}`;

    try {
      fs.writeFileSync(envPath, envContent);
      console.log('\n✅ .env file created successfully!');
    } catch (err) {
      console.log('\n⚠️ Could not automatically create .env file due to:', err.message);
      console.log('Please create it manually with the content below:');
    }
    
    // Provide instructions
    console.log('\n=== Configuration Instructions ===');
    console.log('Your .env file should contain:');
    console.log(`
PORT=5678
EMAIL_USER=${email}
EMAIL_PASS=${password}
`);
    console.log('Restart your server with: npm start');
    
    console.log('\n=== Troubleshooting ===');
    console.log('If you still experience timeouts when sending emails:');
    console.log('1. Check if your network allows SMTP connections (port 465)');
    console.log('2. Try using a mobile hotspot as some networks block email traffic');
    console.log('3. Verify the app password is correct and hasn\'t expired');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    console.log('\nEmail test failed. Check your credentials and try again.');
    
    // Provide specific advice based on error code
    if (error.code === 'EAUTH') {
      console.log('\nAuthentication failed. Make sure you are using an App Password if you have 2FA enabled.');
      console.log('To generate an App Password:');
      console.log('1. Go to your Google Account settings (https://myaccount.google.com)');
      console.log('2. Navigate to Security > App passwords');
      console.log('3. Select "Mail" and "Other (Custom name)" and enter "Instagram Phishing"');
      console.log('4. Click "Generate" and use the generated 16-character password');
    }
    
    if (error.code === 'ESOCKET' || error.code === 'ETIMEDOUT') {
      console.log('\nConnection issue or timeout. Possible reasons:');
      console.log('- Your network is blocking SMTP connections (port 465)');
      console.log('- Gmail servers are temporarily unavailable');
      console.log('- Your internet connection is unstable');
      console.log('\nTry using a different network or mobile hotspot.');
    }
    
    if (error.message === 'Email sending timed out after 15 seconds') {
      console.log('\nThe email sending process took too long and timed out.');
      console.log('This usually indicates network issues or blocked ports.');
      console.log('1. Try a different network (mobile hotspot)');
      console.log('2. Check if your firewall is blocking port 465');
      console.log('3. Try increasing the timeout in the script');
    }
    
    console.log('\nIf problems persist, you can still use the application without email functionality.');
    console.log('Captured data will be stored locally in the captured_data directory.');
  }
  
  rl.close();
}

testEmailFunctionality(); 