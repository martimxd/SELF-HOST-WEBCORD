export const API_URL = import.meta.env.VITE_API_URL || '/api';

export type UploadedFile = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
};

export function attachmentMessage(upload: UploadedFile) {
  const url = new URL(upload.url, window.location.origin).toString();
  const name = encodeURIComponent(upload.originalName);
  const type = encodeURIComponent(upload.mimeType);
  return `[attachment name="${name}" type="${type}" size="${upload.size}"]\n${url}`;
}

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to selection-based copying outside secure browser contexts.
    }
  }
  const input = document.createElement('textarea');
  input.value = value;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  document.execCommand('copy');
  input.remove();
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init?.headers,
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = Array.isArray(body.details)
      ? [...new Set(body.details.map((item: { message?: string }) => item.message).filter(Boolean))]
      : [];
    throw new Error(details.length ? details.join('. ') : body.error || `Pedido falhou (${response.status})`);
  }
  return body as T;
}
