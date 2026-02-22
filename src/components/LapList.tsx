import { useState } from 'react';
import { Lap, TeamMember, EventConfig, ScheduleEntry } from '../shared/types';
import { predictLapDuration } from '../shared/prediction';

interface LapListProps {
    laps: Lap[];
    members: TeamMember[];
    event: EventConfig;
    isReadOnly: boolean;
    addLap: (lap: Omit<Lap, 'id'>) => void;
    updateLap: (id: string, updates: Partial<Lap>) => void;
    removeLap: (id: string) => void;
    memberRotation: string[];
    hasActiveLap: () => boolean;
    schedule: ScheduleEntry[];
    now: number;
}

function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
    return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatTime(ms: number): string {
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ms: number): string {
    return new Date(ms).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function LapList({
    laps,
    members,
    event,
    isReadOnly,
    addLap,
    updateLap,
    removeLap,
    memberRotation,
    hasActiveLap,
    schedule,
    now,
}: LapListProps) {
    const [selectedMember, setSelectedMember] = useState('');
    const [editingLapId, setEditingLapId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    const completedLaps = laps.filter((l) => l.status === 'completed');
    const activeLap = laps.find((l) => l.status === 'active');

    const handleAddLap = () => {
        let memberId = selectedMember;

        if (!memberId) {
            const activeMembers = members.filter((m) => m.active);
            if (activeMembers.length === 0) return;

            const rotation = memberRotation.length > 0
                ? memberRotation
                : activeMembers.map((m) => m.id);

            const lastLap = laps[laps.length - 1];
            if (lastLap) {
                const lastIdx = rotation.indexOf(lastLap.memberId);
                const nextIdx = (lastIdx + 1) % rotation.length;
                memberId = rotation[nextIdx];
            } else {
                memberId = rotation[0];
            }
        }

        const member = members.find((m) => m.id === memberId);
        if (!member) return;

        const order = laps.length + 1;
        const memberLapsCount = completedLaps.filter((l) => l.memberId === memberId).length;
        const predictedDuration = predictLapDuration(member, completedLaps, memberLapsCount);

        let plannedStart = event.startTime;
        if (activeLap) {
            const activeMember = members.find((m) => m.id === activeLap.memberId) || member;
            plannedStart =
                (activeLap.actualStartTime || now) +
                predictLapDuration(activeMember, completedLaps,
                    completedLaps.filter((l) => l.memberId === activeLap.memberId).length
                ) * 1000;
        } else if (completedLaps.length > 0) {
            const lastCompleted = completedLaps[completedLaps.length - 1];
            plannedStart = lastCompleted.actualEndTime || now;
        }

        addLap({
            memberId,
            memberName: member.name,
            order,
            status: 'planned',
            plannedStartTime: plannedStart,
            actualStartTime: null,
            actualEndTime: null,
            predictedDuration,
            actualDuration: null,
            isGuest: member.isGuest,
        });
    };

    const handleStartLap = (lap: Lap) => {
        if (hasActiveLap()) return;
        updateLap(lap.id, { status: 'active', actualStartTime: now });
    };

    const handleCompleteLap = (lap: Lap) => {
        const duration = (now - (lap.actualStartTime || now)) / 1000;
        updateLap(lap.id, { status: 'completed', actualEndTime: now, actualDuration: duration });
    };

    const startEditTime = (lap: Lap) => {
        if (lap.status === 'completed' && lap.actualDuration != null) {
            setEditValue(String(Math.round(lap.actualDuration / 60)));
        } else {
            setEditValue(String(Math.round(lap.predictedDuration / 60)));
        }
        setEditingLapId(lap.id);
    };

    const saveEditTime = (lap: Lap) => {
        const minutes = parseFloat(editValue);
        if (isNaN(minutes) || minutes <= 0) {
            setEditingLapId(null);
            return;
        }
        const seconds = minutes * 60;
        if (lap.status === 'completed') {
            updateLap(lap.id, { actualDuration: seconds });
        } else {
            updateLap(lap.id, { predictedDuration: seconds });
        }
        setEditingLapId(null);
    };

    const sortedLaps = [...laps].sort((a, b) => a.order - b.order);

    return (
        <div className="lap-list">
            {/* Active lap banner */}
            {activeLap && (
                <div className="active-lap-banner">
                    <div className="active-lap-info">
                        <span className="pulse-dot" />
                        <strong>Lap {activeLap.order}</strong>
                        <span className="active-lap-member">{activeLap.memberName}</span>
                    </div>
                    <div className="active-lap-timer">
                        {formatDuration((now - (activeLap.actualStartTime || now)) / 1000)}
                    </div>
                    {!isReadOnly && (
                        <button className="btn btn-success" onClick={() => handleCompleteLap(activeLap)}>
                            ✓ Complete
                        </button>
                    )}
                </div>
            )}

            {/* Tracked laps table */}
            {sortedLaps.length > 0 && (
                <div className="lap-table-container">
                    <table className="lap-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Member</th>
                                <th>Status</th>
                                <th>Start</th>
                                <th>Duration</th>
                                {!isReadOnly && <th>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLaps.map((lap) => (
                                <tr key={lap.id} className={`lap-row lap-${lap.status}`}>
                                    <td className="lap-order">{lap.order}</td>
                                    <td>
                                        {lap.memberName}
                                        {lap.isGuest && <span className="badge badge-guest-sm">G</span>}
                                    </td>
                                    <td>
                                        <span className={`status-badge status-${lap.status}`}>
                                            {lap.status === 'active' ? '● Running' : lap.status === 'completed' ? '✓ Done' : '○ Planned'}
                                        </span>
                                    </td>
                                    <td>
                                        {lap.actualStartTime ? formatTime(lap.actualStartTime) : formatTime(lap.plannedStartTime)}
                                    </td>
                                    <td>
                                        {editingLapId === lap.id ? (
                                            <div className="edit-time-inline">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    step={0.5}
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="time-edit-input"
                                                    autoFocus
                                                    onKeyDown={(e) => e.key === 'Enter' && saveEditTime(lap)}
                                                />
                                                <span className="time-edit-unit">min</span>
                                                <button className="btn btn-sm btn-primary" onClick={() => saveEditTime(lap)}>✓</button>
                                                <button className="btn btn-sm btn-ghost" onClick={() => setEditingLapId(null)}>✕</button>
                                            </div>
                                        ) : (
                                            <span
                                                className={`duration-display ${!isReadOnly ? 'duration-editable' : ''}`}
                                                onClick={() => !isReadOnly && startEditTime(lap)}
                                                title={!isReadOnly ? 'Click to edit' : ''}
                                            >
                                                {lap.actualDuration
                                                    ? formatDuration(lap.actualDuration)
                                                    : lap.status === 'active' && lap.actualStartTime
                                                        ? formatDuration((now - lap.actualStartTime) / 1000)
                                                        : `~${formatDuration(lap.predictedDuration)}`}
                                                {!isReadOnly && <span className="edit-hint">✏️</span>}
                                            </span>
                                        )}
                                    </td>
                                    {!isReadOnly && (
                                        <td className="lap-actions">
                                            {lap.status === 'planned' && (
                                                <>
                                                    <button
                                                        className="btn btn-sm btn-primary"
                                                        onClick={() => handleStartLap(lap)}
                                                        disabled={hasActiveLap()}
                                                        title={hasActiveLap() ? 'Complete the current lap first' : 'Start lap'}
                                                    >
                                                        Start
                                                    </button>
                                                    <button className="btn btn-sm btn-danger" onClick={() => removeLap(lap.id)}>
                                                        ✕
                                                    </button>
                                                </>
                                            )}
                                            {lap.status === 'active' && (
                                                <button className="btn btn-sm btn-success" onClick={() => handleCompleteLap(lap)}>
                                                    Complete
                                                </button>
                                            )}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add lap controls */}
            {!isReadOnly && (
                <div className="add-lap-controls">
                    <select
                        value={selectedMember}
                        onChange={(e) => setSelectedMember(e.target.value)}
                        className="member-select"
                    >
                        <option value="">Auto (next in rotation)</option>
                        {members.filter((m) => m.active).map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.name}{m.isGuest ? ' (guest)' : ''}
                            </option>
                        ))}
                    </select>
                    <button className="btn btn-primary" onClick={handleAddLap}>
                        + Add Lap
                    </button>
                </div>
            )}

            {/* Predicted schedule section */}
            {schedule.length > 0 && (
                <div className="predicted-section">
                    <h3 className="predicted-header">
                        <span className="predicted-icon">📅</span>
                        Predicted Upcoming
                        <span className="predicted-count">{schedule.length} laps</span>
                    </h3>
                    <div className="predicted-timeline">
                        {schedule.slice(0, 20).map((entry, idx) => {
                            const isNext = idx === 0;
                            return (
                                <div
                                    key={`pred-${entry.lapNumber}-${idx}`}
                                    className={`predicted-entry ${isNext ? 'predicted-next' : ''}`}
                                >
                                    <div className="predicted-time">{formatTime(entry.predictedStartTime)}</div>
                                    <div className="predicted-dot">
                                        {isNext ? <span className="pulse-dot" /> : <span className="dot" />}
                                    </div>
                                    <div className="predicted-info">
                                        <strong>{entry.memberName}</strong>
                                        {entry.isGuest && <span className="badge badge-guest-sm">G</span>}
                                        <span className="predicted-duration">~{formatDuration(entry.predictedDuration)}</span>
                                        <span className="predicted-lap-num">Lap {entry.lapNumber}</span>
                                    </div>
                                </div>
                            );
                        })}
                        {schedule.length > 20 && (
                            <div className="predicted-more">
                                + {schedule.length - 20} more laps until {formatTime(event.endTime)} {formatDate(event.endTime)}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {laps.length === 0 && schedule.length === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">🏁</div>
                    <h3>No laps yet</h3>
                    <p>Add team members first, then start adding laps.</p>
                </div>
            )}
        </div>
    );
}
