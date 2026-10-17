'use client';

import { useParticipantIds } from '@daily-co/daily-react';

// Forge patch: the shipped CLI filters on 'tavus-replica' while the hooks docs
// say 'tavus-face'; accept either until a live call confirms the real user_id.
// When neither matches, the only other participant is Forge: the room is private
// and capped at two, so a surprise user_id cannot leave the call silent and faceless.
export const useReplicaIDs = (): string[] => {
	const replicasIDs = useParticipantIds({
		filter: (participant) =>
			participant.user_id.includes('tavus-replica') || participant.user_id.includes('tavus-face'),
	});
	const remoteIDs = useParticipantIds({ filter: 'remote' });

	return replicasIDs.length > 0 ? replicasIDs : remoteIDs.slice(0, 1);
};
