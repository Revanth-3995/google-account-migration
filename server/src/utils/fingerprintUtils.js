export function buildPhotoFingerprint(item) {
  const fileName = (item.mediaFile && item.mediaFile.filename) || item.filename || '';
  const mimeType = (item.mediaFile && item.mediaFile.mimeType) || item.mimeType || 'image/jpeg';
  const createTime = (item.mediaFile && item.mediaFile.createTime) || item.createTime || '';
  const width = (item.mediaFile && item.mediaFile.width) || (item.mediaMetadata && item.mediaMetadata.width) || '';
  const height = (item.mediaFile && item.mediaFile.height) || (item.mediaMetadata && item.mediaMetadata.height) || '';
  
  // Normalize fields to prevent discrepancies
  const safeFileName = String(fileName).trim();
  const safeMimeType = String(mimeType).trim().toLowerCase();
  
  let safeCreateTime = 'no_date';
  if (createTime) {
    try {
      safeCreateTime = new Date(createTime).toISOString();
    } catch(e) {
      safeCreateTime = String(createTime).trim();
    }
  }

  const safeWidth = String(width).trim() || '0';
  const safeHeight = String(height).trim() || '0';

  return `${safeFileName}|${safeCreateTime}|${safeWidth}|${safeHeight}|${safeMimeType}`;
}
