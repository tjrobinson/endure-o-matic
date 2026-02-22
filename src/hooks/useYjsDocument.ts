import { useEffect, useState, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { EventConfig, TeamData, Lap, TeamMember, AccessMode } from '../shared/types';

interface UseYjsDocumentOptions {
    token: string;
    accessMode: AccessMode;
}

interface UseYjsDocumentReturn {
    doc: Y.Doc | null;
    event: EventConfig | null;
    team: TeamData | null;
    members: TeamMember[];
    laps: Lap[];
    connected: boolean;
    addMember: (member: Omit<TeamMember, 'id'>) => void;
    updateMember: (id: string, updates: Partial<TeamMember>) => void;
    removeMember: (id: string) => void;
    addLap: (lap: Omit<Lap, 'id'>) => void;
    updateLap: (id: string, updates: Partial<Lap>) => void;
    removeLap: (id: string) => void;
    memberRotation: string[];
    setMemberRotation: (rotation: string[]) => void;
    canReorderMember: (id: string) => boolean;
    hasActiveLap: () => boolean;
}

export function useYjsDocument({
    token,
    accessMode,
}: UseYjsDocumentOptions): UseYjsDocumentReturn {
    const [doc] = useState(() => new Y.Doc());
    const [event, setEvent] = useState<EventConfig | null>(null);
    const [team, setTeam] = useState<TeamData | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [laps, setLaps] = useState<Lap[]>([]);
    const [connected, setConnected] = useState(false);
    const [memberRotation, setMemberRotationState] = useState<string[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);

    // Fetch event config from API
    useEffect(() => {
        fetch(`/api/teams/${token}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.event) setEvent(data.event);
            })
            .catch(console.error);
    }, [token]);

    const syncFromDoc = useCallback(() => {
        const teamMap = doc.getMap('team');
        const membersArr = doc.getArray('teamMembers');
        const lapsArr = doc.getArray('laps');
        const rotationArr = doc.getArray('memberRotation');

        if (teamMap.get('id')) {
            setTeam({
                id: teamMap.get('id') as string,
                eventId: teamMap.get('eventId') as string,
                teamName: teamMap.get('teamName') as string,
                editToken: teamMap.get('editToken') as string,
                readToken: teamMap.get('readToken') as string,
                createdAt: teamMap.get('createdAt') as number,
            });
        }

        setMembers(
            membersArr.toArray().map((m) => {
                if (m instanceof Y.Map) return Object.fromEntries(m.entries()) as TeamMember;
                return m as TeamMember;
            })
        );

        setLaps(
            lapsArr
                .toArray()
                .map((l) => {
                    if (l instanceof Y.Map) return Object.fromEntries(l.entries()) as Lap;
                    return l as Lap;
                })
                .sort((a, b) => a.order - b.order)
        );

        setMemberRotationState(rotationArr.toArray() as string[]);
    }, [doc]);

    // WebSocket connection
    useEffect(() => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsHost = import.meta.env.DEV
            ? `ws://localhost:3000`
            : `${wsProtocol}//${window.location.host}`;

        function connect() {
            const ws = new WebSocket(`${wsHost}/ws?token=${token}`);
            wsRef.current = ws;
            ws.binaryType = 'arraybuffer';

            ws.onopen = () => {
                setConnected(true);
                const sv = Y.encodeStateVector(doc);
                const encoder = createEncoder();
                writeVarUint(encoder, 0);
                writeVarUint(encoder, 0);
                writeVarUint8Array(encoder, sv);
                ws.send(toUint8Array(encoder));
            };

            ws.onmessage = (evt) => {
                const data = new Uint8Array(evt.data as ArrayBuffer);
                const decoder = createDecoder(data);
                const messageType = readVarUint(decoder);

                if (messageType === 0) {
                    const syncType = readVarUint(decoder);
                    if (syncType === 0) {
                        const sv = readVarUint8Array(decoder);
                        const update = Y.encodeStateAsUpdate(doc, sv);
                        const encoder = createEncoder();
                        writeVarUint(encoder, 0);
                        writeVarUint(encoder, 1);
                        writeVarUint8Array(encoder, update);
                        ws.send(toUint8Array(encoder));

                        const sv2 = Y.encodeStateVector(doc);
                        const encoder2 = createEncoder();
                        writeVarUint(encoder2, 0);
                        writeVarUint(encoder2, 0);
                        writeVarUint8Array(encoder2, sv2);
                        ws.send(toUint8Array(encoder2));
                    } else if (syncType === 1) {
                        const update = readVarUint8Array(decoder);
                        Y.applyUpdate(doc, update);
                    } else if (syncType === 2) {
                        const update = readVarUint8Array(decoder);
                        Y.applyUpdate(doc, update);
                    }
                }
                syncFromDoc();
            };

            ws.onclose = () => {
                setConnected(false);
                reconnectTimeoutRef.current = window.setTimeout(connect, 2000);
            };

            ws.onerror = () => ws.close();
        }

        const updateHandler = (update: Uint8Array, origin: any) => {
            if (origin === 'remote') return;
            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
                const encoder = createEncoder();
                writeVarUint(encoder, 0);
                writeVarUint(encoder, 2);
                writeVarUint8Array(encoder, update);
                ws.send(toUint8Array(encoder));
            }
            syncFromDoc();
        };

        doc.on('update', updateHandler);

        const idbProvider = new IndexeddbPersistence(`endure-${token}`, doc);
        idbProvider.on('synced', () => syncFromDoc());

        connect();

        return () => {
            doc.off('update', updateHandler);
            if (wsRef.current) wsRef.current.close();
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            idbProvider.destroy();
        };
    }, [doc, token, syncFromDoc]);

    const genId = () =>
        Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

    // Check if a member can be reordered (no completed or active laps)
    const canReorderMember = useCallback(
        (id: string) => {
            return !laps.some(
                (l) => l.memberId === id && (l.status === 'completed' || l.status === 'active')
            );
        },
        [laps]
    );

    // Check if there's an active lap
    const hasActiveLap = useCallback(() => {
        return laps.some((l) => l.status === 'active');
    }, [laps]);

    const addMember = useCallback(
        (member: Omit<TeamMember, 'id'>) => {
            if (accessMode !== 'edit') return;
            const membersArr = doc.getArray('teamMembers');
            const rotationArr = doc.getArray('memberRotation');
            const id = genId();
            const yMember = new Y.Map();
            doc.transact(() => {
                yMember.set('id', id);
                yMember.set('name', member.name);
                yMember.set('estimatedLapTime', member.estimatedLapTime);
                yMember.set('active', member.active);
                yMember.set('isGuest', member.isGuest);
                membersArr.push([yMember]);
                if (!member.isGuest) {
                    rotationArr.push([id]);
                }
            });
        },
        [doc, accessMode]
    );

    const updateMember = useCallback(
        (id: string, updates: Partial<TeamMember>) => {
            if (accessMode !== 'edit') return;
            const membersArr = doc.getArray('teamMembers');
            doc.transact(() => {
                for (let i = 0; i < membersArr.length; i++) {
                    const m = membersArr.get(i) as Y.Map<any>;
                    if (m.get('id') === id) {
                        for (const [key, value] of Object.entries(updates)) {
                            m.set(key, value);
                        }
                        break;
                    }
                }
            });
        },
        [doc, accessMode]
    );

    const removeMember = useCallback(
        (id: string) => {
            if (accessMode !== 'edit') return;
            const membersArr = doc.getArray('teamMembers');
            const rotationArr = doc.getArray('memberRotation');
            doc.transact(() => {
                for (let i = 0; i < membersArr.length; i++) {
                    const m = membersArr.get(i) as Y.Map<any>;
                    if (m.get('id') === id) {
                        membersArr.delete(i, 1);
                        break;
                    }
                }
                for (let i = 0; i < rotationArr.length; i++) {
                    if (rotationArr.get(i) === id) {
                        rotationArr.delete(i, 1);
                        break;
                    }
                }
            });
        },
        [doc, accessMode]
    );

    const addLap = useCallback(
        (lap: Omit<Lap, 'id'>) => {
            if (accessMode !== 'edit') return;
            const lapsArr = doc.getArray('laps');
            const id = genId();
            const yLap = new Y.Map();
            doc.transact(() => {
                yLap.set('id', id);
                yLap.set('memberId', lap.memberId);
                yLap.set('memberName', lap.memberName);
                yLap.set('order', lap.order);
                yLap.set('status', lap.status);
                yLap.set('plannedStartTime', lap.plannedStartTime);
                yLap.set('actualStartTime', lap.actualStartTime);
                yLap.set('actualEndTime', lap.actualEndTime);
                yLap.set('predictedDuration', lap.predictedDuration);
                yLap.set('actualDuration', lap.actualDuration);
                yLap.set('isGuest', lap.isGuest);
                lapsArr.push([yLap]);
            });
        },
        [doc, accessMode]
    );

    const updateLap = useCallback(
        (id: string, updates: Partial<Lap>) => {
            if (accessMode !== 'edit') return;
            const lapsArr = doc.getArray('laps');
            doc.transact(() => {
                for (let i = 0; i < lapsArr.length; i++) {
                    const l = lapsArr.get(i) as Y.Map<any>;
                    if (l.get('id') === id) {
                        for (const [key, value] of Object.entries(updates)) {
                            l.set(key, value);
                        }
                        break;
                    }
                }
            });
        },
        [doc, accessMode]
    );

    const removeLap = useCallback(
        (id: string) => {
            if (accessMode !== 'edit') return;
            const lapsArr = doc.getArray('laps');
            doc.transact(() => {
                for (let i = 0; i < lapsArr.length; i++) {
                    const l = lapsArr.get(i) as Y.Map<any>;
                    if (l.get('id') === id) {
                        lapsArr.delete(i, 1);
                        break;
                    }
                }
            });
        },
        [doc, accessMode]
    );

    const setMemberRotation = useCallback(
        (rotation: string[]) => {
            if (accessMode !== 'edit') return;
            const rotationArr = doc.getArray('memberRotation');
            doc.transact(() => {
                rotationArr.delete(0, rotationArr.length);
                rotationArr.push(rotation);
            });
        },
        [doc, accessMode]
    );

    return {
        doc,
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
    };
}

// Encoding helpers
function createEncoder(): { data: number[] } {
    return { data: [] };
}
function createDecoder(data: Uint8Array): { data: Uint8Array; pos: number } {
    return { data, pos: 0 };
}
function writeVarUint(encoder: { data: number[] }, num: number): void {
    while (num > 0x7f) { encoder.data.push(0x80 | (num & 0x7f)); num >>>= 7; }
    encoder.data.push(num & 0x7f);
}
function readVarUint(decoder: { data: Uint8Array; pos: number }): number {
    let num = 0; let mult = 1;
    while (true) {
        const byte = decoder.data[decoder.pos++];
        num += (byte & 0x7f) * mult;
        if (byte < 0x80) return num;
        mult *= 128;
    }
}
function writeVarUint8Array(encoder: { data: number[] }, arr: Uint8Array): void {
    writeVarUint(encoder, arr.length);
    for (let i = 0; i < arr.length; i++) encoder.data.push(arr[i]);
}
function readVarUint8Array(decoder: { data: Uint8Array; pos: number }): Uint8Array {
    const length = readVarUint(decoder);
    const arr = decoder.data.slice(decoder.pos, decoder.pos + length);
    decoder.pos += length;
    return arr;
}
function toUint8Array(encoder: { data: number[] }): Uint8Array {
    return new Uint8Array(encoder.data);
}
