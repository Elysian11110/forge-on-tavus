'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
	DailyAudioTrack,
	DailyVideo,
	useDevices,
	useLocalSessionId,
	useMeetingState,
	useVideoTrack,
} from '@daily-co/daily-react';
import { MicSelectBtn, CameraSelectBtn } from '../device-select';
import { ClosedCaptions, ClosedCaptionsButton, ClosedCaptionsProvider } from '../closed-captions';
import { ConnectingState, LeavingState } from '../conversation-status';
import { useReplicaIDs } from '../../hooks/use-replica-ids';
import { useCVICall } from '../../hooks/use-cvi-call';
import { AudioWave } from '../audio-wave';

import styles from './conversation.module.css';

// Forge patch: chat and screen share are removed (Raven can see a shared screen),
// and the meeting token of a private room is passed to the join explicitly.
interface ConversationProps {
	onLeave: () => void;
	conversationUrl: string;
	meetingToken?: string | null;
	// Forge wiring: the device check found no camera, so the join is voice only.
	startVideoOff?: boolean;
}

const VideoPreview = React.memo(({ id }: { id: string }) => {
	const videoState = useVideoTrack(id);

	return (
		<div
			className={`${styles.previewVideoContainer} ${videoState.isOff ? styles.previewVideoContainerHidden : ''}`}
		>
			<DailyVideo
				automirror
				sessionId={id}
				type="video"
				fit="cover"
				className={`${styles.previewVideo} ${videoState.isOff ? styles.previewVideoHidden : ''}`}
			/>
			<div className={styles.audioWaveContainer}>
				<AudioWave id={id} />
			</div>
		</div>
	);
});

const SelfView = React.memo(() => {
	const localId = useLocalSessionId();

	return (
		<div className={styles.selfViewContainer}>
			<VideoPreview id={localId} />
		</div>
	);
});

const MainVideo = React.memo(() => {
	const replicaIds = useReplicaIDs();
	const videoState = useVideoTrack(replicaIds[0]);
	const meetingState = useMeetingState();
	const replicaId = replicaIds[0];
	const [hasReplicaConnected, setHasReplicaConnected] = useState(false);

	useEffect(() => {
		if (replicaId && videoState.state === 'playable') {
			setHasReplicaConnected(true);
		}
	}, [replicaId, videoState.state]);

	if (meetingState === 'left-meeting' || meetingState === 'error') {
		return <LeavingState />;
	}

	if (!hasReplicaConnected) {
		return <ConnectingState />;
	}

	if (!replicaId) {
		return <ConnectingState />;
	}

	return (
		<div className={styles.mainVideoContainer}>
			<DailyVideo
				automirror
				sessionId={replicaId}
				type="video"
				className={`${styles.mainVideo} ${videoState.isOff ? styles.mainVideoHidden : ''}`}
			/>
			<DailyAudioTrack sessionId={replicaId} />
		</div>
	);
});

export const Conversation = React.memo(({ onLeave, conversationUrl, meetingToken, startVideoOff }: ConversationProps) => {
	const { joinCall, leaveCall } = useCVICall();
	const meetingState = useMeetingState();
	const { hasMicError } = useDevices();

	useEffect(() => {
		if (meetingState === 'error') {
			onLeave();
		}
	}, [meetingState, onLeave]);

	// Runs once on mount. useDaily() is null until CVIProvider's own effect has created the
	// call object, so mount CVIProvider before this component (around the whole page), never
	// in the same render; otherwise this join is a silent no-op.
	useEffect(() => {
		joinCall({ url: conversationUrl, token: meetingToken ?? undefined, videoOff: startVideoOff });
		// Release the singleton call on unmount: otherwise the next mount's join()
		// is rejected ("already joined meeting") and the stale room's death ends
		// the new conversation via onLeave above. Also StrictMode-safe.
		return () => {
			leaveCall();
		};
	}, []);

	const handleLeave = useCallback(() => {
		leaveCall();
		onLeave();
	}, [leaveCall, onLeave]);

	return (
		<ClosedCaptionsProvider>
			<div className={styles.containerWrapper}>
				<div className={styles.container}>
					<div className={styles.videoContainer}>
						{/* Forge patch: this overlay only ever fires for the mic, so it says so, in Forge's words. */}
						{hasMicError && (
							<div className={styles.errorContainer}>
								<p>
									Veronica can&apos;t hear your mic. Check no other app is using it, then end the call and try again.
								</p>
							</div>
						)}

						<div className={styles.mainVideoContainer}>
							<MainVideo />
						</div>

						<SelfView />

						<ClosedCaptions />
					</div>

					<div
						className={`${styles.footer} ${meetingState === 'left-meeting' ? styles.footerLeaving : ''}`}
						aria-hidden={meetingState === 'left-meeting'}
					>
						<div className={styles.footerControls}>
							<MicSelectBtn />
							<CameraSelectBtn />
							<ClosedCaptionsButton />
							<button type="button" className={styles.leaveButton} onClick={handleLeave}>
								<span className={styles.leaveButtonIcon}>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										role="img"
										aria-label="Leave Call"
									>
										<path
											d="M18 6L6 18M6 6L18 18"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</span>
							</button>
						</div>
					</div>
				</div>
			</div>
		</ClosedCaptionsProvider>
	);
});
