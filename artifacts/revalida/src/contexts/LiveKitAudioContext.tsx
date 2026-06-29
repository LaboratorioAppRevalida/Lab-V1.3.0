import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Room,
  RoomEvent,
  Track,
  type RemoteTrackPublication,
  type RemoteParticipant,
  type RemoteAudioTrack,
} from "livekit-client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

type AudioConnectionState = "idle" | "connecting" | "connected" | "error";

type LiveKitAudioState = {
  audioState: AudioConnectionState;
  isMuted: boolean;
  /** true when the mobile browser's autoplay policy is blocking incoming audio */
  isPlaybackBlocked: boolean;
  toggleMic: () => Promise<void>;
  /** Call inside any user-gesture handler to unblock downstream audio */
  unblockPlayback: () => Promise<void>;
  connect: (roomName: string, participantName: string) => Promise<void>;
  disconnect: () => void;
};

// ── Context ───────────────────────────────────────────────────────────────────

const LiveKitAudioCtx = createContext<LiveKitAudioState | null>(null);

export function useLiveKitAudio(): LiveKitAudioState {
  const ctx = useContext(LiveKitAudioCtx);
  if (!ctx) throw new Error("useLiveKitAudio must be used within LiveKitAudioProvider");
  return ctx;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Attach a remote audio track to a hidden <audio> element appended to the
 * document body.  Returns the created element so the caller can remove it
 * later.  In livekit-client v2.x audio tracks are NOT auto-attached — we must
 * do this ourselves or the downstream audio never reaches the speaker.
 */
function attachRemoteAudio(track: RemoteAudioTrack): HTMLAudioElement {
  const el = track.attach();          // creates <audio> with srcObject set
  el.style.display = "none";
  el.setAttribute("playsinline", ""); // required on iOS to avoid fullscreen takeover
  el.setAttribute("data-lk-audio", track.sid ?? "");
  document.body.appendChild(el);
  // Best-effort play — will succeed only after a user-gesture unlocks autoplay.
  el.play().catch(() => {/* blocked — AudioPlaybackStatusChanged will fire */});
  return el;
}

function detachRemoteAudio(el: HTMLAudioElement) {
  el.pause();
  el.srcObject = null;
  el.remove();
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function LiveKitAudioProvider({ children }: { children: React.ReactNode }) {
  const roomRef = useRef<Room | null>(null);
  // sid → <audio> element, so we can clean up on unsubscribe / disconnect
  const audioElemsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  const [audioState, setAudioState] = useState<AudioConnectionState>("idle");
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaybackBlocked, setIsPlaybackBlocked] = useState(false);
  const connectingRef = useRef(false);

  // ── Attach / detach helpers ────────────────────────────────────────────────

  const handleTrackSubscribed = useCallback(
    (track: RemoteAudioTrack | unknown, pub: RemoteTrackPublication) => {
      if (pub.kind !== Track.Kind.Audio) return;
      const audioTrack = track as RemoteAudioTrack;
      const el = attachRemoteAudio(audioTrack);
      audioElemsRef.current.set(pub.trackSid, el);
    },
    []
  );

  const handleTrackUnsubscribed = useCallback(
    (_track: unknown, pub: RemoteTrackPublication) => {
      if (pub.kind !== Track.Kind.Audio) return;
      const el = audioElemsRef.current.get(pub.trackSid);
      if (el) {
        detachRemoteAudio(el);
        audioElemsRef.current.delete(pub.trackSid);
      }
    },
    []
  );

  const detachAllRemoteAudio = useCallback(() => {
    for (const el of audioElemsRef.current.values()) {
      detachRemoteAudio(el);
    }
    audioElemsRef.current.clear();
  }, []);

  // ── Attach tracks already subscribed at connect time ───────────────────────
  const attachExistingTracks = useCallback((room: Room) => {
    for (const participant of room.remoteParticipants.values()) {
      for (const pub of participant.trackPublications.values()) {
        if (pub.kind === Track.Kind.Audio && pub.isSubscribed && pub.track) {
          const el = attachRemoteAudio(pub.track as RemoteAudioTrack);
          audioElemsRef.current.set(pub.trackSid, el);
        }
      }
    }
  }, []);

  // ── disconnect ─────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    const room = roomRef.current;
    if (room) {
      room.disconnect();
      roomRef.current = null;
    }
    detachAllRemoteAudio();
    setAudioState("idle");
    setIsMuted(true);
    setIsPlaybackBlocked(false);
    connectingRef.current = false;
  }, [detachAllRemoteAudio]);

  // ── connect ────────────────────────────────────────────────────────────────

  const connect = useCallback(
    async (roomName: string, participantName: string) => {
      if (connectingRef.current) return;

      // Seamless espera→estacao: already in this room, nothing to do
      const existing = roomRef.current;
      if (existing?.state === "connected" && existing.name === roomName) return;

      connectingRef.current = true;

      if (existing) {
        existing.disconnect();
        roomRef.current = null;
        detachAllRemoteAudio();
      }

      setAudioState("connecting");

      try {
        // 1. Signed token ────────────────────────────────────────────────────
        const res = await fetch("/api/livekit-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName, participantName }),
        });
        if (!res.ok) throw new Error(`Token fetch failed: ${res.status}`);
        const { token, url } = (await res.json()) as { token: string; url: string };

        // 2. Room + lifecycle events ──────────────────────────────────────────
        const room = new Room({ adaptiveStream: true, dynacast: true });

        // Downstream audio: track subscribed by a remote participant
        room.on(
          RoomEvent.TrackSubscribed,
          (track, pub, _participant: RemoteParticipant) => {
            handleTrackSubscribed(track, pub);
          }
        );

        // Downstream audio: remote track gone
        room.on(
          RoomEvent.TrackUnsubscribed,
          (track, pub, _participant: RemoteParticipant) => {
            handleTrackUnsubscribed(track, pub);
          }
        );

        // Mobile autoplay policy: browser may block audio playback.
        // When canPlayAudio flips false we surface a "tap to enable" banner
        // via isPlaybackBlocked; clicking any user-gesture calls startAudio().
        room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          setIsPlaybackBlocked(!room.canPlayAudio);
          if (!room.canPlayAudio) {
            console.info("[LiveKitAudio] downstream audio blocked by autoplay policy");
          }
        });

        room.on(RoomEvent.Disconnected, () => {
          if (roomRef.current === room) {
            roomRef.current = null;
            detachAllRemoteAudio();
            setAudioState("idle");
            setIsMuted(true);
            setIsPlaybackBlocked(false);
            connectingRef.current = false;
          }
        });

        // 3. Connect ─────────────────────────────────────────────────────────
        await room.connect(url, token, { autoSubscribe: true });

        // 4. Attach any tracks published before we finished connecting ────────
        attachExistingTracks(room);

        // 5. ACTIVE-ON-JOIN: publish mic to prime the mobile audio pipeline ───
        // Forces the OS to allocate the microphone hardware, show the permission
        // prompt, and fully initialise AudioContext + AudioWorklet + ICE path.
        await room.localParticipant.setMicrophoneEnabled(true);

        // 6. INSTANT SOFTWARE MUTE ───────────────────────────────────────────
        // Silence the track at MediaStreamTrack level without unpublishing.
        // (setMicrophoneEnabled(false) in v2.x *unpublishes*, which undoes step 5.)
        const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
        if (micPub?.track) {
          await micPub.track.mute();
        }

        roomRef.current = room;
        setAudioState("connected");
        setIsMuted(true);
        // Reflect current autoplay state immediately after connect
        setIsPlaybackBlocked(!room.canPlayAudio);

      } catch (err) {
        console.warn("[LiveKitAudio] connect error:", err);
        toast.error("Não foi possível conectar ao canal de áudio", {
          description: "A sessão continua normalmente.",
          duration: 4000,
        });
        setAudioState("error");
        roomRef.current = null;
        detachAllRemoteAudio();
      } finally {
        connectingRef.current = false;
      }
    },
    [handleTrackSubscribed, handleTrackUnsubscribed, detachAllRemoteAudio, attachExistingTracks]
  );

  // ── toggleMic ──────────────────────────────────────────────────────────────

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room || room.state !== "connected") return;

    const micPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);

    try {
      // startAudio() is the official WebRTC hook to unblock mobile downstream
      // audio inside a direct user-gesture handler. It's a no-op on desktop
      // and when the AudioContext is already running — always safe to call.
      await room.startAudio();
      setIsPlaybackBlocked(!room.canPlayAudio);

      if (isMuted) {
        if (micPub?.track) {
          await micPub.track.unmute();
        } else {
          // Track lost (iOS background kill). Re-publish fresh.
          await room.localParticipant.setMicrophoneEnabled(true);
        }
        setIsMuted(false);
      } else {
        if (micPub?.track) {
          await micPub.track.mute();
        }
        setIsMuted(true);
      }
    } catch (err) {
      console.warn("[LiveKitAudio] toggleMic error:", err);
    }
  }, [isMuted]);

  // ── unblockPlayback ────────────────────────────────────────────────────────
  // Standalone action for the "tap to enable audio" banner — must be called
  // directly inside a native click/tap handler to satisfy the user-gesture
  // requirement. Retries play() on all attached <audio> elements.

  const unblockPlayback = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.startAudio();
      setIsPlaybackBlocked(!room.canPlayAudio);
      // Re-attempt play() on every attached element in case startAudio()
      // fixed the AudioContext but the elements stalled individually.
      for (const el of audioElemsRef.current.values()) {
        el.play().catch(() => {});
      }
    } catch (err) {
      console.warn("[LiveKitAudio] unblockPlayback error:", err);
    }
  }, []);

  // ── cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return (
    <LiveKitAudioCtx.Provider
      value={{ audioState, isMuted, isPlaybackBlocked, toggleMic, unblockPlayback, connect, disconnect }}
    >
      {children}
    </LiveKitAudioCtx.Provider>
  );
}
