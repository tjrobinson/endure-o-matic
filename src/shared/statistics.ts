import { Lap, EventStats, MemberStats, TeamMember } from './types';

interface EventLike {
    startTime: number;
    endTime: number;
}

/**
 * Calculate event statistics from current lap data.
 */
export function calculateStats(
    event: EventLike,
    laps: Lap[],
    members: TeamMember[]
): EventStats {
    const now = Date.now();
    const eventDuration = event.endTime - event.startTime;
    const elapsed = Math.min(now - event.startTime, eventDuration);
    const percentComplete = eventDuration > 0
        ? Math.max(0, Math.min(100, (elapsed / eventDuration) * 100))
        : 0;

    const completedLaps = laps.filter((l) => l.status === 'completed');
    const activeLap = laps.find((l) => l.status === 'active') || null;

    // Fastest lap
    let fastestLap: Lap | null = null;
    for (const lap of completedLaps) {
        if (lap.actualDuration != null) {
            if (!fastestLap || lap.actualDuration < (fastestLap.actualDuration || Infinity)) {
                fastestLap = lap;
            }
        }
    }

    // Average lap time
    const durations = completedLaps
        .filter((l) => l.actualDuration != null)
        .map((l) => l.actualDuration!);
    const averageLapTime =
        durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : null;

    // Per-member stats
    const allMembers = [...members];
    // Add any guest members from laps that aren't in the members list
    const memberIds = new Set(members.map((m) => m.id));
    for (const lap of laps) {
        if (!memberIds.has(lap.memberId)) {
            allMembers.push({
                id: lap.memberId,
                name: lap.memberName,
                estimatedLapTime: 0,
                active: true,
                isGuest: lap.isGuest,
            });
            memberIds.add(lap.memberId);
        }
    }

    const memberStats: MemberStats[] = allMembers.map((member) => {
        const memberCompletedLaps = completedLaps.filter(
            (l) => l.memberId === member.id
        );
        const memberDurations = memberCompletedLaps
            .filter((l) => l.actualDuration != null)
            .map((l) => l.actualDuration!);

        return {
            memberId: member.id,
            memberName: member.name,
            lapsCompleted: memberCompletedLaps.length,
            averageLapTime:
                memberDurations.length > 0
                    ? memberDurations.reduce((a, b) => a + b, 0) / memberDurations.length
                    : null,
            fastestLap:
                memberDurations.length > 0 ? Math.min(...memberDurations) : null,
            totalTime: memberDurations.reduce((a, b) => a + b, 0),
            isGuest: member.isGuest,
        };
    });

    return {
        percentComplete,
        totalLaps: laps.length,
        completedLaps: completedLaps.length,
        activeLap,
        fastestLap,
        averageLapTime,
        memberStats,
    };
}
