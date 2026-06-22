export function contentCategory(content: string) {
  const value = content.toLowerCase();
  const attachmentType = value.match(/^\[attachment [^\]]*\btype="([^"]+)"/)?.[1];
  let decodedAttachmentType = attachmentType || '';
  try {
    decodedAttachmentType = decodeURIComponent(decodedAttachmentType);
  } catch {
    decodedAttachmentType = attachmentType || '';
  }
  if (
    decodedAttachmentType.startsWith('image/')
    || /\.(png|jpe?g|webp|gif|avif)(?:[?\s]|$)/.test(value)
    || value.startsWith('[sticker')
  ) {
    return 'images';
  }
  if (
    decodedAttachmentType.startsWith('video/')
    || /\.(mp4|webm|mov)(?:[?\s]|$)/.test(value)
  ) {
    return 'videos';
  }
  if (
    value.startsWith('[attachment')
    || /\.(pdf|docx?|xlsx?|pptx?|txt|zip|rar|7z|apk|exe|msi)(?:[?\s]|$)/.test(value)
  ) {
    return 'files';
  }
  if (/https?:\/\//.test(value)) return 'links';
  return 'messages';
}

export function matchesSearchCategory(content: string, category: string) {
  return category === 'messages'
    ? contentCategory(content) === 'messages'
    : contentCategory(content) === category;
}
