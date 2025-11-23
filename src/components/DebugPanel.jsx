import { useState, useEffect } from 'react';

export default function DebugPanel() {
    const [logs, setLogs] = useState([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Listen for scanner logs from main process
        const handleLog = (event, log) => {
            setLogs(prev => [...prev.slice(-50), log]); // Keep last 50 logs
        };

        window.electron?.ipcRenderer?.on?.('scanner-log', handleLog);

        return () => {
            window.electron?.ipcRenderer?.removeListener?.('scanner-log', handleLog);
        };
    }, []);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500 text-cyan-500 px-4 py-2 rounded font-mono text-sm z-50"
            >
                🔍 Scanner Logs ({logs.length})
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 w-[600px] h-[400px] bg-black/95 border border-cyan-500 rounded-lg shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-cyan-500/30">
                <h3 className="text-cyan-500 font-mono font-bold">🔍 Scanner Debug Logs</h3>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-cyan-500 hover:text-cyan-300"
                >
                    ✕
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
                {logs.length === 0 ? (
                    <div className="text-gray-500 italic">Waiting for scanner logs...</div>
                ) : (
                    logs.map((log, i) => (
                        <div
                            key={i}
                            className={`${log.level === 'error' ? 'text-red-400' :
                                    log.level === 'warn' ? 'text-yellow-400' :
                                        log.level === 'success' ? 'text-green-400' :
                                            'text-gray-300'
                                }`}
                        >
                            <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString()}]</span> {log.message}
                        </div>
                    ))
                )}
            </div>

            <div className="p-2 border-t border-cyan-500/30 flex gap-2">
                <button
                    onClick={() => setLogs([])}
                    className="text-xs text-gray-500 hover:text-cyan-500"
                >
                    Clear
                </button>
            </div>
        </div>
    );
}
