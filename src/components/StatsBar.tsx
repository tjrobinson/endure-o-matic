import { EventConfig, EventStats } from '../shared/types';

interface StatsBarProps {
    stats: EventStats;
    event: EventConfig;
    now: number;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m ${Math.floor(seconds % 60)}s`;
}

function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return 'Finished';
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
}

export default function StatsBar({ stats, event, now }: StatsBarProps) {
    const timeRemaining = event.endTime - now;
    const progressPercent = Math.min(100, Math.max(0, stats.percentComplete));

    return (
        <div className="stats-bar">
            <div className="progress-container">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                <span className="progress-label">
                    {progressPercent.toFixed(1)}% · {formatTimeRemaining(timeRemaining)}
                </span>
            </div>
            <div className="stats-pills">
                <div className="stat-pill">
                    <span className="stat-value">{stats.completedLaps}</span>
                    <span className="stat-label">Laps</span>
                </div>
                {stats.fastestLap && (
                    <div className="stat-pill stat-highlight">
                        <span className="stat-value">{formatDuration(stats.fastestLap.actualDuration!)}</span>
                        <span className="stat-label">Fastest ({stats.fastestLap.memberName})</span>
                    </div>
                )}
                {stats.averageLapTime != null && (
                    <div className="stat-pill">
                        <span className="stat-value">{formatDuration(stats.averageLapTime)}</span>
                        <span className="stat-label">Avg Lap</span>
                    </div>
                )}
                {stats.memberStats
                    .filter((m) => !m.isGuest && m.lapsCompleted > 0)
                    .sort((a, b) => b.lapsCompleted - a.lapsCompleted)
                    .slice(0, 3)
                    .map((m) => (
                        <div key={m.memberId} className="stat-pill stat-member">
                            <span className="stat-value">{m.lapsCompleted}</span>
                            <span className="stat-label">{m.memberName}</span>
                        </div>
                    ))}
            </div>
        </div>
    );
}
