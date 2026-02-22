import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import * as Y from 'yjs';
import { LeveldbPersistence } from 'y-leveldb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const DIST_DIR = path.join(__dirname, '..', 'dist', 'client');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ============================================
// Pre-populated Events
// ============================================
interface EventConfig {
    id: string;
    name: string;
    startTime: number;
    endTime: number;
}

const EVENTS: EventConfig[] = [
    {
        id: 'endure-24',
        name: 'Endure 24',
        startTime: new Date('2026-06-06T12:00:00').getTime(),
        endTime: new Date('2026-06-07T12:00:00').getTime(),
    },
];

// ============================================
// Token store
// ============================================
interface TokenEntry {
    roomName: string;
    accessMode: 'edit' | 'view';
    teamName: string;
    eventId: string;
}

const TOKEN_FILE = path.join(DATA_DIR, 'tokens.json');

function loadTokens(): Map<string, TokenEntry> {
    try {
        if (fs.existsSync(TOKEN_FILE)) {
            const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
            return new Map(Object.entries(data));
        }
    } catch (e) {
        console.error('Failed to load tokens:', e);
    }
    return new Map();
}

function saveTokens(tokens: Map<string, TokenEntry>): void {
    fs.writeFileSync(
        TOKEN_FILE,
        JSON.stringify(Object.fromEntries(tokens), null, 2)
    );
}

const tokens = loadTokens();

// ============================================
// Y.js persistence
// ============================================
const persistence = new LeveldbPersistence(path.join(DATA_DIR, 'yjs-docs'));
const docs = new Map<string, Y.Doc>();

async function getYDoc(roomName: string): Promise<Y.Doc> {
    if (docs.has(roomName)) return docs.get(roomName)!;

    const doc = new Y.Doc();
    docs.set(roomName, doc);

    const persistedDoc = await persistence.getYDoc(roomName);
    const state = Y.encodeStateAsUpdate(persistedDoc);
    Y.applyUpdate(doc, state);

    doc.on('update', async (update: Uint8Array) => {
        await persistence.storeUpdate(roomName, update);
    });

    return doc;
}

// ============================================
// Express app
// ============================================
const app = express();
app.use(express.json());

// API: List events
app.get('/api/events', (_req, res) => {
    res.json(EVENTS);
});

// API: Get single event
app.get('/api/events/:eventId', (req, res) => {
    const event = EVENTS.find((e) => e.id === req.params.eventId);
    if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
    }
    res.json(event);
});

// API: Create team
app.post('/api/teams', async (req, res) => {
    const { eventId, teamName } = req.body;
    if (!eventId || !teamName) {
        res.status(400).json({ error: 'eventId and teamName are required' });
        return;
    }

    const event = EVENTS.find((e) => e.id === eventId);
    if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
    }

    const { nanoid } = await import('nanoid');
    const teamId = nanoid(12);
    const editToken = nanoid(20);
    const readToken = nanoid(20);
    const roomName = `team-${teamId}`;

    tokens.set(editToken, { roomName, accessMode: 'edit', teamName, eventId });
    tokens.set(readToken, { roomName, accessMode: 'view', teamName, eventId });
    saveTokens(tokens);

    // Initialize Yjs document with team data
    const doc = await getYDoc(roomName);
    const teamMap = doc.getMap('team');
    doc.transact(() => {
        teamMap.set('id', teamId);
        teamMap.set('eventId', eventId);
        teamMap.set('teamName', teamName);
        teamMap.set('editToken', editToken);
        teamMap.set('readToken', readToken);
        teamMap.set('createdAt', Date.now());
    });

    res.json({ teamId, editToken, readToken, eventId });
});

// API: Get team info
app.get('/api/teams/:token', (req, res) => {
    const entry = tokens.get(req.params.token);
    if (!entry) {
        res.status(404).json({ error: 'Team not found' });
        return;
    }

    const event = EVENTS.find((e) => e.id === entry.eventId);

    res.json({
        roomName: entry.roomName,
        accessMode: entry.accessMode,
        teamName: entry.teamName,
        eventId: entry.eventId,
        event: event || null,
    });
});

