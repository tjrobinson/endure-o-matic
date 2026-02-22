import { useParams } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { useYjsDocument } from '../hooks/useYjsDocument';
import { AccessMode } from '../shared/types';
import { calculateStats } from '../shared/statistics';
import { generateSchedule } from '../shared/prediction';
import TeamPanel from '../components/TeamPanel';
import LapList from '../components/LapList';
import StatsBar from '../components/StatsBar';
import ExportMenu from '../components/ExportMenu';
import ShareLinks from '../components/ShareLinks';

interface TeamPageProps {
    mode: AccessMode;
}

export default function TeamPage({ mode }: TeamPageProps) {
    const { token } = useParams<{ token: string }>();
    const [activeTab, setActiveTab] = useState<'laps' | 'team'>('laps');
    const [now, setNow] = useState(Date.now());

    const {
        event,
        team,
        members,
        laps,
        connected,
        addMember,
        updateMember,
        removeMember,
        addLap,
        updateLap,
        removeLap,
        memberRotation,
        setMemberRotation,
        canReorderMember,
        hasActiveLap,
    } = useYjsDocument({
        token: token || '',
        accessMode: mode,
    });

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const stats = useMemo(() => {
        if (!event || !team) return null;
        return calculateStats(event, laps, members);
    }, [event, team, laps, members, now]);

    const schedule = useMemo(() => {
        if (!event || members.length === 0) return [];
        const activeMembers = members.filter((m) => m.active && !m.isGuest);
        const rotation =
            memberRotation.length > 0
                ? memberRotation.filter((id) => activeMembers.some((m) => m.id === id))
                : activeMembers.map((m) => m.id);
        if (rotation.length === 0) return [];
        return generateSchedule(members, laps, event.startTime, event.endTime, rotation);
    }, [event, members, laps, memberRotation, now]);

    if (!token) {
        return (
            <div className="page">
                <div className="card"><h2>Invalid link</h2></div>
            </div>
        );
    }

    if (!team || !event) {
        return (
            <div className="page">
                <div className="loading">
                    <div className="spinner" />
                    <p>Connecting to team...</p>
                </div>
            </div>
        );
    }

    const isReadOnly = mode === 'view';
    const eventStarted = now >= event.startTime;
    const eventEnded = now >= event.endTime;

    return (
        <div className="page event-page">
            <header className="event-header">
                <div className="event-header-top">
                    <div>
                        <h1>{team.teamName}</h1>
                        <p className="event-subtitle">{event.name}</p>
                    </div>
                    <div className="header-badges">
                        {isReadOnly && <span className="badge badge-view">View Only</span>}
                        <span className={`badge ${connected ? 'badge-online' : 'badge-offline'}`}>
                            {connected ? '● Connected' : '○ Offline'}
                        </span>
                        {eventEnded && <span className="badge badge-ended">Event Ended</span>}
                        {eventStarted && !eventEnded && <span className="badge badge-live">● Live</span>}
                    </div>
                </div>
                {stats && <StatsBar stats={stats} event={event} now={now} />}
            </header>

            <nav className="tabs">
                <button className={`tab ${activeTab === 'laps' ? 'tab-active' : ''}`} onClick={() => setActiveTab('laps')}>
                    🏁 Laps & Schedule
                </button>
                <button className={`tab ${activeTab === 'team' ? 'tab-active' : ''}`} onClick={() => setActiveTab('team')}>
                    👥 Team
                </button>
            </nav>

            <main className="tab-content">
                {activeTab === 'laps' && (
                    <LapList
                        laps={laps}
                        members={members}
                        event={event}
                        isReadOnly={isReadOnly}
                        addLap={addLap}
                        updateLap={updateLap}
                        removeLap={removeLap}
                        memberRotation={memberRotation}
                        hasActiveLap={hasActiveLap}
                        schedule={schedule}
                        now={now}
                    />
                )}
                {activeTab === 'team' && (
                    <TeamPanel
                        members={members}
                        isReadOnly={isReadOnly}
                        addMember={addMember}
                        updateMember={updateMember}
                        removeMember={removeMember}
                        memberRotation={memberRotation}
                        setMemberRotation={setMemberRotation}
                        canReorderMember={canReorderMember}
                    />
                )}
            </main>

            <footer className="event-footer">
                <ExportMenu token={token} />
                {!isReadOnly && team && <ShareLinks team={team} />}
            </footer>
        </div>
    );
}
