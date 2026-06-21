import { Image, Search, Sticker as StickerIcon, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import type { GiphyGif, Sticker } from '../types';

export function MediaPicker({
  initialTab,
  onClose,
  onSend,
}: {
  initialTab: 'gifs' | 'stickers';
  onClose: () => void;
  onSend: (content: string) => Promise<void>;
}) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyGif[]>([]);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadGifs = async (search = '') => {
    setLoading(true);
    setError('');
    try {
      const result = await api<{ gifs: GiphyGif[] }>(
        `/giphy/search?q=${encodeURIComponent(search)}`,
      );
      setGifs(result.gifs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadStickers = async () => {
    setLoading(true);
    try {
      const result = await api<{ stickers: Sticker[] }>('/stickers');
      setStickers(result.stickers);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'gifs') loadGifs();
    else loadStickers();
  }, [tab]);

  const sendGif = async (gif: GiphyGif) => {
    await onSend(`[giphy id="${gif.id}" title="${encodeURIComponent(gif.title)}"]\n${gif.url}`);
    if (gif.analyticsOnSend) {
      api('/giphy/analytics', {
        method: 'POST',
        body: JSON.stringify({ url: gif.analyticsOnSend }),
      }).catch(() => undefined);
    }
    onClose();
  };

  const sendSticker = async (sticker: Sticker) => {
    const url = new URL(sticker.url, window.location.origin).toString();
    await onSend(`[sticker id="${sticker.id}" name="${encodeURIComponent(sticker.name)}"]\n${url}`);
    onClose();
  };

  const uploadSticker = async (file: File) => {
    const form = new FormData();
    form.append('name', file.name.replace(/\.[^.]+$/, '').slice(0, 40));
    form.append('file', file);
    try {
      const result = await api<{ sticker: Sticker }>('/stickers', { method: 'POST', body: form });
      setStickers((items) => [result.sticker, ...items]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteSticker = async (id: string) => {
    await api(`/stickers/${id}`, { method: 'DELETE' });
    setStickers((items) => items.filter((sticker) => sticker.id !== id));
  };

  return (
    <div className="media-picker">
      <header>
        <button className={tab === 'gifs' ? 'active' : ''} onClick={() => setTab('gifs')}><Image /> GIFs</button>
        <button className={tab === 'stickers' ? 'active' : ''} onClick={() => setTab('stickers')}><StickerIcon /> Figurinhas</button>
        <button className="picker-close" onClick={onClose}><X /></button>
      </header>
      {tab === 'gifs' ? (
        <>
          <form className="picker-search" onSubmit={(event) => { event.preventDefault(); loadGifs(query); }}>
            <Search />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar no GIPHY" maxLength={50} />
          </form>
          <div className="giphy-grid">
            {gifs.map((gif) => (
              <button key={gif.id} onClick={() => sendGif(gif)} title={gif.title}>
                <img src={gif.previewUrl} alt={gif.title} loading="lazy" />
              </button>
            ))}
          </div>
          {!loading && !error && <small className="giphy-attribution">Powered by GIPHY</small>}
        </>
      ) : (
        <>
          <label className="sticker-upload">
            <Upload /> Criar figurinha
            <input type="file" accept="image/png,image/webp,image/gif" onChange={(event) => event.target.files?.[0] && uploadSticker(event.target.files[0])} />
          </label>
          <div className="sticker-grid">
            {stickers.map((sticker) => (
              <div key={sticker.id}>
                <button className="sticker-send" onClick={() => sendSticker(sticker)}>
                  <img src={sticker.url} alt={sticker.name} loading="lazy" />
                  <span>{sticker.name}</span>
                </button>
                <button className="sticker-delete" onClick={() => deleteSticker(sticker.id)} title="Excluir figurinha"><Trash2 /></button>
              </div>
            ))}
          </div>
          {!stickers.length && !loading && <p className="picker-empty">Cria a tua primeira figurinha PNG, WEBP ou GIF.</p>}
        </>
      )}
      {loading && <p className="picker-empty">A carregar…</p>}
      {error && <div className="form-error picker-error">{error}</div>}
    </div>
  );
}
