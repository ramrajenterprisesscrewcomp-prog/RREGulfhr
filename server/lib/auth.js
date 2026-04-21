const { google } = require('googleapis')

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
})

async function getSheetsClient() {
  const authClient = await auth.getClient()
  return google.sheets({ version: 'v4', auth: authClient })
}

async function getDriveClient() {
  const authClient = await auth.getClient()
  return google.drive({ version: 'v3', auth: authClient })
}

module.exports = { getSheetsClient, getDriveClient }
