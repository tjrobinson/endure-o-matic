import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { EventConfig } from '../shared/types';

export default function HomePage() {
    const navigate = useNavigate();
    const [events, setEvents] = useState<EventConfig[]>([]);
    const [selectedEvent, setSelectedEvent] = useState<string>('');
    const [teamName, setTeamName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<{
        editToken: string;
        readToken: string;
    } | null>(null);

    useEffect(() => {
        fetch('/api/events')
            .then((res) => res.json())
            .then((data) => {
                setEvents(data);
                if (data.length > 0) setSelectedEvent(data[0].id);
            })
            .catch(() => setError('Failed to load events'));
    }, []);

    const selectedEventData = events.find((e) => e.id === selectedEvent);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId: selectedEvent, teamName }),
            });

            if (!res.ok) throw new Error('Failed to create team');
            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const baseUrl = window.location.origin;

    if (result) {
        return (
            <div className="page">
                <div className="card card-hero">
                    <div className="hero-icon">🎉</div>
                    <h1>Team Created!</h1>
                    <p className="subtitle">
                        {teamName} — {selectedEventData?.name}
                    </p>

                    <div className="link-section">
                        <h3>
                            📝 Edit Link <span className="badge badge-edit">Team</span>
                        </h3>
                        <p className="hint">Share this with your team members</p>
                        <div className="link-box">
                            <code>
                                {baseUrl}/team/edit/{result.editToken}
                            </code>
                            <button
                                className="btn btn-sm"
                                onClick={() =>
                                    navigator.clipboard.writeText(
                                        `${baseUrl}/team/edit/${result.editToken}`
                                    )
                                }
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    <div className="link-section">
                        <h3>
                            👀 View Link{' '}
                            <span className="badge badge-view">Spectators</span>
                        </h3>
                        <p className="hint">Share this with spectators and supporters</p>
                        <div className="link-box">
                            <code>
                                {baseUrl}/team/view/{result.readToken}
                            </code>
                            <button
                                className="btn btn-sm"
                                onClick={() =>
                                    navigator.clipboard.writeText(
                                        `${baseUrl}/team/view/${result.readToken}`
                                    )
                                }
                            >
                                Copy
                            </button>
                        </div>
                    </div>

                    <button
                        className="btn btn-primary btn-lg"
                        onClick={() => navigate(`/team/edit/${result.editToken}`)}
                    >
                        Open Team →
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="card card-hero">
                <div className="hero-icon">🏃</div>
                <h1>Endure-O-Matic</h1>
                <p className="subtitle">
                    Plan and track your team endurance events with real-time collaboration
                </p>

                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label htmlFor="event-select">Select Event</label>
                        <select
                            id="event-select"
                            value={selectedEvent}
                            onChange={(e) => setSelectedEvent(e.target.value)}
                            required
                        >
                            {events.map((ev) => (
                                <option key={ev.id} value={ev.id}>
                                    {ev.name} —{' '}
                                    {new Date(ev.startTime).toLocaleDateString([], {
                                        weekday: 'short',
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric',
                                    })}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedEventData && (
                        <div className="event-info-box">
                            <div className="event-info-row">
                                <span className="event-info-label">📅 Start</span>
                                <span>{new Date(selectedEventData.startTime).toLocaleString()}</span>
                            </div>
                            <div className="event-info-row">
                                <span className="event-info-label">🏁 End</span>
                                <span>{new Date(selectedEventData.endTime).toLocaleString()}</span>
                            </div>
                            <div className="event-info-row">
                                <span className="event-info-label">⏱️ Duration</span>
                                <span>
                                    {Math.round(
                                        (selectedEventData.endTime - selectedEventData.startTime) /
                                        3600000
                                    )}
                                    h
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="team-name">Team Name</label>
                        <input
                            id="team-name"
                            type="text"
                            placeholder="e.g. The Endurance Runners"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="error-msg">{error}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg"
                        disabled={loading || !selectedEvent}
                    >
                        {loading ? 'Creating...' : 'Create Team'}
                    </button>
                </form>
            </div>
        </div>
    );
}
