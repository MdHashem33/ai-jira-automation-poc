'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Mail, Brain, Ticket, CheckCircle2, AlertTriangle, Clock,
  Send, RefreshCw, ChevronDown, ChevronRight, Zap, Shield,
  BarChart3, ArrowRight, Sparkles, FileText, MessageSquare,
  XCircle, Loader2, TrendingUp, Bot, Radio, Power, PowerOff,
  Inbox, Wifi, WifiOff
} from 'lucide-react';

interface ProcessedTicket {
  id: string;
  channel: string;
  status: string;
  email: {
    from: string;
    fromName: string;
    subject: string;
    cleanBody: string;
    language: string;
    attachments: { filename: string; size: number }[];
    isReply: boolean;
    receivedAt: string;
  };
  aiAnalysis?: {
    intent: string;
    intentConfidence: number;
    priority: string;
    priorityReason: string;
    sentiment: string;
    summary: string;
    extractedEntities: Record<string, string>;
    suggestedTitle: string;
    suggestedLabels: string[];
    requiresHumanReview: boolean;
    ragMatch?: {
      found: boolean;
      articleTitle?: string;
      relevanceScore: number;
      suggestedResponse?: string;
    };
  };
  jiraKey?: string;
  autoReplyContent?: string;
  processingSteps: {
    step: string;
    status: string;
    details?: string;
    durationMs?: number;
  }[];
  processingTimeMs: number;
  createdAt: string;
}

interface DashboardStats {
  totalProcessed: number;
  autoResolved: number;
  escalatedToJira: number;
  failed: number;
  avgProcessingTimeMs: number;
  byPriority: Record<string, number>;
  byIntent: Record<string, number>;
  bySentiment: Record<string, number>;
  autoResolveRate: number;
}

interface SampleEmail {
  index: number;
  from: string;
  subject: string;
  hasAttachments: boolean;
}

interface MonitorStatus {
  running: boolean;
  connectedAt: string | null;
  lastCheckAt: string | null;
  emailsProcessed: number;
  errors: string[];
  mailbox: string;
  host: string;
  user: string;
  authType: 'basic' | 'oauth2' | 'none';
}

