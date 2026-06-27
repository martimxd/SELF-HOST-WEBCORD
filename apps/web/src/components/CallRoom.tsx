import { useEffect, useState } from 'react';
import {
  DisconnectButton,
  LayoutContextProvider,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  VideoTrack,
  useLocalParticipant,
  useRoomContext,
  useTracks,
} from '@livekit/components-react';
import { Mic, MicOff, MonitorUp, PhoneOff, ScreenShare, ScreenShareOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { RoomEvent, Track } from 'livekit-client';
import type { Socket } from 'socket.io-client';
import { api } from '../api';
import { qualityProfiles, type QualityProfile } from '@webcord/shared';
import { useI18n } from '../i18n';

type CallRoomProps = {
  name: string;
  tokenEndpoint: string;
  videoEnabled: boolean;
  socket: Socket;
  callKind: 'server' | 'direct';
  callTargetId: string;
};

function CallStage() {
  const { t } = useI18n();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  const setRemoteAudioEnabled = (enabled: boolean) => {
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((publication) => {
        publication.setEnabled(enabled);
      });
    });
  };

  useEffect(() => {
    setRemoteAudioEnabled(!deafened);
    const onTrackSubscribed = () => setRemoteAudioEnabled(!deafened);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    return () => {
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      setRemoteAudioEnabled(true);
    };
  }, [deafened, room]);

  const toggleMic = async () => {
    if (deafened) {
      setDeafened(false);
      setRemoteAudioEnabled(true);
    }
    const next = !micEnabled;
    await localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  };

  const toggleCamera = async () => {
    const next = !cameraEnabled;
    await localParticipant.setCameraEnabled(next);
    setCameraEnabled(next);
  };

  const toggleScreen = async () => {
    const next = !screenEnabled;
    await localParticipant.setScreenShareEnabled(next);
    setScreenEnabled(next);
  };

  const toggleDeafen = async () => {
    const next = !deafened;
    setDeafened(next);
    setRemoteAudioEnabled(!next);
    if (next) {
      await localParticipant.setMicrophoneEnabled(false);
      setMicEnabled(false);
    }
  };

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
        <div className="custom-call-controls">
          <button
            className={`lk-button ${micEnabled ? '' : 'danger-active'}`}
            onClick={toggleMic}
            title={micEnabled ? t('microphoneOn') : t('microphoneOff')}
          >
            {micEnabled ? <Mic size={19} /> : <MicOff size={19} />}
          </button>
          <button
            className={`lk-button ${deafened ? 'danger-active' : ''}`}
            onClick={toggleDeafen}
            title={deafened ? t('deafenOff') : t('deafenOn')}
          >
            {deafened ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <button
            className={`lk-button ${cameraEnabled ? '' : 'danger-active'}`}
            onClick={toggleCamera}
            title={cameraEnabled ? t('cameraOn') : t('cameraOff')}
          >
            {cameraEnabled ? <Video size={19} /> : <VideoOff size={19} />}
          </button>
          <button
            className={`lk-button ${screenEnabled ? 'active' : ''}`}
            onClick={toggleScreen}
            title={t('shareScreen')}
          >
            {screenEnabled ? <ScreenShareOff size={19} /> : <ScreenShare size={19} />}
          </button>
          <DisconnectButton className="lk-disconnect-button" title={t('leaveCall')}>
            <PhoneOff size={19} />
          </DisconnectButton>
        </div>
      </div>
      <RoomAudioRenderer />
    </div>
  );
}

export function CallRoom({
  name,
  tokenEndpoint,
  videoEnabled,
  socket,
  callKind,
  callTargetId,
}: CallRoomProps) {
  const { t } = useI18n();
  const [token, setToken] = useState('');
  const [quality, setQuality] = useState<QualityProfile>('medium');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [connected, setConnected] = useState(false);
  const livekitUrl = import.meta.env.VITE_LIVEKIT_URL
    || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/livekit`;

  const join = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setError(t('webRtcUnavailable'));
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

  useEffect(() => () => {
    if (connected) socket.emit('call:leave');
  }, [connected, socket]);

  if (!token) {
    return (
      <div className="call-lobby">
        <div className="call-icon">{videoEnabled ? <Video /> : <Mic />}</div>
        <span className="eyebrow">{t('callRoomEyebrow')}</span>
        <h1>{name}</h1>
        <p>{t('callText')}</p>
        <label>{t('quality')}
          <select value={quality} onChange={(event) => setQuality(event.target.value as QualityProfile)}>
            <option value="low">480p · 25 fps</option>
            <option value="medium">720p · 30 fps</option>
            <option value="high">1080p · 60 fps</option>
          </select>
        </label>
        <button className="primary" disabled={joining} onClick={join}>
          {joining ? t('loggingIn') : t('enterCall')}
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
        options={{
          adaptiveStream: true,
          dynacast: true,
          publishDefaults: {
            videoEncoding: { maxBitrate: profile.maxBitrate, maxFramerate: profile.frameRate },
          },
        }}
        onConnected={() => {
          setConnected(true);
          socket.emit('call:join', {
            label: name,
            kind: callKind,
            targetId: callTargetId,
          });
        }}
        onDisconnected={() => {
          setConnected(false);
          socket.emit('call:leave');
          setToken('');
        }}
        onError={(roomError) => {
          setError(roomError.message || t('webRtcUnavailable'));
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
