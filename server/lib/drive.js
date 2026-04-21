const { getDriveClient } = require('./auth')
const { Readable } = require('stream')

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID

async function getOrCreateFolder(parentId, name) {
  const drive = await getDriveClient()
  const res = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id,name)',
    pageSize: 1,
  })
  if (res.data.files.length > 0) return res.data.files[0].id
  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
    fields: 'id',
  })
  return created.data.id
}

async function uploadFile(buffer, filename, mimeType, subfolders = []) {
  const drive = await getDriveClient()
  let parentId = FOLDER_ID
  for (const folder of subfolders) {
    parentId = await getOrCreateFolder(parentId, folder)
  }
  const res = await drive.files.create({
    requestBody: { name: filename, parents: [parentId] },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id,webViewLink',
  })
  // Make file readable by anyone with link
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  })
  return { id: res.data.id, url: res.data.webViewLink }
}

module.exports = { uploadFile }