interface MicrosoftAuthStatus {
  authenticated: boolean;
  email: string | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [tickets, setTickets] = useState<ProcessedTicket[]>([]);
  const [samples, setSamples] = useState<SampleEmail[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<ProcessedTicket | null>(null);
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'simulate' | 'tickets' | 'monitor'>('dashboard');
  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus | null>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorMessage, setMonitorMessage] = useState<string | null>(null);
  const [msAuthStatus, setMsAuthStatus] = useState<MicrosoftAuthStatus | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, ticketsRes, samplesRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/tickets'),
        fetch('/api/email/simulate'),
      ]);
      const statsData = await statsRes.json();
      const ticketsData = await ticketsRes.json();
      const samplesData = await samplesRes.json();
      setStats(statsData);
      setTickets(ticketsData.tickets || []);
      setSamples(samplesData.samples || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchMonitorStatus = useCallback(async () => {
    try {
      const [monitorRes, authRes] = await Promise.all([
        fetch('/api/monitor'),
        fetch('/api/auth/microsoft'),
      ]);
      const monitorData = await monitorRes.json();
      const authData = await authRes.json();
      setMonitorStatus(monitorData);
      setMsAuthStatus(authData);
    } catch (error) {
      console.error('Failed to fetch monitor status:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'monitor') {
      fetchMonitorStatus();
      const interval = setInterval(() => {
        fetchMonitorStatus();
        fetchData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchMonitorStatus, fetchData]);

  const toggleMonitor = async (action: 'start' | 'stop') => {
    setMonitorLoading(true);
    setMonitorMessage(null);
    try {
      const res = await fetch('/api/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setMonitorMessage(data.message);
      await fetchMonitorStatus();
      if (action === 'start' && data.success) await fetchData();
    } catch (error) {
      setMonitorMessage(`Error: ${error}`);
    } finally {
      setMonitorLoading(false);
    }
  };

  const simulateEmail = async (sampleIndex?: number) => {
    setProcessing(true);
    try {
      const res = await fetch('/api/email/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleIndex }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTicket(data.ticket);
        await fetchData();
      }
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1c]">
      {/* Header */}
      <header className="border-b border-[#1e293b] bg-[#0d1224]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AI-Powered Jira Automation</h1>
                <p className="text-xs text-gray-400">Email Channel POC — Enterprise Middleware Architecture</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge-success flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                System Online
              </span>
              <button onClick={fetchData} className="btn-secondary flex items-center gap-2 text-sm">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Nav Tabs */}
      <div className="border-b border-[#1e293b] bg-[#0d1224]/50">
        <div className="max-w-7xl mx-auto px-6">
          <nav className="flex gap-1">
            {[
              { key: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
              { key: 'monitor' as const, label: 'Live Monitor', icon: Radio },
              { key: 'simulate' as const, label: 'Email Simulation', icon: Send },
              { key: 'tickets' as const, label: 'Processed Tickets', icon: Ticket },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && <DashboardView stats={stats} tickets={tickets} />}
        {activeTab === 'simulate' && (
          <SimulationView
            samples={samples}
            processing={processing}
            selectedTicket={selectedTicket}
            onSimulate={simulateEmail}
          />
        )}
        {activeTab === 'monitor' && (
          <MonitorView
            status={monitorStatus}
            loading={monitorLoading}
            message={monitorMessage}
            onToggle={toggleMonitor}
            tickets={tickets}
            msAuth={msAuthStatus}
          />
        )}
        {activeTab === 'tickets' && (
          <TicketsView
            tickets={tickets}
            selectedTicket={selectedTicket}
            onSelect={setSelectedTicket}
          />
        )}
      </main>
    </div>
  );
}

function DashboardView({ stats, tickets }: { stats: DashboardStats | null; tickets: ProcessedTicket[] }) {
  if (!stats) {
    return (
      <div className="text-center py-20">
        <Sparkles className="w-16 h-16 text-blue-500/30 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-300 mb-2">No Data Yet</h2>
        <p className="text-gray-500">Head to the Email Simulation tab to process some sample emails.</p>
      </div>
    );
  }

  const kpis = [
    { label: 'Total Processed', value: stats.totalProcessed, icon: Mail, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Auto-Resolved', value: stats.autoResolved, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Escalated to Jira', value: stats.escalatedToJira, icon: Ticket, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Auto-Resolve Rate', value: `${stats.autoResolveRate}%`, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Avg Processing Time', value: `${(stats.avgProcessingTimeMs / 1000).toFixed(1)}s`, icon: Clock, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Failed', value: stats.failed, icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Architecture Flow */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Processing Pipeline</h3>
        <div className="flex items-center justify-between flex-wrap gap-2">
          {[
            { label: 'Inbound Email', icon: Mail, color: 'text-blue-400' },
            { label: 'Email Parsing', icon: FileText, color: 'text-cyan-400' },
            { label: 'AI Classification', icon: Brain, color: 'text-purple-400' },
            { label: 'RAG Lookup', icon: Sparkles, color: 'text-amber-400' },
            { label: 'Decision Engine', icon: Zap, color: 'text-emerald-400' },
            { label: 'Jira / Auto-Reply', icon: Ticket, color: 'text-rose-400' },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-12 h-12 rounded-lg bg-[#1e293b] flex items-center justify-center ${step.color}`}>
                  <step.icon className="w-6 h-6" />
                </div>
                <span className="text-[10px] text-gray-500 text-center max-w-[80px]">{step.label}</span>
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-gray-600 mt-[-16px]" />}
            </div>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="card-hover">
            <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="text-xs text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Priority & Intent Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">By Priority</h3>
          <div className="space-y-3">
            {Object.entries(stats.byPriority).filter(([,v]) => v > 0).map(([key, value]) => {
              const colors: Record<string, string> = {
                critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-yellow-500', low: 'bg-green-500',
              };
              const total = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-16 capitalize">{key}</span>
                  <div className="flex-1 bg-[#1e293b] rounded-full h-2">
                    <div className={`${colors[key]} rounded-full h-2 transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-300 w-8 text-right">{value}</span>
                </div>
              );
            })}
            {Object.values(stats.byPriority).every(v => v === 0) && (
              <p className="text-sm text-gray-500">No data yet</p>
            )}
          </div>
        </div>
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">By Intent</h3>
          <div className="space-y-3">
            {Object.entries(stats.byIntent).filter(([,v]) => v > 0).map(([key, value]) => {
              const total = Object.values(stats.byIntent).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? (value / total) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-28 capitalize">{key.replace(/_/g, ' ')}</span>
                  <div className="flex-1 bg-[#1e293b] rounded-full h-2">
                    <div className="bg-blue-500 rounded-full h-2 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-300 w-8 text-right">{value}</span>
                </div>
              );
            })}
            {Object.values(stats.byIntent).every(v => v === 0) && (
              <p className="text-sm text-gray-500">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Tickets */}
      {tickets.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Recent Activity</h3>
          <div className="space-y-2">
            {tickets.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg bg-[#0d1224] hover:bg-[#1e293b]/50 transition-colors">
                <StatusIcon status={t.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{t.email.subject}</p>
                  <p className="text-xs text-gray-500">{t.email.fromName} — {new Date(t.createdAt).toLocaleString()}</p>
                </div>
                {t.aiAnalysis && <PriorityBadge priority={t.aiAnalysis.priority} />}
                {t.jiraKey && <span className="badge-info">{t.jiraKey}</span>}
                <span className="text-xs text-gray-500">{(t.processingTimeMs / 1000).toFixed(1)}s</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SimulationView({
  samples,
  processing,
  selectedTicket,
  onSimulate,
}: {
  samples: SampleEmail[];
  processing: boolean;
  selectedTicket: ProcessedTicket | null;
  onSimulate: (index?: number) => void;
}) {
  return (
    <div className="space-y-8">
      {/* Demo Intro */}
      <div className="card bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-blue-500/20">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Email Simulation Engine</h2>
            <p className="text-sm text-gray-400">
              Select a sample email scenario below to watch the full AI processing pipeline in action.
              Each email is parsed, analyzed by AI, checked against the knowledge base, and either auto-resolved
              or escalated to Jira — all in seconds.
            </p>
          </div>
        </div>
      </div>

      {/* Sample Emails */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {samples.map((sample) => (
          <button
            key={sample.index}
            onClick={() => onSimulate(sample.index)}
            disabled={processing}
            className="card-hover text-left group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <Mail className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-200 truncate">{sample.subject}</p>
                <p className="text-xs text-gray-500 mt-1">{sample.from}</p>
                {sample.hasAttachments && (
                  <span className="badge-info mt-2 inline-flex items-center gap-1">
                    <FileText className="w-3 h-3" /> Attachments
                  </span>
                )}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
              <Zap className="w-3 h-3" /> Click to process
            </div>
          </button>
        ))}
      </div>

      {/* Processing Indicator */}
      {processing && (
        <div className="card animate-shimmer">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <p className="text-sm text-blue-300">Processing email through AI pipeline...</p>
          </div>
        </div>
      )}

      {/* Result */}
      {selectedTicket && !processing && (
        <TicketDetail ticket={selectedTicket} />
      )}
    </div>
  );
}

function TicketsView({
  tickets,
  selectedTicket,
  onSelect,
}: {
  tickets: ProcessedTicket[];
  selectedTicket: ProcessedTicket | null;
  onSelect: (t: ProcessedTicket) => void;
}) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-20">
        <Ticket className="w-16 h-16 text-gray-700 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-300 mb-2">No Tickets Yet</h2>
        <p className="text-gray-500">Simulate some emails to see processed tickets here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Ticket List */}
      <div className="lg:col-span-1 space-y-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          All Tickets ({tickets.length})
        </h3>
        <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`w-full text-left p-4 rounded-xl border transition-all ${
                selectedTicket?.id === t.id
                  ? 'border-blue-500/50 bg-blue-500/5'
                  : 'border-[#1e293b] bg-[#111827] hover:border-[#334155]'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <StatusIcon status={t.status} />
                {t.aiAnalysis && <PriorityBadge priority={t.aiAnalysis.priority} />}
                {t.jiraKey && <span className="badge-info text-[10px]">{t.jiraKey}</span>}
              </div>
              <p className="text-sm text-gray-200 truncate">{t.email.subject}</p>
              <p className="text-xs text-gray-500 mt-1">{t.email.fromName}</p>
              <p className="text-[10px] text-gray-600 mt-1">{new Date(t.createdAt).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Ticket Detail */}
      <div className="lg:col-span-2">
        {selectedTicket ? (
          <TicketDetail ticket={selectedTicket} />
        ) : (
          <div className="card text-center py-20">
            <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500">Select a ticket to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MonitorView({
  status,
  loading,
  message,
  onToggle,
  tickets,
  msAuth,
}: {
  status: MonitorStatus | null;
  loading: boolean;
  message: string | null;
  onToggle: (action: 'start' | 'stop') => void;
  tickets: ProcessedTicket[];
  msAuth: MicrosoftAuthStatus | null;
}) {
  const isRunning = status?.running ?? false;
  const [msLoading, setMsLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    setMsLoading(true);
    try {
      const res = await fetch('/api/auth/microsoft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login' }),
      });
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error('Microsoft login failed:', error);
    } finally {
      setMsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Microsoft OAuth Login */}
      <div className="card bg-gradient-to-r from-blue-500/5 to-cyan-500/5 border-blue-500/20">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
            <Mail className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-white mb-1">Connect Your Outlook/Microsoft Email</h2>
            <p className="text-sm text-gray-400 mb-4">
              Sign in with your Microsoft account to monitor your Outlook inbox. The system will automatically
              process incoming emails through the AI pipeline.
            </p>
            
            {msAuth?.authenticated ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-emerald-400">Connected</p>
                  <p className="text-xs text-gray-400">{msAuth.email}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={handleMicrosoftLogin}
                disabled={msLoading}
                className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#2F2F2F] hover:bg-[#3F3F3F] text-white font-medium transition-colors disabled:opacity-50"
              >
                {msLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 21 21" fill="none">
                    <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
                  </svg>
                )}
                Sign in with Microsoft
              </button>
            )}

            {!msAuth?.authenticated && (
              <p className="text-xs text-gray-500 mt-3">
                Requires Microsoft OAuth app setup. See README for configuration.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Monitor Control</h3>
          <div className="flex items-center gap-2">
            {isRunning ? (
              <span className="badge-success flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                Disconnected
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isRunning ? (
            <button
              onClick={() => onToggle('start')}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Power className="w-5 h-5" />}
              Start Monitoring
            </button>
          ) : (
            <button
              onClick={() => onToggle('stop')}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <PowerOff className="w-5 h-5" />}
              Stop Monitoring
            </button>
          )}
        </div>

        {/* Status Message */}
        {message && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          }`}>
            {message}
          </div>
        )}
      </div>

      {/* Connection Details */}
      {status && isRunning && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-hover">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
              <Wifi className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-sm text-gray-400">Connected To</p>
            <p className="text-base font-semibold text-white truncate">{status.host}</p>
            <p className="text-xs text-gray-500 truncate">{status.user}</p>
          </div>
          <div className="card-hover">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <Inbox className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-sm text-gray-400">Mailbox</p>
            <p className="text-base font-semibold text-white">{status.mailbox}</p>
            <p className="text-xs text-gray-500">Since {new Date(status.connectedAt!).toLocaleTimeString()}</p>
          </div>
          <div className="card-hover">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
              <Mail className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-sm text-gray-400">Emails Processed</p>
            <p className="text-2xl font-bold text-white">{status.emailsProcessed}</p>
          </div>
          <div className="card-hover">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <p className="text-sm text-gray-400">Last Check</p>
            <p className="text-base font-semibold text-white">
              {status.lastCheckAt ? new Date(status.lastCheckAt).toLocaleTimeString() : 'Pending...'}
            </p>
          </div>
        </div>
      )}

      {/* Errors */}
      {status && status.errors.length > 0 && (
        <div className="card border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Recent Errors
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {status.errors.map((err, i) => (
              <p key={i} className="text-xs text-red-300/70 font-mono">{err}</p>
            ))}
          </div>
        </div>
      )}

      {/* Live Processed Tickets */}
      {tickets.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Processed Emails ({tickets.length})
          </h3>
          <div className="space-y-2">
            {tickets.slice(0, 10).map((t) => (
              <div key={t.id} className="flex items-center gap-4 p-3 rounded-lg bg-[#0d1224] hover:bg-[#1e293b]/50 transition-colors">
                <StatusIcon status={t.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{t.email.subject}</p>
                  <p className="text-xs text-gray-500">{t.email.fromName} — {new Date(t.createdAt).toLocaleString()}</p>
                </div>
                {t.aiAnalysis && (
                  <span className="text-xs text-gray-400 capitalize">{t.aiAnalysis.intent.replace(/_/g, ' ')}</span>
                )}
                {t.aiAnalysis && <PriorityBadge priority={t.aiAnalysis.priority} />}
                {t.jiraKey && <span className="badge-info">{t.jiraKey}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TicketDetail({ ticket }: { ticket: ProcessedTicket }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pipeline: true,
    analysis: true,
    email: false,
    reply: false,
  });

  const toggle = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-4 animate-slide-in">
      {/* Header */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StatusIcon status={ticket.status} />
              <StatusLabel status={ticket.status} />
              {ticket.jiraKey && <span className="badge-info">{ticket.jiraKey}</span>}
            </div>
            <h2 className="text-lg font-semibold text-white">{ticket.email.subject}</h2>
            <p className="text-sm text-gray-400 mt-1">
              From: {ticket.email.fromName} &lt;{ticket.email.from}&gt;
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-white">{(ticket.processingTimeMs / 1000).toFixed(1)}s</p>
            <p className="text-xs text-gray-500">Processing time</p>
          </div>
        </div>
      </div>

      {/* Pipeline Steps */}
      <CollapsibleSection
        title="Processing Pipeline"
        icon={<Zap className="w-4 h-4" />}
        expanded={expandedSections.pipeline}
        onToggle={() => toggle('pipeline')}
      >
        <div className="space-y-2">
          {ticket.processingSteps.map((step, i) => (
            <div key={i} className={`pipeline-step-${step.status === 'completed' ? 'completed' : step.status === 'failed' ? 'failed' : step.status === 'in_progress' ? 'active' : 'pending'}`}>
              <StepIcon status={step.status} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{step.step}</p>
                {step.details && <p className="text-xs opacity-70 mt-0.5 truncate">{step.details}</p>}
              </div>
              {step.durationMs !== undefined && (
                <span className="text-xs opacity-50">{step.durationMs}ms</span>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* AI Analysis */}
      {ticket.aiAnalysis && (
        <CollapsibleSection
          title="AI Analysis"
          icon={<Brain className="w-4 h-4" />}
          expanded={expandedSections.analysis}
          onToggle={() => toggle('analysis')}
        >
          <div className="space-y-4">
            {/* Classification Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0d1224] rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Intent</p>
                <p className="text-sm font-medium text-gray-200 capitalize">{ticket.aiAnalysis.intent.replace(/_/g, ' ')}</p>
                <p className="text-[10px] text-gray-500">{Math.round(ticket.aiAnalysis.intentConfidence * 100)}% confidence</p>
              </div>
              <div className="bg-[#0d1224] rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Priority</p>
                <PriorityBadge priority={ticket.aiAnalysis.priority} />
                <p className="text-[10px] text-gray-500 mt-1">{ticket.aiAnalysis.priorityReason}</p>
              </div>
              <div className="bg-[#0d1224] rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Sentiment</p>
                <SentimentBadge sentiment={ticket.aiAnalysis.sentiment} />
              </div>
              <div className="bg-[#0d1224] rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase">Human Review</p>
                <p className={`text-sm font-medium ${ticket.aiAnalysis.requiresHumanReview ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {ticket.aiAnalysis.requiresHumanReview ? 'Required' : 'Not Needed'}
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-[#0d1224] rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase mb-1">AI Summary</p>
              <p className="text-sm text-gray-300">{ticket.aiAnalysis.summary}</p>
            </div>

            {/* Suggested Title & Labels */}
            <div className="bg-[#0d1224] rounded-lg p-3">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Suggested Jira Title</p>
              <p className="text-sm text-gray-200 font-medium">{ticket.aiAnalysis.suggestedTitle}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {ticket.aiAnalysis.suggestedLabels.map((label) => (
                  <span key={label} className="badge bg-[#1e293b] text-gray-400 text-[10px]">{label}</span>
                ))}
              </div>
            </div>

            {/* Extracted Entities */}
            {Object.entries(ticket.aiAnalysis.extractedEntities).filter(([,v]) => v).length > 0 && (
              <div className="bg-[#0d1224] rounded-lg p-3">
                <p className="text-[10px] text-gray-500 uppercase mb-2">Extracted Entities</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(ticket.aiAnalysis.extractedEntities).filter(([,v]) => v).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-[10px] text-gray-500 capitalize">{key}: </span>
                      <span className="text-xs text-gray-300">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RAG Match */}
            {ticket.aiAnalysis.ragMatch?.found && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <p className="text-[10px] text-emerald-400 uppercase font-semibold">Knowledge Base Match</p>
                </div>
                <p className="text-sm text-gray-300">{ticket.aiAnalysis.ragMatch.articleTitle}</p>
                <p className="text-[10px] text-gray-500">Relevance: {Math.round(ticket.aiAnalysis.ragMatch.relevanceScore * 100)}%</p>
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* Original Email */}
      <CollapsibleSection
        title="Original Email"
        icon={<Mail className="w-4 h-4" />}
        expanded={expandedSections.email}
        onToggle={() => toggle('email')}
      >
        <div className="bg-[#0d1224] rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap font-mono text-xs">
          {ticket.email.cleanBody}
        </div>
        {ticket.email.attachments.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">Attachments:</p>
            <div className="flex flex-wrap gap-2">
              {ticket.email.attachments.map((a, i) => (
                <span key={i} className="badge bg-[#1e293b] text-gray-400 text-[10px] flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {a.filename}
                </span>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Auto Reply */}
      {ticket.autoReplyContent && (
        <CollapsibleSection
          title={ticket.status === 'resolved_auto' ? 'Auto-Reply Sent' : 'Escalation Confirmation'}
          icon={<MessageSquare className="w-4 h-4" />}
          expanded={expandedSections.reply}
          onToggle={() => toggle('reply')}
        >
          <div className="bg-[#0d1224] rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap">
            {ticket.autoReplyContent}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <button onClick={onToggle} className="flex items-center gap-2 w-full text-left">
        {expanded ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
        <span className="text-gray-400">{icon}</span>
        <h3 className="text-sm font-semibold text-gray-300">{title}</h3>
      </button>
      {expanded && <div className="mt-4">{children}</div>}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'resolved_auto':
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case 'escalated_jira':
      return <Ticket className="w-4 h-4 text-amber-400" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-400" />;
    case 'processing':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function StatusLabel({ status }: { status: string }) {
  const labels: Record<string, { text: string; class: string }> = {
    resolved_auto: { text: 'Auto-Resolved', class: 'badge-success' },
    escalated_jira: { text: 'Escalated to Jira', class: 'badge-warning' },
    failed: { text: 'Failed', class: 'badge-error' },
    processing: { text: 'Processing', class: 'badge-info' },
    classified: { text: 'Classified', class: 'badge-info' },
  };
  const label = labels[status] || { text: status, class: 'badge' };
  return <span className={label.class}>{label.text}</span>;
}

function StepIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 flex-shrink-0" />;
    case 'failed':
      return <XCircle className="w-4 h-4 flex-shrink-0" />;
    case 'in_progress':
      return <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />;
    default:
      return <div className="w-4 h-4 rounded-full border border-current flex-shrink-0" />;
  }
}

function PriorityBadge({ priority }: { priority: string }) {
  const classes: Record<string, string> = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
  };
  return <span className={classes[priority] || 'badge'}>{priority}</span>;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const config: Record<string, { color: string }> = {
    positive: { color: 'text-emerald-400' },
    neutral: { color: 'text-gray-400' },
    negative: { color: 'text-red-400' },
    frustrated: { color: 'text-orange-400' },
    urgent: { color: 'text-amber-400' },
  };
  const c = config[sentiment] || { color: 'text-gray-400' };
  return <p className={`text-sm font-medium capitalize ${c.color}`}>{sentiment}</p>;
}
