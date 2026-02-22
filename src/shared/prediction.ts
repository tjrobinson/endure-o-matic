import { Lap, TeamMember, ScheduleEntry } from './types';

const FATIGUE_FACTOR = 0.02; // 2% slowdown per completed lap

/**
 * Predict the duration of a future lap for a team member.
 * Uses completed lap data with a linear fatigue model.
 */
export function predictLapDuration(
    member: TeamMember,
    completedLaps: Lap[],
    futureIndex: number
): number {
    const memberLaps = completedLaps
        .filter((l) => l.memberId === member.id && l.actualDuration != null)
        .sort((a, b) => a.order - b.order);

    if (memberLaps.length === 0) {
        // No history — use estimated lap time with fatigue applied
        return member.estimatedLapTime * (1 + FATIGUE_FACTOR * futureIndex);
    }

    if (memberLaps.length === 1) {
        // One data point — use it as base with fatigue
        const base = memberLaps[0].actualDuration!;
        const lapsFromBase = futureIndex - memberLaps.length + 1;
        return base * (1 + FATIGUE_FACTOR * Math.max(0, lapsFromBase));
    }

    // Multiple data points — linear regression to capture fatigue trend
    const n = memberLaps.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        const x = i;
        const y = memberLaps[i].actualDuration!;
        sumX += x;
        sumY += y;
        sumXY += x * y;
        sumXX += x * x;
    }

    const denom = n * sumXX - sumX * sumX;
    let slope = 0;
    let intercept = sumY / n;

    if (denom !== 0) {
        slope = (n * sumXY - sumX * sumY) / denom;
        intercept = (sumY - slope * sumX) / n;
    }

    // Ensure slope is non-negative (fatigue only makes you slower, not faster)
    if (slope < 0) {
        slope = 0;
        intercept = sumY / n;
    }

    const predicted = intercept + slope * futureIndex;
    // Minimum duration is 50% of estimated to avoid unrealistic predictions
    return Math.max(predicted, member.estimatedLapTime * 0.5);
}

/**
 * Generate the predicted schedule of laps from current state until event end.
 */
export function generateSchedule(
    members: TeamMember[],
    laps: Lap[],
    eventStartTime: number,
    eventEndTime: number,
    memberRotation: string[] // ordered list of member IDs for upcoming laps
): ScheduleEntry[] {
    const schedule: ScheduleEntry[] = [];
    const completedLaps = laps.filter((l) => l.status === 'completed');
    const activeLap = laps.find((l) => l.status === 'active');

    // Count how many laps each member has done/is planned to do
    const memberLapCounts = new Map<string, number>();
    for (const l of laps) {
        memberLapCounts.set(l.memberId, (memberLapCounts.get(l.memberId) || 0) + 1);
    }

    // Find the start time for the next predicted lap
    let nextStartTime: number;
    if (activeLap) {
        // There's an active lap — next lap starts when it ends
        const member = members.find((m) => m.id === activeLap.memberId);
        if (member) {
            const memberDoneCount = completedLaps.filter(
                (l) => l.memberId === member.id
            ).length;
            const predictedDuration = predictLapDuration(
                member,
                completedLaps,
                memberDoneCount
            );
            nextStartTime =
                (activeLap.actualStartTime || Date.now()) + predictedDuration * 1000;
        } else {
            nextStartTime = Date.now();
        }
    } else if (completedLaps.length > 0) {
        // Last completed lap ended — next starts now
        const lastCompleted = completedLaps.sort((a, b) => b.order - a.order)[0];
        nextStartTime = lastCompleted.actualEndTime || Date.now();
    } else {
        nextStartTime = eventStartTime;
    }

    // Generate future laps
    let lapNumber = laps.length + 1;
    let rotationIndex = 0;

    while (nextStartTime < eventEndTime && rotationIndex < 10000) {
        if (memberRotation.length === 0) break;

        const memberId = memberRotation[rotationIndex % memberRotation.length];
        const member = members.find((m) => m.id === memberId);
        if (!member) {
            rotationIndex++;
            continue;
        }

        const futureLapIndex =
            (memberLapCounts.get(memberId) || 0) +
            schedule.filter((s) => s.memberId === memberId).length;
        const predictedDuration = predictLapDuration(
            member,
            completedLaps,
            futureLapIndex
        );
        const predictedEndTime = nextStartTime + predictedDuration * 1000;

        schedule.push({
            lapNumber,
            memberId: member.id,
            memberName: member.name,
            predictedStartTime: nextStartTime,
            predictedDuration,
            predictedEndTime,
            isGuest: member.isGuest,
        });

        nextStartTime = predictedEndTime;
        lapNumber++;
        rotationIndex++;
    }

    return schedule;
}
