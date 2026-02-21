'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { copyToClipboard } from '@/lib/clipboard'
import parseLLMJson from '@/lib/jsonParser'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Switch } from '@/components/ui/switch'
import { FiMail, FiCopy, FiTrash2, FiCheck, FiAlertTriangle, FiClock, FiChevronDown, FiChevronRight, FiEdit3, FiRefreshCw, FiSearch, FiX, FiMenu, FiFileText, FiSend, FiLoader, FiMaximize2, FiMinimize2 } from 'react-icons/fi'

// --- Constants ---
const AGENT_ID = '69996a0682d9195c9e524bc5'
const HISTORY_KEY = 'echoai_reply_history'

// --- Types ---
interface EmailResponse {
  detected_intent?: string
  is_sensitive?: boolean
  sensitivity_reason?: string
  subject_line?: string
  greeting?: string
  body?: string
  closing?: string
  signature_placeholder?: string
  confidence_score?: number
}

interface HistoryEntry {
  id: string
  timestamp: string
  originalEmail: string
  senderName: string
  designation: string
  companyName: string
  tone: string
  length: string
  contextNotes: string
  response: EmailResponse
}

// --- Data Extraction ---
function extractAgentData(result: any): EmailResponse | null {
  let data = result?.response?.result
  if (typeof data === 'string') {
    data = parseLLMJson(data)
  }
  if (data?.result && typeof data.result === 'object') {
    data = data.result
  }
  if (typeof data?.text === 'string') {
    try {
      const parsed = parseLLMJson(data.text)
      if (parsed && typeof parsed === 'object' && !parsed.error) {
        data = parsed
      }
    } catch {}
  }
  if (!data || typeof data !== 'object') return null
  return data as EmailResponse
}

// --- Markdown Renderer ---
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-2">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// --- Sample Data ---
const SAMPLE_EMAIL = `Dear Customer Service Team,

I am writing to express my deep frustration with the recent order #ORD-20240315-7892 placed on March 15, 2024. The product I received was significantly different from what was advertised on your website.

Specifically, I ordered the Premium Wireless Headphones (Model WH-1000X) in Midnight Black, but instead received a completely different model (Basic Wired Earbuds) in white. This is unacceptable and does not meet the standards I expected from your company.

I have been a loyal customer for over 3 years and have made numerous purchases without any issues until now. I expect a full refund or an immediate replacement of the correct product, along with a prepaid return label for the wrong item.

If this matter is not resolved within 5 business days, I will be forced to escalate this issue through consumer protection channels and leave detailed reviews of my experience.

I look forward to your prompt response.

Regards,
Michael Chen
Order #ORD-20240315-7892`

const SAMPLE_RESPONSE: EmailResponse = {
  detected_intent: 'complaint',
  is_sensitive: false,
  sensitivity_reason: '',
  subject_line: 'Re: Order #ORD-20240315-7892 - Resolution for Incorrect Item Received',
  greeting: 'Dear Mr. Chen,',
  body: 'Thank you for bringing this matter to our attention and for your continued loyalty over the past three years. We sincerely apologize for the inconvenience caused by receiving the incorrect product.\n\nWe have reviewed your order #ORD-20240315-7892 and confirmed that an error occurred during the fulfillment process. We take full responsibility for this oversight and would like to offer you the following resolution:\n\n1. An immediate shipment of the correct Premium Wireless Headphones (Model WH-1000X) in Midnight Black via expedited shipping at no additional cost.\n2. A prepaid return label will be sent to your registered email address within the next 2 hours for returning the incorrect item.\n3. A 15% discount code for your next purchase as a token of our appreciation for your patience and understanding.\n\nPlease rest assured that we value your business and are committed to resolving this matter promptly. If you have any additional questions or concerns, please do not hesitate to reach out directly.',
  closing: 'We appreciate your patience and look forward to making this right.',
  signature_placeholder: '[Your Name]\nCustomer Relations Manager\n[Company Name]',
  confidence_score: 92
}

// --- ErrorBoundary ---
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Helper: localStorage ---
function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch {}
}