// Helper to extract data from Yjs doc
function extractDocData(doc: Y.Doc) {
    const teamMap = doc.getMap('team');
    const membersArr = doc.getArray('teamMembers');
    const lapsArr = doc.getArray('laps');

    const team = {
        id: teamMap.get('id') as string,
        eventId: teamMap.get('eventId') as string,
        teamName: teamMap.get('teamName') as string,
        editToken: teamMap.get('editToken') as string,
        readToken: teamMap.get('readToken') as string,
        createdAt: teamMap.get('createdAt') as number,
    };

    const members = membersArr.toArray().map((m: any) => {
        if (m instanceof Y.Map) return Object.fromEntries(m.entries());
        return m;
    });

    const laps = lapsArr.toArray().map((l: any) => {
        if (l instanceof Y.Map) return Object.fromEntries(l.entries());
        return l;
    });

    return { team, members, laps };
}

// API: Export JSON
app.get('/api/teams/:token/export/json', async (req, res) => {
    const entry = tokens.get(req.params.token);
    if (!entry) {
        res.status(404).json({ error: 'Team not found' });
        return;
    }

    const doc = await getYDoc(entry.roomName);
    const data = extractDocData(doc);
    const event = EVENTS.find((e) => e.id === entry.eventId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${data.team.teamName || 'team'}-export.json"`
    );
    res.send(
        JSON.stringify(
            { version: 1, exportedAt: new Date().toISOString(), event, ...data },
            null,
            2
        )
    );
});

// API: Export Markdown
app.get('/api/teams/:token/export/markdown', async (req, res) => {
    const entry = tokens.get(req.params.token);
    if (!entry) {
        res.status(404).json({ error: 'Team not found' });
        return;
    }

    const doc = await getYDoc(entry.roomName);
    const { team, members, laps } = extractDocData(doc);
    const event = EVENTS.find((e) => e.id === entry.eventId);

    let md = `# ${event?.name || 'Event'} — ${team.teamName}\n\n`;
    if (event) {
        md += `**Event:** ${event.name}  \n`;
        md += `**Start:** ${new Date(event.startTime).toLocaleString()}  \n`;
        md += `**End:** ${new Date(event.endTime).toLocaleString()}  \n\n`;
    }
    md += `## Laps\n\n`;
    md += `| # | Member | Status | Duration |\n|---|---|---|---|\n`;
    const sortedLaps = [...laps].sort((a: any, b: any) => a.order - b.order);
    for (const lap of sortedLaps) {
        const l = lap as any;
        const dur = l.actualDuration
            ? `${Math.floor(l.actualDuration / 60)}m ${Math.floor(l.actualDuration % 60)}s`
            : l.predictedDuration
                ? `~${Math.floor(l.predictedDuration / 60)}m`
                : '-';
        md += `| ${l.order} | ${l.memberName}${l.isGuest ? ' (guest)' : ''} | ${l.status} | ${dur} |\n`;
    }
    md += `\n## Team\n\n`;
    for (const m of members) {
        const mem = m as any;
        md += `- **${mem.name}**${mem.isGuest ? ' (guest)' : ''}${!mem.active ? ' (inactive)' : ''}\n`;
    }
    md += `\n---\n*Exported from Endure-O-Matic*\n`;

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader(
        'Content-Disposition',
        `attachment; filename="${team.teamName || 'team'}-summary.md"`
    );
    res.send(md);
});

