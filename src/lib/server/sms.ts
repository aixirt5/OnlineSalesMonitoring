// For demonstration/student purposes, we're using a mock SMS service
// In a production environment, you would integrate with a real SMS service

import nodemailer from 'nodemailer';

// Function to format phone number and determine carrier
function formatPhoneNumber(phoneNumber: string): { 
  formatted: string;
  prefix: string;
} {
  // Remove any non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // If number starts with 0, remove it
  const number = cleaned.startsWith('0') ? cleaned.substring(1) : 
                cleaned.startsWith('63') ? cleaned.substring(2) : 
                cleaned;

  // Get the prefix (first 3 digits after removing country code)
  const prefix = number.substring(0, 3);
  
  return {
    formatted: number,
    prefix
  };
}

// Function to get SMS gateway email based on prefix
function getSMSGateway(prefix: string, phoneNumber: string): string | null {
  const carrierPrefixes = {
    globe: ['905', '906', '915', '916', '917', '926', '927', '935', '936', '937', '945', '955', '965', '975', '995'],
    smart: ['907', '908', '909', '910', '912', '918', '919', '920', '921', '928', '929', '930', '938', '939', '946', '947', '949', '951', '961', '998', '999'],
    sun: ['922', '923', '924', '925', '931', '932', '933', '934', '940', '941', '942', '943', '973', '974']
  };

  if (carrierPrefixes.globe.includes(prefix)) {
    return `${phoneNumber}@sms.globe.com.ph`;
  } else if (carrierPrefixes.smart.includes(prefix)) {
    return `${phoneNumber}@sms.smart.com.ph`;
  } else if (carrierPrefixes.sun.includes(prefix)) {
    return `${phoneNumber}@sms.sun.com.ph`;
  }

  return null;
}

export async function sendSMSOTP(phoneNumber: string, otp: string): Promise<void> {
  try {
    // Validate phone number exists
    if (!phoneNumber) {
      throw new Error('Phone number is required');
    }

    // Format phone number and get carrier
    const { formatted, prefix } = formatPhoneNumber(phoneNumber);
    
    // Get SMS gateway email
    const gatewayEmail = getSMSGateway(prefix, formatted);

    if (!gatewayEmail) {
      throw new Error('Unsupported carrier or invalid phone number prefix');
    }

    // Log the attempt (for debugging)
    console.log('Attempting to send SMS OTP:');
    console.log('- Phone Number:', formatted);
    console.log('- Gateway:', gatewayEmail);
    console.log('- OTP:', otp);

    // Create email transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Send SMS via email gateway
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: gatewayEmail,
      subject: 'OTP',
      text: `Your verification code is: ${otp}. This code will expire in 5 minutes.`,
    });

    console.log('SMS sent successfully via email gateway');
    
    // For testing purposes in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('==================================');
      console.log('🔐 TEST MODE: Your OTP is:', otp);
      console.log('==================================');
    }

    return;
  } catch (error) {
    console.error('Error in sendSMSOTP:', error);
    throw new Error('Failed to send SMS OTP: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
} 