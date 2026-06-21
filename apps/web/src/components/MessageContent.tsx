import { useEffect, useState } from 'react';
import { Download, FileArchive, FileCode2, FileText } from 'lucide-react';

type Attachment = {
  name: string;
  mimeType: string;
  size: number;
  url: string;
};

function parseRichMedia(content: string) {
  const match = content.match(
    /^\[(giphy|sticker) id="([^"]+)" (?:title|name)="([^"]*)"\]\n(https?:\/\/[^\s]+)$/,
  );
  if (!match) return null;
  const [, kind, id, encodedLabel, url] = match;
  if (!kind || !id || !encodedLabel || !url) return null;
  try {
    return { kind, id, label: decodeURIComponent(encodedLabel), url };
  } catch {
    return null;
  }
}

function giphyEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.pathname.toLowerCase().endsWith('.gif')) return url;
    if (parsed.hostname === 'giphy.com' || parsed.hostname.endsWith('.giphy.com')) {
      const lastPart = parsed.pathname.split('/').filter(Boolean).at(-1);
      const id = lastPart?.split('-').at(-1);
      if (id && /^[a-zA-Z0-9]+$/.test(id)) {
        return `https://media.giphy.com/media/${id}/giphy.gif`;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function parseAttachment(content: string): Attachment | null {
  const match = content.match(
    /^\[attachment name="([^"]+)" type="([^"]+)" size="(\d+)"\]\n(https?:\/\/[^\s]+)$/,
  );
  if (!match) return null;
  const [, encodedName, encodedType, encodedSize, url] = match;
  if (!encodedName || !encodedType || !encodedSize || !url) return null;
  try {
    return {
      name: decodeURIComponent(encodedName),
      mimeType: decodeURIComponent(encodedType),
      size: Number(encodedSize),
      url,
    };
  } catch {
    return null;
  }
}

function extension(name: string) {
  return name.split('.').at(-1)?.toLowerCase() || 'ficheiro';
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${(size / 1024 ** 3).toFixed(1)} GB`;
}

function attachmentKind(file: Attachment) {
  const ext = extension(file.name);
  if (file.mimeType.startsWith('image/') && ext !== 'svg') return 'image';
  if (file.mimeType.startsWith('video/')) return 'video';
  if (file.mimeType.startsWith('audio/')) return 'audio';
  if (['apk', 'exe', 'msi', 'appimage', 'dmg', 'deb', 'rpm'].includes(ext)) return 'application';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  return 'document';
}

function AttachmentCard({ file }: { file: Attachment }) {
  const kind = attachmentKind(file);
  if (kind === 'image') {
    return (
      <a href={file.url} target="_blank" rel="noreferrer" className="gif-embed">
        <img src={file.url} alt={file.name} loading="lazy" />
        <small>{file.name} · {formatBytes(file.size)}</small>
      </a>
    );
  }
  if (kind === 'video') {
    return (
      <div className="attachment-preview">
        <video className="media-embed" src={file.url} controls preload="metadata" />
        <a href={file.url} target="_blank" rel="noreferrer">{file.name} · {formatBytes(file.size)}</a>
      </div>
    );
  }
  if (kind === 'audio') {
    return (
      <div className="attachment-preview">
        <audio className="audio-embed" src={file.url} controls preload="metadata" />
        <a href={file.url} target="_blank" rel="noreferrer">{file.name} · {formatBytes(file.size)}</a>
      </div>
    );
  }
  const Icon = kind === 'application' ? FileCode2 : kind === 'archive' ? FileArchive : FileText;
  const label = kind === 'application' ? 'Aplicação' : kind === 'archive' ? 'Arquivo' : 'Documento';
  return (
    <a className="document-attachment" href={file.url} target="_blank" rel="noreferrer">
      <span className="document-icon"><Icon /></span>
      <span>
        <strong>{file.name}</strong>
        <small>{label} {extension(file.name).toUpperCase()} · {formatBytes(file.size)}</small>
        <em>{file.url}</em>
      </span>
      <Download />
    </a>
  );
}

function isCdnUrl(value: string) {
  try {
    return new URL(value).pathname.startsWith('/cdn/');
  } catch {
    return false;
  }
}

function RemoteAttachmentPreview({ url }: { url: string }) {
  const [file, setFile] = useState<Attachment | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { method: 'HEAD', signal: controller.signal })
      .then((response) => {
        if (!response.ok) return;
        const mimeType = response.headers.get('content-type') || 'application/octet-stream';
        const size = Number(response.headers.get('content-length') || 0);
        const disposition = response.headers.get('content-disposition') || '';
        const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        const extensionByType: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
          'image/gif': 'gif',
          'image/avif': 'avif',
          'video/mp4': 'mp4',
          'video/webm': 'webm',
          'audio/mpeg': 'mp3',
          'audio/ogg': 'ogg',
          'application/pdf': 'pdf',
        };
        const ext = extensionByType[mimeType] || 'ficheiro';
        let name = `Anexo.${ext}`;
        if (encodedName) {
          try {
            name = decodeURIComponent(encodedName);
          } catch {
            // Keep the generic name when a legacy header is malformed.
          }
        }
        setFile({ name, mimeType, size, url });
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [url]);

  return file ? <AttachmentCard file={file} /> : null;
}

export function MessageContent({ content }: { content: string }) {
  const richMedia = parseRichMedia(content);
  if (richMedia) {
    return (
      <a
        href={richMedia.url}
        target="_blank"
        rel="noreferrer"
        className={richMedia.kind === 'sticker' ? 'sticker-message' : 'gif-embed'}
      >
        <img src={richMedia.url} alt={richMedia.label} loading="lazy" />
        {richMedia.kind === 'giphy' && <small>Powered by GIPHY</small>}
      </a>
    );
  }
  const attachment = parseAttachment(content);
  if (attachment) return <AttachmentCard file={attachment} />;

  const urls = content.match(/https?:\/\/[^\s]+/g) ?? [];
  const gifUrl = urls.map(giphyEmbedUrl).find(Boolean);
  const mediaUrl = urls.find((url) => /\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|mp3|ogg|wav)(?:\?.*)?$/i.test(url));
  const documentUrl = urls.find((url) => /\.(pdf|docx?|xlsx?|pptx?|txt|zip|rar|7z|apk|exe|msi)(?:\?.*)?$/i.test(url));
  const opaqueCdnUrl = urls.find(isCdnUrl);
  const parts = content.split(/(https?:\/\/[^\s]+)/g);
  return (
    <>
      <p>{parts.map((part, index) =>
        /^https?:\/\//.test(part)
          ? <a key={index} href={part} target="_blank" rel="noreferrer">{part}</a>
          : part,
      )}</p>
      {gifUrl ? (
        <a href={urls[0]} target="_blank" rel="noreferrer" className="gif-embed">
          <img src={gifUrl} alt="GIF enviado na conversa" loading="lazy" />
          {gifUrl.includes('giphy.com') && <small>via GIPHY</small>}
        </a>
      ) : mediaUrl && /\.(png|jpe?g|webp|avif)(?:\?.*)?$/i.test(mediaUrl) ? (
        <a href={mediaUrl} target="_blank" rel="noreferrer" className="gif-embed">
          <img src={mediaUrl} alt="Imagem anexada" loading="lazy" />
        </a>
      ) : mediaUrl && /\.(mp4|webm|mov)(?:\?.*)?$/i.test(mediaUrl) ? (
        <video className="media-embed" src={mediaUrl} controls preload="metadata" />
      ) : mediaUrl && /\.(mp3|ogg|wav)(?:\?.*)?$/i.test(mediaUrl) ? (
        <audio className="audio-embed" src={mediaUrl} controls preload="metadata" />
      ) : documentUrl ? (
        <a className="document-attachment compact" href={documentUrl} target="_blank" rel="noreferrer">
          <span className="document-icon"><FileText /></span>
          <span><strong>Documento {extension(documentUrl).toUpperCase()}</strong><em>{documentUrl}</em></span>
          <Download />
        </a>
      ) : opaqueCdnUrl ? (
        <RemoteAttachmentPreview url={opaqueCdnUrl} />
      ) : null}
    </>
  );
}