// Serve static files in production
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
    app.get('*', (_req, res) => {
        res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
}

// ============================================
// HTTP + WebSocket server
// ============================================
const server = createServer(app);
const wss = new WebSocketServer({ server });

const messageSync = 0;
const messageAwareness = 1;

interface WSClient extends WebSocket {
    roomName?: string;
    isAlive?: boolean;
}

const rooms = new Map<string, Set<WSClient>>();

wss.on('connection', async (ws: WSClient, req) => {
    const url = new URL(req.url || '', `http://localhost:${PORT}`);
    const token = url.searchParams.get('token');
    const roomParam = url.searchParams.get('room');

    let roomName: string;
    let accessMode: 'edit' | 'view' = 'view';

    if (token && tokens.has(token)) {
        const entry = tokens.get(token)!;
        roomName = entry.roomName;
        accessMode = entry.accessMode;
    } else if (roomParam) {
        roomName = roomParam;
    } else {
        ws.close(4001, 'Invalid token');
        return;
    }

    ws.roomName = roomName;
    ws.isAlive = true;

    if (!rooms.has(roomName)) rooms.set(roomName, new Set());
    rooms.get(roomName)!.add(ws);

    const doc = await getYDoc(roomName);

    const encoder = createEncoder();
    writeVarUint(encoder, messageSync);
    writeSyncStep1(encoder, doc);
    ws.send(toUint8Array(encoder));

    ws.on('message', (data: Buffer) => {
        try {
            const message = new Uint8Array(data);
            const decoder = createDecoder(message);
            const messageType = readVarUint(decoder);

            if (messageType === messageSync) {
                const enc = createEncoder();
                writeVarUint(enc, messageSync);
                const syncMessageType = readSyncMessage(decoder, enc, doc);

                if (toUint8Array(enc).length > 1) {
                    ws.send(toUint8Array(enc));
                }

                if (syncMessageType === 2) {
                    const roomClients = rooms.get(roomName);
                    if (roomClients) {
                        for (const client of roomClients) {
                            if (client !== ws && client.readyState === WebSocket.OPEN) {
                                client.send(data);
                            }
                        }
                    }
                }
            } else if (messageType === messageAwareness) {
                const roomClients = rooms.get(roomName);
                if (roomClients) {
                    for (const client of roomClients) {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(data);
                        }
                    }
                }
            }
        } catch (e) {
            console.error('Error processing message:', e);
        }
    });

    ws.on('close', () => {
        const roomClients = rooms.get(roomName);
        if (roomClients) {
            roomClients.delete(ws);
            if (roomClients.size === 0) rooms.delete(roomName);
        }
    });

    ws.on('pong', () => {
        ws.isAlive = true;
    });
});

setInterval(() => {
    wss.clients.forEach((ws) => {
        const client = ws as WSClient;
        if (client.isAlive === false) {
            client.terminate();
            return;
        }
        client.isAlive = false;
        client.ping();
    });
}, 30000);

// ============================================
// Y.js sync protocol helpers
// ============================================
function createEncoder(): { data: number[] } {
    return { data: [] };
}

function createDecoder(data: Uint8Array): { data: Uint8Array; pos: number } {
    return { data, pos: 0 };
}

function writeVarUint(encoder: { data: number[] }, num: number): void {
    while (num > 0x7f) {
        encoder.data.push(0x80 | (num & 0x7f));
        num >>>= 7;
    }
    encoder.data.push(num & 0x7f);
}

function readVarUint(decoder: { data: Uint8Array; pos: number }): number {
    let num = 0;
    let mult = 1;
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

function writeSyncStep1(encoder: { data: number[] }, doc: Y.Doc): void {
    writeVarUint(encoder, 0);
    const sv = Y.encodeStateVector(doc);
    writeVarUint8Array(encoder, sv);
}

function readSyncMessage(
    decoder: { data: Uint8Array; pos: number },
    encoder: { data: number[] },
    doc: Y.Doc
): number {
    const msgType = readVarUint(decoder);
    switch (msgType) {
        case 0: {
            const sv = readVarUint8Array(decoder);
            const update = Y.encodeStateAsUpdate(doc, sv);
            writeVarUint(encoder, 1);
            writeVarUint8Array(encoder, update);
            return 1;
        }
        case 1: {
            const update = readVarUint8Array(decoder);
            Y.applyUpdate(doc, update);
            return 1;
        }
        case 2: {
            const update = readVarUint8Array(decoder);
            Y.applyUpdate(doc, update);
            return 2;
        }
        default:
            return 0;
    }
}

server.listen(PORT, () => {
    console.log(`🏃 Endure-O-Matic server running on http://localhost:${PORT}`);
});
