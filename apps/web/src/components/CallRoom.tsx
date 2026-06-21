import { useState } from 'react';
import { LiveKitRoom, VideoConference } from '@livekit/components-react';
import { Mic, Video } from 'lucide-react';
import { api } from '../api';
import { qualityProfiles, type QualityProfile } from '@webcord/shared';

type CallRoomProps = {
  name: string;
  tokenEndpoint: string;
  videoEnabled: boolean;
};

export function CallRoom({ name, tokenEndpoint, videoEnabled }: CallRoomProps) {
  const [token, setToken] = useState('');
  const [quality, setQuality] = useState<QualityProfile>('medium');
  const [error, setError] = useState('');
  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL
    || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/livekit`;

  const join = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setError('Este navegador não suporta chamadas WebRTC.');
      return;
    }
    try {
      const result = await api<{ token: string }>(tokenEndpoint, { method: 'POST' });
      setToken(result.token);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!token) {
    return (
      <div className="call-lobby">
        <div className="call-icon">{videoEnabled ? <Video /> : <Mic />}</div>
        <h1>{name}</h1>
        <p>Confirma a qualidade e entra na sala. Podes alterar microfone e câmara depois.</p>
        <label>Qualidade
          <select value={quality} onChange={(e) => setQuality(e.target.value as QualityProfile)}>
            <option value="low">480p · 25 fps</option>
            <option value="medium">720p · 30 fps</option>
            <option value="high">1080p · 60 fps</option>
          </select>
        </label>
        <button className="primary" onClick={join}>Entrar na chamada</button>
        {error && <div className="form-error">{error}</div>}
      </div>
    );
  }

  const profile = qualityProfiles[quality];
  return (
    <div className="livekit-shell">
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect
        video={videoEnabled ? { resolution: { width: profile.width, height: profile.height, frameRate: profile.frameRate } } : false}
        audio
        onDisconnected={() => setToken('')}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
