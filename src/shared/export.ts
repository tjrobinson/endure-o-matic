import { Lap, TeamMember } from './types';
import { calculateStats } from './statistics';

interface EventLike {
    name: string;
    startTime: number;
    endTime: number;
}

/**
 * Format seconds into a human-readable duration string.
 */
export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

function formatTime(ms: number): string {
    return new Date(ms).toLocaleString();
}

/**
 * Export event data as a JSON object that can restore full state.
 */
export function exportToJson(
    event: EventLike,
    members: TeamMember[],
    laps: Lap[]
): string {
    return JSON.stringify(
        {
            version: 1,
            exportedAt: new Date().toISOString(),
            event,
            members,
            laps: laps.sort((a, b) => a.order - b.order),
        },
        null,
        2
    );
}

/**
 * Export event data as a Markdown summary.
 */
export function exportToMarkdown(
    event: EventLike,
    members: TeamMember[],
    laps: Lap[]
): string {
    const stats = calculateStats(event, laps, members);
    const sortedLaps = [...laps].sort((a, b) => a.order - b.order);
    const teamMembers = members.filter((m) => !m.isGuest);
    const guests = members.filter((m) => m.isGuest);

    let md = `# ${event.name}\n\n`;
    md += `**Start:** ${formatTime(event.startTime)}  \n`;
    md += `**End:** ${formatTime(event.endTime)}  \n`;
    md += `**Duration:** ${formatDuration((event.endTime - event.startTime) / 1000)}  \n`;
    md += `**Progress:** ${stats.percentComplete.toFixed(1)}%  \n\n`;

    md += `## Summary\n\n`;
    md += `| Stat | Value |\n|---|---|\n`;
    md += `| Total Laps | ${stats.completedLaps} completed |\n`;
    if (stats.averageLapTime != null)
        md += `| Average Lap Time | ${formatDuration(stats.averageLapTime)} |\n`;
    if (stats.fastestLap)
        md += `| Fastest Lap | ${formatDuration(stats.fastestLap.actualDuration!)} (${stats.fastestLap.memberName}) |\n`;
    md += `\n`;

    md += `## Team Members\n\n`;
    md += `| Name | Laps | Avg Time | Fastest | Total Time |\n|---|---|---|---|---|\n`;
    for (const ms of stats.memberStats.filter((m) => !m.isGuest)) {
        md += `| ${ms.memberName} | ${ms.lapsCompleted} | ${ms.averageLapTime ? formatDuration(ms.averageLapTime) : '-'} | ${ms.fastestLap ? formatDuration(ms.fastestLap) : '-'} | ${formatDuration(ms.totalTime)} |\n`;
    }

    if (guests.length > 0) {
        md += `\n## Guests\n\n`;
        md += `| Name | Laps | Avg Time | Fastest | Total Time |\n|---|---|---|---|---|\n`;
        for (const ms of stats.memberStats.filter((m) => m.isGuest)) {
            md += `| ${ms.memberName} | ${ms.lapsCompleted} | ${ms.averageLapTime ? formatDuration(ms.averageLapTime) : '-'} | ${ms.fastestLap ? formatDuration(ms.fastestLap) : '-'} | ${formatDuration(ms.totalTime)} |\n`;
        }
    }

    md += `\n## Lap Log\n\n`;
    md += `| # | Member | Status | Start | End | Duration |\n|---|---|---|---|---|---|\n`;
    for (const lap of sortedLaps) {
        const start = lap.actualStartTime
            ? formatTime(lap.actualStartTime)
            : '-';
        const end = lap.actualEndTime
            ? formatTime(lap.actualEndTime)
            : '-';
        const duration = lap.actualDuration
            ? formatDuration(lap.actualDuration)
            : lap.predictedDuration
                ? `~${formatDuration(lap.predictedDuration)}`
                : '-';
        const guest = lap.isGuest ? ' (guest)' : '';
        md += `| ${lap.order} | ${lap.memberName}${guest} | ${lap.status} | ${start} | ${end} | ${duration} |\n`;
    }

    md += `\n---\n*Exported from Endure-O-Matic on ${new Date().toLocaleString()}*\n`;

    return md;
}