// --- Confidence Bar ---
function ConfidenceBar({ score }: { score: number }) {
  const safeScore = typeof score === 'number' ? Math.min(100, Math.max(0, score)) : 0
  const getColor = () => {
    if (safeScore >= 80) return 'bg-green-600'
    if (safeScore >= 60) return 'bg-yellow-600'
    return 'bg-red-600'
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground tracking-tight">Confidence</span>
        <span className="text-xs font-medium tracking-tight">{safeScore}%</span>
      </div>
      <div className="h-1.5 w-full bg-muted overflow-hidden">
        <div className={`h-full transition-all duration-500 ${getColor()}`} style={{ width: `${safeScore}%` }} />
      </div>
    </div>
  )
}

// --- Segmented Toggle ---
function SegmentedToggle({ options, value, onChange, label }: { options: string[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</label>
      <div className="flex border border-border">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex-1 px-4 py-2 text-sm font-medium tracking-tight transition-colors ${value === opt ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-muted'}`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// --- History Card ---
function HistoryCard({ entry, onCopy, onDelete, onExpand, isExpanded }: { entry: HistoryEntry; onCopy: () => void; onDelete: () => void; onExpand: () => void; isExpanded: boolean }) {
  const [copyFeedback, setCopyFeedback] = useState(false)

  const handleCopy = async () => {
    const fullReply = [
      entry.response?.greeting ?? '',
      '',
      entry.response?.body ?? '',
      '',
      entry.response?.closing ?? '',
      '',
      entry.response?.signature_placeholder ?? ''
    ].join('\n')
    const success = await copyToClipboard(fullReply)
    if (success) {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    }
    onCopy()
  }

  const formatDate = (ts: string) => {
    try {
      const d = new Date(ts)
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ts
    }
  }

  return (
    <Card className="border border-border shadow-none">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {entry.response?.detected_intent && (
                <Badge variant="secondary" className="text-xs uppercase tracking-wider font-medium">
                  {entry.response.detected_intent}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs tracking-tight">
                {entry.tone}
              </Badge>
            </div>
            <p className="text-sm font-medium tracking-tight truncate">{entry.response?.subject_line ?? 'No subject'}</p>
            <p className="text-xs text-muted-foreground tracking-tight mt-1 line-clamp-2">{entry.originalEmail?.slice(0, 150) ?? ''}...</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground tracking-tight flex items-center gap-1">
              <FiClock className="w-3 h-3" />
              {formatDate(entry.timestamp)}
            </span>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border pt-4 space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Original Email</p>
              <div className="bg-muted p-3 text-sm leading-relaxed tracking-tight whitespace-pre-wrap">{entry.originalEmail}</div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">Generated Reply</p>
              <div className="bg-muted p-3 text-sm leading-relaxed tracking-tight whitespace-pre-wrap">
                {entry.response?.subject_line && <p className="font-medium mb-2">Subject: {entry.response.subject_line}</p>}
                <p>{entry.response?.greeting ?? ''}</p>
                <div className="mt-2">{renderMarkdown(entry.response?.body ?? '')}</div>
                <p className="mt-2">{entry.response?.closing ?? ''}</p>
                <p className="mt-2 text-muted-foreground whitespace-pre-wrap">{entry.response?.signature_placeholder ?? ''}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExpand} className="text-xs tracking-tight">
            {isExpanded ? <FiMinimize2 className="w-3 h-3 mr-1" /> : <FiMaximize2 className="w-3 h-3 mr-1" />}
            {isExpanded ? 'Collapse' : 'View Full'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy} className="text-xs tracking-tight">
            {copyFeedback ? <FiCheck className="w-3 h-3 mr-1" /> : <FiCopy className="w-3 h-3 mr-1" />}
            {copyFeedback ? 'Copied' : 'Copy Reply'}
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="text-xs tracking-tight text-destructive hover:bg-destructive hover:text-destructive-foreground">
            <FiTrash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// --- Main Page Component ---
export default function Page() {
  // Navigation
  const [activeView, setActiveView] = useState<'composer' | 'history'>('composer')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Sample data toggle
  const [showSample, setShowSample] = useState(false)

  // Composer form state
  const [originalEmail, setOriginalEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [designation, setDesignation] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [tone, setTone] = useState('Formal')
  const [length, setLength] = useState('Medium')
  const [contextNotes, setContextNotes] = useState('')
  const [contextOpen, setContextOpen] = useState(false)

  // Agent state
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [agentResponse, setAgentResponse] = useState<EmailResponse | null>(null)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Output editing
  const [editableBody, setEditableBody] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Copy feedback
  const [copyFeedback, setCopyFeedback] = useState(false)

  // History
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  // Populate/clear sample data
  useEffect(() => {
    if (showSample) {
      setOriginalEmail(SAMPLE_EMAIL)
      setSenderName('Michael Chen')
      setDesignation('Customer')
      setCompanyName('Tech Gadgets Inc.')
      setTone('Formal')
      setLength('Detailed')
      setContextNotes('Customer has been loyal for 3 years. Prioritize retention.')
      setAgentResponse(SAMPLE_RESPONSE)
      setEditableBody(SAMPLE_RESPONSE.body ?? '')
    } else {
      setOriginalEmail('')
      setSenderName('')
      setDesignation('')
      setCompanyName('')
      setTone('Formal')
      setLength('Medium')
      setContextNotes('')
      setAgentResponse(null)
      setEditableBody('')
      setErrorMsg('')
    }
  }, [showSample])

  // Sync editable body when response changes
  useEffect(() => {
    if (agentResponse?.body) {
      setEditableBody(agentResponse.body)
    }
  }, [agentResponse])

  // Generate reply
  const handleGenerate = useCallback(async () => {
    if (!originalEmail.trim()) {
      setErrorMsg('Please paste an email to generate a reply.')
      return
    }
    setLoading(true)
    setErrorMsg('')
    setAgentResponse(null)
    setActiveAgentId(AGENT_ID)

    const message = `Original Email:\n${originalEmail}\n\nSender Details:\n- Name: ${senderName || 'Not provided'}\n- Designation: ${designation || 'Not provided'}\n- Company: ${companyName || 'Not provided'}\n\nReply Preferences:\n- Tone: ${tone}\n- Length: ${length}\n\n${contextNotes ? `Additional Context: ${contextNotes}` : ''}`

    try {
      const result = await callAIAgent(message, AGENT_ID)
      setActiveAgentId(null)

      if (result.success) {
        const data = extractAgentData(result)
        if (data) {
          setAgentResponse(data)
          // Save to history
          const entry: HistoryEntry = {
            id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
            timestamp: new Date().toISOString(),
            originalEmail,
            senderName,
            designation,
            companyName,
            tone,
            length,
            contextNotes,
            response: data
          }
          const updated = [entry, ...history]
          setHistory(updated)
          saveHistory(updated)
        } else {
          setErrorMsg('Could not parse the agent response. Please try again.')
        }
      } else {
        setErrorMsg(result.error ?? 'Failed to generate reply. Please try again.')
      }
    } catch (err) {
      setErrorMsg('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
      setActiveAgentId(null)
    }
  }, [originalEmail, senderName, designation, companyName, tone, length, contextNotes, history])

  // Copy full reply
  const handleCopyReply = useCallback(async () => {
    const resp = agentResponse
    if (!resp) return
    const fullReply = [
      resp.subject_line ? `Subject: ${resp.subject_line}` : '',
      '',
      resp.greeting ?? '',
      '',
      isEditing ? editableBody : (resp.body ?? ''),
      '',
      resp.closing ?? '',
      '',
      resp.signature_placeholder ?? ''
    ].filter((line, i) => i === 0 ? !!line : true).join('\n').trim()

    const success = await copyToClipboard(fullReply)
    if (success) {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    }
  }, [agentResponse, isEditing, editableBody])

  // Clear all
  const handleClearAll = useCallback(() => {
    setOriginalEmail('')
    setSenderName('')
    setDesignation('')
    setCompanyName('')
    setTone('Formal')
    setLength('Medium')
    setContextNotes('')
    setAgentResponse(null)
    setEditableBody('')
    setErrorMsg('')
    setIsEditing(false)
    setShowSample(false)
  }, [])

  // Delete history entry
  const handleDeleteHistory = useCallback((id: string) => {
    const updated = history.filter((e) => e.id !== id)
    setHistory(updated)
    saveHistory(updated)
  }, [history])

  // Filter history
  const filteredHistory = history.filter((entry) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (entry.originalEmail?.toLowerCase()?.includes(q)) ||
      (entry.response?.subject_line?.toLowerCase()?.includes(q)) ||
      (entry.response?.detected_intent?.toLowerCase()?.includes(q))
    )
  })

  // Build full reply text for display
  const fullReplyText = agentResponse ? [
    agentResponse.greeting ?? '',
    '',
    isEditing ? editableBody : (agentResponse.body ?? ''),
    '',
    agentResponse.closing ?? '',
    '',
    agentResponse.signature_placeholder ?? ''
  ].join('\n') : ''

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? 'w-60' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-border bg-card flex flex-col shrink-0`}>
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-primary flex items-center justify-center">
                <FiMail className="w-4 h-4 text-primary-foreground" />
              </div>
              <div>
                <h1 className="font-serif text-lg font-bold tracking-tight leading-none">EchoAI</h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">Email Composer</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            <button
              onClick={() => setActiveView('composer')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium tracking-tight transition-colors ${activeView === 'composer' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
            >
              <FiEdit3 className="w-4 h-4" />
              Composer
            </button>
            <button
              onClick={() => setActiveView('history')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium tracking-tight transition-colors ${activeView === 'history' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
            >
              <FiClock className="w-4 h-4" />
              Reply History
              {history.length > 0 && (
                <span className="ml-auto text-xs bg-muted text-muted-foreground px-1.5 py-0.5">{history.length}</span>
              )}
            </button>
          </nav>

          {/* Agent Info */}
          <div className="p-4 border-t border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2">Agent Status</p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 ${activeAgentId ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-xs tracking-tight text-muted-foreground">
                {activeAgentId ? 'Processing...' : 'Ready'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 tracking-tight">Email Response Agent</p>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 border-b border-border flex items-center justify-between px-5 bg-card shrink-0">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-muted transition-colors">
                <FiMenu className="w-4 h-4" />
              </button>
              <h2 className="font-serif text-base font-bold tracking-tight">
                {activeView === 'composer' ? 'Email Composer' : 'Reply History'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground tracking-tight cursor-pointer flex items-center gap-2">
                Sample Data
                <Switch
                  checked={showSample}
                  onCheckedChange={setShowSample}
                />
              </label>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-hidden">
            {activeView === 'composer' ? (
              <div className="h-full flex flex-col lg:flex-row">
                {/* Left Column - Input Form */}
                <ScrollArea className="lg:w-[45%] border-r border-border">
                  <div className="p-6 lg:p-8 space-y-6">
                    {/* Original Email */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FiMail className="w-3 h-3" />
                        Original Email
                      </label>
                      <Textarea
                        placeholder="Paste the incoming email here..."
                        value={originalEmail}
                        onChange={(e) => setOriginalEmail(e.target.value)}
                        className="min-h-[220px] text-sm leading-relaxed tracking-tight resize-none border-border bg-card"
                      />
                    </div>

                    <Separator />

                    {/* Sender Details */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sender Details</label>
                      <div className="grid grid-cols-3 gap-3">
                        <Input
                          placeholder="Sender Name"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          className="text-sm tracking-tight border-border bg-card"
                        />
                        <Input
                          placeholder="Designation"
                          value={designation}
                          onChange={(e) => setDesignation(e.target.value)}
                          className="text-sm tracking-tight border-border bg-card"
                        />
                        <Input
                          placeholder="Company Name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          className="text-sm tracking-tight border-border bg-card"
                        />
                      </div>
                    </div>

                    <Separator />

                    {/* Tone Selector */}
                    <SegmentedToggle
                      label="Tone"
                      options={['Formal', 'Casual', 'Firm']}
                      value={tone}
                      onChange={setTone}
                    />

                    {/* Length Selector */}
                    <SegmentedToggle
                      label="Length"
                      options={['Short', 'Medium', 'Detailed']}
                      value={length}
                      onChange={setLength}
                    />

                    <Separator />

                    {/* Context Notes (Collapsible) */}
                    <Collapsible open={contextOpen} onOpenChange={setContextOpen}>
                      <CollapsibleTrigger className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors w-full">
                        {contextOpen ? <FiChevronDown className="w-3 h-3" /> : <FiChevronRight className="w-3 h-3" />}
                        Additional Context Notes (Optional)
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <Textarea
                          placeholder="Add any context, instructions, or special considerations for the reply..."
                          value={contextNotes}
                          onChange={(e) => setContextNotes(e.target.value)}
                          className="min-h-[100px] text-sm leading-relaxed tracking-tight resize-none border-border bg-card"
                        />
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Generate Button */}
                    <Button
                      onClick={handleGenerate}
                      disabled={loading || !originalEmail.trim()}
                      className="w-full h-12 text-sm font-medium tracking-tight"
                    >
                      {loading ? (
                        <>
                          <FiLoader className="w-4 h-4 mr-2 animate-spin" />
                          Generating Reply...
                        </>
                      ) : (
                        <>
                          <FiSend className="w-4 h-4 mr-2" />
                          Generate Reply
                        </>
                      )}
                    </Button>

                    {/* Error Message */}
                    {errorMsg && (
                      <div className="flex items-start gap-2 p-3 border border-destructive bg-destructive/5 text-sm tracking-tight">
                        <FiAlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-destructive">{errorMsg}</p>
                          <button onClick={handleGenerate} className="text-xs underline text-destructive mt-1 hover:no-underline">
                            Retry
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Right Column - Output Panel */}
                <ScrollArea className="lg:w-[55%] flex-1">
                  <div className="p-6 lg:p-8">
                    {loading && !agentResponse ? (
                      <div className="flex flex-col items-center justify-center py-24 space-y-4">
                        <div className="w-10 h-10 border-2 border-primary border-t-transparent animate-spin" />
                        <p className="text-sm text-muted-foreground tracking-tight">Analyzing email and crafting reply...</p>
                      </div>
                    ) : agentResponse ? (
                      <div className="space-y-6">
                        {/* Sensitivity Warning */}
                        {agentResponse.is_sensitive && (
                          <div className="flex items-start gap-3 p-4 border border-destructive bg-destructive/5">
                            <FiAlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium tracking-tight text-destructive">Sensitive Content Detected</p>
                              <p className="text-xs text-muted-foreground tracking-tight mt-1">
                                This email may contain sensitive or legal content. Review carefully before using.
                                {agentResponse.sensitivity_reason ? ` Reason: ${agentResponse.sensitivity_reason}` : ''}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Intent & Confidence Row */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-2">
                            {agentResponse.detected_intent && (
                              <Badge variant="default" className="text-xs uppercase tracking-wider font-medium px-3 py-1">
                                {agentResponse.detected_intent}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground tracking-tight">Detected Intent</span>
                          </div>
                          <div className="w-40">
                            <ConfidenceBar score={agentResponse.confidence_score ?? 0} />
                          </div>
                        </div>

                        <Separator />

                        {/* Subject Line */}
                        {agentResponse.subject_line && (
                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Subject Line</label>
                            <p className="text-base font-serif font-bold tracking-tight">{agentResponse.subject_line}</p>
                          </div>
                        )}

                        <Separator />

                        {/* Email Body */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Generated Reply</label>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setIsEditing(!isEditing)}
                              className="text-xs tracking-tight"
                            >
                              <FiEdit3 className="w-3 h-3 mr-1" />
                              {isEditing ? 'Preview' : 'Edit'}
                            </Button>
                          </div>

                          <Card className="border border-border shadow-none">
                            <CardContent className="p-5 space-y-3">
                              {/* Greeting */}
                              {agentResponse.greeting && (
                                <p className="text-sm tracking-tight font-medium">{agentResponse.greeting}</p>
                              )}

                              {/* Body */}
                              {isEditing ? (
                                <Textarea
                                  value={editableBody}
                                  onChange={(e) => setEditableBody(e.target.value)}
                                  className="min-h-[250px] text-sm leading-relaxed tracking-tight resize-none border-border"
                                />
                              ) : (
                                <div className="text-sm leading-relaxed tracking-tight">
                                  {renderMarkdown(isEditing ? editableBody : (agentResponse.body ?? ''))}
                                </div>
                              )}

                              {/* Closing */}
                              {agentResponse.closing && (
                                <p className="text-sm tracking-tight mt-3">{agentResponse.closing}</p>
                              )}

                              {/* Signature */}
                              {agentResponse.signature_placeholder && (
                                <p className="text-sm text-muted-foreground tracking-tight whitespace-pre-wrap mt-2 border-t border-border pt-3">
                                  {agentResponse.signature_placeholder}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Action Bar */}
                        <div className="flex items-center gap-3 pt-2">
                          <Button onClick={handleCopyReply} className="text-sm tracking-tight">
                            {copyFeedback ? (
                              <>
                                <FiCheck className="w-4 h-4 mr-2" />
                                Copied to Clipboard
                              </>
                            ) : (
                              <>
                                <FiCopy className="w-4 h-4 mr-2" />
                                Copy to Clipboard
                              </>
                            )}
                          </Button>
                          <Button variant="outline" onClick={handleGenerate} disabled={loading} className="text-sm tracking-tight">
                            <FiRefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Regenerate
                          </Button>
                          <Button variant="outline" onClick={handleClearAll} className="text-sm tracking-tight">
                            <FiX className="w-4 h-4 mr-2" />
                            Clear All
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Empty State */
                      <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                        <div className="w-16 h-16 border border-border flex items-center justify-center bg-muted">
                          <FiFileText className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-serif text-lg font-bold tracking-tight mb-1">No Reply Generated Yet</h3>
                          <p className="text-sm text-muted-foreground tracking-tight max-w-sm">
                            Paste an incoming email on the left, configure your preferences, and click Generate Reply to get started.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground tracking-tight">
                          Or toggle Sample Data in the header to see a demo.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            ) : (
              /* History View */
              <ScrollArea className="h-full">
                <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
                  {/* Search Bar */}
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by subject, intent, or email content..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 text-sm tracking-tight border-border bg-card"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted transition-colors"
                      >
                        <FiX className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>

                  {/* History List */}
                  {filteredHistory.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground tracking-wider uppercase">
                        {filteredHistory.length} {filteredHistory.length === 1 ? 'reply' : 'replies'}
                        {searchQuery ? ' found' : ' in history'}
                      </p>
                      {filteredHistory.map((entry) => (
                        <HistoryCard
                          key={entry.id}
                          entry={entry}
                          onCopy={() => {}}
                          onDelete={() => handleDeleteHistory(entry.id)}
                          onExpand={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}
                          isExpanded={expandedHistoryId === entry.id}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
                      <div className="w-16 h-16 border border-border flex items-center justify-center bg-muted">
                        <FiClock className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-serif text-lg font-bold tracking-tight mb-1">
                          {searchQuery ? 'No Matches Found' : 'No Replies Generated Yet'}
                        </h3>
                        <p className="text-sm text-muted-foreground tracking-tight max-w-sm">
                          {searchQuery
                            ? 'Try adjusting your search query.'
                            : 'Start composing your first email reply to see it here.'}
                        </p>
                      </div>
                      {!searchQuery && (
                        <Button variant="outline" onClick={() => setActiveView('composer')} className="text-sm tracking-tight">
                          <FiEdit3 className="w-4 h-4 mr-2" />
                          Go to Composer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  )
}
