// MessageBird configuration
export const SMS_CONFIG = {
  MESSAGEBIRD_API_KEY: process.env.MESSAGEBIRD_API_KEY || '',
  MESSAGEBIRD_ORIGINATOR: process.env.MESSAGEBIRD_ORIGINATOR || 'YourBrand', // This will be your sender ID
  TEST_MODE: process.env.NODE_ENV !== 'production'
}; 