'use client';

import { useCallback } from 'react';
import { useDaily } from '@daily-co/daily-react';

// Forge patch: a private room (require_auth) needs its meeting token, so the
// join passes it to daily.join explicitly instead of relying on the URL alone.
// Forge wiring: videoOff joins voice only and never touches the camera, so a
// denied or missing camera cannot fail the join.
export const useCVICall = (): {
	joinCall: (props: { url: string; token?: string; videoOff?: boolean }) => void;
	leaveCall: () => void;
} => {
	const daily = useDaily();

	const joinCall = useCallback(
		({ url, token, videoOff }: { url: string; token?: string; videoOff?: boolean }) => {
			daily?.join({
				url: url,
				...(token ? { token } : {}),
				...(videoOff ? { startVideoOff: true, videoSource: false } : {}),
				inputSettings: {
					audio: {
						processor: {
							type: 'none',
						},
					},
				},
			});
		},
		[daily]
	);

	const leaveCall = useCallback(() => {
		daily?.leave();
	}, [daily]);

	return { joinCall, leaveCall };
};
