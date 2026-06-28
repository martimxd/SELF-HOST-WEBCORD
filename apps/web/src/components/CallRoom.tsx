import { useEffect, useState, type CSSProperties, type MouseEvent } from 'react';
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
  canModerateCall?: boolean;
  muteEndpoint?: string;
  kickEndpoint?: string;
};

function CallStage({
  callKind,
  callTargetId,
  canModerateCall = false,
  muteEndpoint,
  kickEndpoint,
  socket,
  onForceLeave,
}: Pick<CallRoomProps, 'callKind' | 'callTargetId' | 'canModerateCall' | 'muteEndpoint' | 'kickEndpoint' | 'socket'> & {
  onForceLeave: () => void;
}) {
  const { t } = useI18n();
  const room = useRoomContext();
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();
  const [deafened, setDeafened] = useState(false);
  const [volumeMenu, setVolumeMenu] = useState<{
    identity: string;
    x: number;
    y: number;
    volume: number;
  } | null>(null);
  const [participantVolumes, setParticipantVolumes] = useState<Record<string, number>>({});
  const [actionError, setActionError] = useState('');
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

  useEffect(() => {
    const closeMenu = () => setVolumeMenu(null);
    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('keydown', closeMenu);
    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('keydown', closeMenu);
    };
  }, []);

  useEffect(() => {
    const forceMuted = (payload: { kind: 'server' | 'direct'; targetId: string }) => {
      if (payload.kind !== callKind || payload.targetId !== callTargetId) return;
      void localParticipant.setMicrophoneEnabled(false);
    };
    const forceLeft = (payload: { kind: 'server' | 'direct'; targetId: string }) => {
      if (payload.kind !== callKind || payload.targetId !== callTargetId) return;
      onForceLeave();
    };
    socket.on('call:force-muted', forceMuted);
    socket.on('call:force-left', forceLeft);
    return () => {
      socket.off('call:force-muted', forceMuted);
      socket.off('call:force-left', forceLeft);
    };
  }, [callKind, callTargetId, localParticipant, onForceLeave, socket]);

  const toggleMic = async () => {
    if (deafened) {
      setDeafened(false);
      setRemoteAudioEnabled(true);
    }
    await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
  };

  const toggleCamera = async () => {
    await localParticipant.setCameraEnabled(!isCameraEnabled);
  };

  const toggleScreen = async () => {
    await localParticipant.setScreenShareEnabled(!isScreenShareEnabled);
  };

  const toggleDeafen = async () => {
    const next = !deafened;
    setDeafened(next);
    setRemoteAudioEnabled(!next);
    if (next) {
      await localParticipant.setMicrophoneEnabled(false);
    }
  };

  const setParticipantVolume = (identity: string, volume: number) => {
    setParticipantVolumes((current) => ({ ...current, [identity]: volume }));
    room.remoteParticipants.get(identity)?.setVolume(volume / 100);
    setVolumeMenu((current) => current && current.identity === identity
      ? { ...current, volume }
      : current);
  };

  const openVolumeMenu = (event: MouseEvent, identity: string) => {
    if (identity === localParticipant.identity) return;
    event.preventDefault();
    event.stopPropagation();
    setVolumeMenu({
      identity,
      x: Math.min(event.clientX, window.innerWidth - 220),
      y: Math.min(event.clientY, window.innerHeight - 120),
      volume: participantVolumes[identity] ?? 100,
    });
  };

  const moderateParticipant = async (endpoint: string | undefined, identity: string) => {
    if (!endpoint) return;
    setActionError('');
    try {
      await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ userId: identity }),
      });
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  return (
    <div className="call-experience">
      <div className="call-grid" style={{ '--participant-count': tracks.length } as CSSProperties}>
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
              onContextMenu={(event) => openVolumeMenu(event, participant.identity)}
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
              {canModerateCall && participant.identity !== localParticipant.identity && (
                <div className="call-admin-actions">
                  <button
                    type="button"
                    onClick={() => moderateParticipant(muteEndpoint, participant.identity)}
                    title={t('muteParticipant')}
                  >
                    <MicOff size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moderateParticipant(kickEndpoint, participant.identity)}
                    title={t('kickFromCall')}
                  >
                    <PhoneOff size={14} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {volumeMenu && (
        <div
          className="call-volume-menu"
          style={{ left: volumeMenu.x, top: volumeMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span>{t('participantVolume')}</span>
          <input
            type="range"
            min="0"
            max="150"
            value={volumeMenu.volume}
            onChange={(event) => setParticipantVolume(volumeMenu.identity, Number(event.target.value))}
          />
          <strong>{volumeMenu.volume}%</strong>
        </div>
      )}
      <div className="call-controls">
        <div className="custom-call-controls">
          <button
            type="button"
            className={`lk-button ${isMicrophoneEnabled ? '' : 'danger-active'}`}
            onClick={toggleMic}
            title={isMicrophoneEnabled ? t('microphoneOn') : t('microphoneOff')}
          >
            {isMicrophoneEnabled ? <Mic size={19} /> : <MicOff size={19} />}
          </button>
          <button
            type="button"
            className={`lk-button ${deafened ? 'danger-active' : ''}`}
            onClick={toggleDeafen}
            title={deafened ? t('deafenOff') : t('deafenOn')}
          >
            {deafened ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <button
            type="button"
            className={`lk-button ${isCameraEnabled ? '' : 'danger-active'}`}
            onClick={toggleCamera}
            title={isCameraEnabled ? t('cameraOn') : t('cameraOff')}
          >
            {isCameraEnabled ? <Video size={19} /> : <VideoOff size={19} />}
          </button>
          <button
            type="button"
            className={`lk-button ${isScreenShareEnabled ? 'active' : ''}`}
            onClick={toggleScreen}
            title={t('shareScreen')}
          >
            {isScreenShareEnabled ? <ScreenShareOff size={19} /> : <ScreenShare size={19} />}
          </button>
          <DisconnectButton className="lk-disconnect-button" title={t('leaveCall')}>
            <PhoneOff size={19} />
          </DisconnectButton>
        </div>
      </div>
      {actionError && <button className="toast" onClick={() => setActionError('')}>{actionError}</button>}
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
  canModerateCall,
  muteEndpoint,
  kickEndpoint,
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
          <CallStage
            callKind={callKind}
            callTargetId={callTargetId}
            canModerateCall={canModerateCall}
            muteEndpoint={muteEndpoint}
            kickEndpoint={kickEndpoint}
            socket={socket}
            onForceLeave={() => {
              setConnected(false);
              socket.emit('call:leave');
              setToken('');
            }}
          />
        </LayoutContextProvider>
      </LiveKitRoom>
    </div>
  );
}
