import { useState } from 'react';
import { TeamData } from '../shared/types';

interface ShareLinksProps {
    team: TeamData;
}

export default function ShareLinks({ team }: ShareLinksProps) {
    const [showLinks, setShowLinks] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const baseUrl = window.location.origin;

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopied(label);
        setTimeout(() => setCopied(null), 2000);
    };

    if (!showLinks) {
        return (
            <button className="btn btn-ghost" onClick={() => setShowLinks(true)}>
                🔗 Share
            </button>
        );
    }

    return (
        <div className="share-panel">
            <div className="share-header">
                <h3>Share Team</h3>
                <button className="btn btn-icon" onClick={() => setShowLinks(false)}>✕</button>
            </div>
            <div className="share-link-row">
                <span className="badge badge-edit">Edit</span>
                <code className="share-url">{baseUrl}/team/edit/{team.editToken}</code>
                <button
                    className="btn btn-sm"
                    onClick={() => copyToClipboard(`${baseUrl}/team/edit/${team.editToken}`, 'edit')}
                >
                    {copied === 'edit' ? '✓ Copied' : 'Copy'}
                </button>
            </div>
            <div className="share-link-row">
                <span className="badge badge-view">View</span>
                <code className="share-url">{baseUrl}/team/view/{team.readToken}</code>
                <button
                    className="btn btn-sm"
                    onClick={() => copyToClipboard(`${baseUrl}/team/view/${team.readToken}`, 'view')}
                >
                    {copied === 'view' ? '✓ Copied' : 'Copy'}
                </button>
            </div>
        </div>
    );
}
