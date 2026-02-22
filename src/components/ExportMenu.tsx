interface ExportMenuProps {
    token: string;
}

export default function ExportMenu({ token }: ExportMenuProps) {
    return (
        <div className="export-menu">
            <button className="btn btn-ghost" onClick={() => window.open(`/api/teams/${token}/export/json`, '_blank')}>
                📦 Export JSON
            </button>
            <button className="btn btn-ghost" onClick={() => window.open(`/api/teams/${token}/export/markdown`, '_blank')}>
                📄 Export Markdown
            </button>
        </div>
    );
}
