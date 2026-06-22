import { useState } from 'react';
import {
  ControlBar,
  LayoutContextProvider,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  VideoTrack,
  useTracks,
} from '@livekit/components-react';
import { Mic, MicOff, MonitorUp, Video } from 'lucide-react';
import { Track } from 'livekit-client';
import { api } from '../api';
import { qualityProfiles, type QualityProfile } from '@webcord/shared';

type CallRoomProps = {
  name: string;
  tokenEndpoint: string;
  videoEnabled: boolean;
};

function CallStage() {
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  return (
    <div className="call-experience">
      <div className="call-grid" style={{ '--participant-count': tracks.length } as React.CSSProperties}>
        {tracks.map((trackRef) => {
          const participant = trackRef.participant;
          const hasVisibleVideo = Boolean(
            trackRef.publication
            && !trackRef.publication.isMuted
            && trackRef.publication.track,
          );
          const cameraOff = trackRef.source === Track.Source.Camera && !hasVisibleVideo;
          const microphone = participant.getTrackPublication(Track.Source.Microphone);
          let avatarUrl = '';
          try {
            avatarUrl = JSON.parse(participant.metadata || '{}').avatarUrl || '';
          } catch {
            avatarUrl = '';
          }
          return (
            <div
              className={`call-participant ${participant.isSpeaking ? 'speaking' : ''}`}
              key={`${participant.identity}-${trackRef.source}`}
            >
              <ParticipantTile trackRef={trackRef} disableSpeakingIndicator>
                <>{hasVisibleVideo && <VideoTrack />}</>
              </ParticipantTile>
              {cameraOff && (
                <div className="call-avatar-placeholder">
                  {avatarUrl
                    ? <img src={avatarUrl} alt={participant.name || participant.identity} />
                    : <span>{(participant.name || participant.identity)[0]?.toUpperCase()}</span>}
                </div>
              )}
              <div className="call-participant-label">
                {trackRef.source === Track.Source.ScreenShare && <MonitorUp size={14} />}
                <strong>{participant.name || participant.identity}</strong>
                {microphone?.isMuted ? <MicOff size={15} /> : <Mic size={15} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="call-controls">
        <ControlBar
          variation="minimal"
          controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true, settings: true }}
        />
      </div>
      <RoomAudioRenderer />
    </div>
  );
}

export function CallRoom({ name, tokenEndpoint, videoEnabled }: CallRoomProps) {
  const [token, setToken] = useState('');
  const [quality, setQuality] = useState<QualityProfile>('medium');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL
    || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/livekit`;

  const join = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setError('Este navegador não suporta chamadas WebRTC.');
      return;
    }
    setJoining(true);
    setError('');
    try {
      const result = await api<{ token: string }>(tokenEndpoint, { method: 'POST' });
      setToken(result.token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoining(false);
    }
  };

  if (!token) {
    return (
      <div className="call-lobby">
        <div className="call-icon">{videoEnabled ? <Video /> : <Mic />}</div>
        <span className="eyebrow">SALA DE CHAMADA</span>
        <h1>{name}</h1>
        <p>Escolhe a qualidade inicial e entra. Dentro da sala podes controlar o microfone, a câmara e a partilha de ecrã.</p>
        <label>Qualidade
          <select value={quality} onChange={(event) => setQuality(event.target.value as QualityProfile)}>
            <option value="low">480p · 25 fps</option>
            <option value="medium">720p · 30 fps</option>
            <option value="high">1080p · 60 fps</option>
          </select>
        </label>
        <button className="primary" disabled={joining} onClick={join}>
          {joining ? 'A entrar…' : 'Entrar na chamada'}
        </button>
        {error && <div className="form-error">{error}</div>}
      </div>
    );
  }

  const profile = qualityProfiles[quality];
  return (
    <div className="livekit-shell" data-lk-theme="default">
      <LiveKitRoom
        token={token}
        serverUrl={livekitUrl}
        connect
        video={videoEnabled ? {
          resolution: {
            width: profile.width,
            height: profile.height,
            frameRate: profile.frameRate,
          },
        } : false}
        audio
        onDisconnected={() => setToken('')}
        onError={(roomError) => {
          setError(roomError.message || 'Não foi possível ligar à chamada.');
          setToken('');
        }}
      >
        <LayoutContextProvider>
          <CallStage />
        </LayoutContextProvider>
      </LiveKitRoom>
    </div>
  );
}
