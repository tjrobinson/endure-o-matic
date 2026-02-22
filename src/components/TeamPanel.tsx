import { useState } from 'react';
import { TeamMember } from '../shared/types';

interface TeamPanelProps {
    members: TeamMember[];
    isReadOnly: boolean;
    addMember: (member: Omit<TeamMember, 'id'>) => void;
    updateMember: (id: string, updates: Partial<TeamMember>) => void;
    removeMember: (id: string) => void;
    memberRotation: string[];
    setMemberRotation: (rotation: string[]) => void;
    canReorderMember: (id: string) => boolean;
}

export default function TeamPanel({
    members,
    isReadOnly,
    addMember,
    updateMember,
    removeMember,
    memberRotation,
    setMemberRotation,
    canReorderMember,
}: TeamPanelProps) {
    const [newName, setNewName] = useState('');
    const [newEstimate, setNewEstimate] = useState(30);
    const [isGuest, setIsGuest] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const teamMembers = members.filter((m) => !m.isGuest);
    const guests = members.filter((m) => m.isGuest);

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        addMember({
            name: newName.trim(),
            estimatedLapTime: newEstimate * 60,
            active: true,
            isGuest,
        });
        setNewName('');
        setNewEstimate(30);
        setIsGuest(false);
    };

    const moveInRotation = (memberId: string, direction: 'up' | 'down') => {
        if (!canReorderMember(memberId)) return;
        const idx = memberRotation.indexOf(memberId);
        if (idx === -1) return;
        const newRotation = [...memberRotation];
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= newRotation.length) return;
        // Also check if the member we're swapping with can be reordered
        if (!canReorderMember(newRotation[swapIdx])) return;
        [newRotation[idx], newRotation[swapIdx]] = [newRotation[swapIdx], newRotation[idx]];
        setMemberRotation(newRotation);
    };

    return (
        <div className="team-panel">
            <section>
                <h2>Team Members ({teamMembers.length}/8)</h2>
                <div className="member-list">
                    {teamMembers.map((member, idx) => {
                        const canReorder = canReorderMember(member.id);
                        return (
                            <div
                                key={member.id}
                                className={`member-card ${!member.active ? 'member-inactive' : ''}`}
                            >
                                {editingId === member.id && !isReadOnly ? (
                                    <div className="member-edit">
                                        <input
                                            type="text"
                                            defaultValue={member.name}
                                            onBlur={(e) => {
                                                updateMember(member.id, { name: e.target.value });
                                                setEditingId(null);
                                            }}
                                            autoFocus
                                        />
                                        <div className="form-row">
                                            <label>Est. lap time (min):</label>
                                            <input
                                                type="number"
                                                defaultValue={Math.round(member.estimatedLapTime / 60)}
                                                min={1}
                                                onBlur={(e) =>
                                                    updateMember(member.id, {
                                                        estimatedLapTime: Number(e.target.value) * 60,
                                                    })
                                                }
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="member-info">
                                        <div className="member-name-row">
                                            <span className="member-order">#{idx + 1}</span>
                                            <strong>{member.name}</strong>
                                            {!member.active && <span className="badge badge-inactive">Inactive</span>}
                                            {!canReorder && <span className="badge badge-locked">🔒</span>}
                                        </div>
                                        <span className="member-estimate">
                                            ~{Math.round(member.estimatedLapTime / 60)}min/lap
                                        </span>
                                    </div>
                                )}
                                {!isReadOnly && (
                                    <div className="member-actions">
                                        <button
                                            className="btn btn-icon"
                                            onClick={() => setEditingId(editingId === member.id ? null : member.id)}
                                            title="Edit"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            className="btn btn-icon"
                                            onClick={() => updateMember(member.id, { active: !member.active })}
                                            title={member.active ? 'Mark inactive' : 'Mark active'}
                                        >
                                            {member.active ? '⏸️' : '▶️'}
                                        </button>
                                        <button
                                            className="btn btn-icon"
                                            onClick={() => moveInRotation(member.id, 'up')}
                                            title={canReorder ? 'Move up in rotation' : 'Cannot reorder (has laps)'}
                                            disabled={idx === 0 || !canReorder}
                                        >
                                            ↑
                                        </button>
                                        <button
                                            className="btn btn-icon"
                                            onClick={() => moveInRotation(member.id, 'down')}
                                            title={canReorder ? 'Move down in rotation' : 'Cannot reorder (has laps)'}
                                            disabled={idx === teamMembers.length - 1 || !canReorder}
                                        >
                                            ↓
                                        </button>
                                        <button
                                            className="btn btn-icon btn-danger"
                                            onClick={() => removeMember(member.id)}
                                            title="Remove"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </section>

            {guests.length > 0 && (
                <section>
                    <h2>Guests</h2>
                    <div className="member-list">
                        {guests.map((guest) => (
                            <div key={guest.id} className="member-card member-guest">
                                <div className="member-info">
                                    <div className="member-name-row">
                                        <strong>{guest.name}</strong>
                                        <span className="badge badge-guest">Guest</span>
                                    </div>
                                    <span className="member-estimate">
                                        ~{Math.round(guest.estimatedLapTime / 60)}min/lap
                                    </span>
                                </div>
                                {!isReadOnly && (
                                    <div className="member-actions">
                                        <button className="btn btn-icon btn-danger" onClick={() => removeMember(guest.id)}>
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {!isReadOnly && (
                <form onSubmit={handleAdd} className="add-member-form">
                    <h3>{isGuest ? 'Add Guest' : 'Add Team Member'}</h3>
                    <div className="form-row">
                        <input
                            type="text"
                            placeholder="Name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            required
                        />
                        <input
                            type="number"
                            placeholder="Est. minutes"
                            min={1}
                            value={newEstimate}
                            onChange={(e) => setNewEstimate(Number(e.target.value))}
                            style={{ width: '100px' }}
                        />
                    </div>
                    <div className="form-row">
                        <label className="checkbox-label">
                            <input type="checkbox" checked={isGuest} onChange={(e) => setIsGuest(e.target.checked)} />
                            Guest
                        </label>
                        <button type="submit" className="btn btn-primary" disabled={teamMembers.length >= 8 && !isGuest}>
                            Add {isGuest ? 'Guest' : 'Member'}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
