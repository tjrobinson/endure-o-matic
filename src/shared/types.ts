/** Pre-populated event configuration (server-defined) */
export interface EventConfig {
    id: string;
    name: string;
    startTime: number; // unix ms
    endTime: number; // unix ms
}

/** User-created team within an event */
export interface TeamData {
    id: string;
    eventId: string;
    teamName: string;
    editToken: string;
    readToken: string;
    createdAt: number;
}

export interface TeamMember {
    id: string;
    name: string;
    estimatedLapTime: number; // seconds
    active: boolean;
    isGuest: boolean;
}

export type LapStatus = 'planned' | 'active' | 'completed';

export interface Lap {
    id: string;
    memberId: string;
    memberName: string;
    order: number;
    status: LapStatus;
    plannedStartTime: number; // unix ms
    actualStartTime: number | null;
    actualEndTime: number | null;
    predictedDuration: number; // seconds — editable when planned/active
    actualDuration: number | null; // seconds — editable when completed
    isGuest: boolean;
}

export interface ScheduleEntry {
    lapNumber: number;
    memberId: string;
    memberName: string;
    predictedStartTime: number;
    predictedDuration: number;
    predictedEndTime: number;
    isGuest: boolean;
}

export interface EventStats {
    percentComplete: number;
    totalLaps: number;
    completedLaps: number;
    activeLap: Lap | null;
    fastestLap: Lap | null;
    averageLapTime: number | null;
    memberStats: MemberStats[];
}

export interface MemberStats {
    memberId: string;
    memberName: string;
    lapsCompleted: number;
    averageLapTime: number | null;
    fastestLap: number | null;
    totalTime: number;
    isGuest: boolean;
}

export type AccessMode = 'edit' | 'view';
