import React, { createContext, useContext, useState, useEffect, useMemo, Component, type ErrorInfo, type ReactNode } from 'react';
import { 
  BrainCircuit, Zap, ChevronRight, CloudSun, Send,
  Clock, Target, Play, HardDrive, ListTodo, Pause, RotateCcw,
  GraduationCap, Globe, Search, Volume2, Sparkles, Loader2, 
  Calendar, Trash2, AlertTriangle, Mail, FileText, Table2, 
  StickyNote, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ============================================================================
// [CORE: UTILS & SECURITY]
// ============================================================================
function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface ErrorBoundaryProps { children: ReactNode; moduleName: string; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState { return { hasError: true, error }; }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error(`[KERNEL PANIC] ${this.props.moduleName}:`, error, errorInfo); }
  render() {
    if (this.state.hasError) return (
      <div className="w-full h-full min-h-[100px] flex flex-col items-center justify-center p-4 bg-red-950/20 border border-red-900/50 rounded-2xl backdrop-blur-sm">
        <AlertTriangle size={24} className="text-red-600 mb-2 animate-pulse" />
        <span className="text-[10px] font-mono font-bold text-red-500 uppercase tracking-widest text-center">[QUARANTINED]<br/>{this.props.moduleName}</span>
      </div>
    );
    return this.props.children;
  }
}

// ============================================================================
// [CORE: CONTEXT & TOKENS] 
// ============================================================================
const SentinelContext = createContext<any>(undefined);
const useSentinel = () => useContext(SentinelContext);

const TOKENS = {
  bgObsidian: "bg-[#161412]",
  textHermesOrange: "#D95319",
  borderSaddle: "border-2 border-dashed border-[#C5A059]/30"
};

// ============================================================================
// [CORE: API & WAV COMPILER] - IMMUTABLE FORCE
// ============================================================================
const apiKey = ""; 

const invokeGemini = async (prompt: string, systemInstruction: string): Promise<string> => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  let lastError;
  for (let i = 0; i < 5; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], systemInstruction: { parts: [{ text: systemInstruction }] } })
      });
      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "[SENTINEL]: Phản hồi trống.";
    } catch (error) { lastError = error; await sleep(Math.pow(2, i) * 1000); }
  }
  throw lastError;
};

// Lệnh Force: Trình biên dịch WAV hạt nhân. Không có cái này, trình duyệt câm lặng.
const compileWav = (base64Pcm: string, sampleRate = 24000) => {
  const binaryString = atob(base64Pcm);
  const pcmData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) pcmData[i] = binaryString.charCodeAt(i);

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => { for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i)); };

  writeString(0, 'RIFF'); view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, 'WAVE'); writeString(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true); view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data'); view.setUint32(40, pcmData.length, true);
  new Uint8Array(buffer, 44).set(pcmData);

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};

const speakBriefing = async (text: string) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Say in a sharp, professional military tone: ${text}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } } } },
        model: "gemini-2.5-flash-preview-tts"
      })
    });
    const data = await response.json();
    const pcmData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (pcmData) {
      const audioUrl = compileWav(pcmData);
      new Audio(audioUrl).play();
    }
  } catch (error) { console.error("TTS Error:", error); }
};

// ============================================================================
// [COMPONENTS: DEEP WORK TIMER] - TÁCH RỜI ĐỂ CHỐNG RÒ RỈ RENDER
// ============================================================================
const DeepWorkTimer = () => {
  const { setFatigueLevel } = useSentinel();
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isTimerActive, setIsTimerActive] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isTimerActive) {
      interval = setInterval(() => {
        setPomodoroTime(p => {
          if (p <= 1) {
            setIsTimerActive(false);
            setFatigueLevel((f: number) => Math.min(f + 15, 100));
            return 0;
          }
          return p - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, setFatigueLevel]);

  const formatTimer = (seconds: number) => { 
    const m = Math.floor(seconds / 60); 
    const s = seconds % 60; 
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; 
  };

  return (
    <div className="bg-[#161412] rounded-[30px] border border-stone-800 p-6 flex flex-col justify-between items-center relative overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] h-64">
      <div className="z-10 w-full text-center">
        <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.3em] text-orange-500 mb-1 block">Deep Work Protocol</span>
        <span className="text-[8px] md:text-[9px] font-mono text-white/40 tracking-widest block">SPACED & INTERLEAVED</span>
      </div>
      <div className="z-10 text-6xl md:text-7xl font-black text-white tracking-tighter font-mono tabular-nums drop-shadow-2xl">{formatTimer(pomodoroTime)}</div>
      <div className="z-10 flex gap-3 w-full justify-center">
        <button onClick={() => setIsTimerActive(!isTimerActive)} className={cn("px-6 py-2.5 rounded-full text-[10px] md:text-[11px] font-bold tracking-widest uppercase shadow-xl transition-all flex items-center gap-2", isTimerActive ? "bg-white text-stone-900 hover:bg-stone-200" : "bg-orange-600 text-white hover:bg-orange-700")}>
          {isTimerActive ? <><Pause size={14}/> Pause</> : <><Play size={14}/> Engage</>}
        </button>
        <button onClick={() => { setIsTimerActive(false); setPomodoroTime(25 * 60); }} className="w-10 h-10 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-white/10 text-white/50 hover:bg-white/20 hover:text-white transition-colors border border-white/5"><RotateCcw size={14} /></button>
      </div>
      <Clock size={120} className={cn("absolute right-[-20px] bottom-[-20px] pointer-events-none transition-all duration-1000", isTimerActive ? "text-orange-600 opacity-10 animate-[spin_10s_linear_infinite]" : "text-stone-800 opacity-20")} />
    </div>
  );
};

// ============================================================================
// [COMPONENTS: DYNAMIC ISLAND]
// ============================================================================
const DynamicIslandCore = () => {
  const { fatigueLevel, activeMode, isProcessing, notes } = useSentinel();
  const [isExpanded, setIsExpanded] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const priorityNote = useMemo(() => notes[0] || null, [notes]);

  useEffect(() => { setIsExpanded(false); }, [activeMode]);
  useEffect(() => {
    if (isExpanded) return;
    const carouselTimer = setInterval(() => { setCarouselIndex(prev => (prev + 1) % 2); }, 4000); 
    return () => clearInterval(carouselTimer);
  }, [isExpanded]);

  const getTacticalInsight = async () => {
    if (!priorityNote) return;
    setLoading(true);
    try {
      const res = await invokeGemini(`Dựa trên note này: "${priorityNote.content}", đưa ra 3 lời khuyên ngắn gọn.`, "You are [SENTINEL]. Respond in Vietnamese, elite professional style.");
      setInsight(res);
    } catch (e) { setInsight("Kernel Error."); } finally { setLoading(false); }
  };

  const carouselItems = [
    { label: 'Hà Nội • 22°C', icon: <CloudSun size={14} className="text-orange-500" /> },
    { label: priorityNote ? `Note: ${priorityNote.content.slice(0, 15)}...` : 'No Active Directive', icon: <Send size={14} className="text-orange-500" /> }
  ];

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-[150] flex flex-col items-center pointer-events-none w-full">
      <motion.div 
        layout onClick={() => setIsExpanded(!isExpanded)} whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
        className={cn(
          "pointer-events-auto relative cursor-pointer overflow-hidden",
          "bg-black shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] border-x border-b border-white/[0.1]",
          isExpanded ? "w-[94vw] md:w-[540px] h-[380px] md:h-[340px] rounded-b-[48px] rounded-t-none" : "w-[210px] md:w-[260px] h-[34px] md:h-[36px] rounded-b-[20px] rounded-t-none"
        )}
      >
        <AnimatePresence mode="popLayout">
          {!isExpanded ? (
            <motion.div key="collapsed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 px-4 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div key={carouselIndex} initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -15, opacity: 0 }} transition={{ duration: 0.4, ease: "circOut" }} className="flex items-center justify-center gap-2.5 h-full">
                  {isProcessing || loading ? <Zap size={14} className="text-orange-500 animate-pulse" /> : carouselItems[carouselIndex].icon}
                  <span className="text-[10px] md:text-[11px] font-bold text-white/90 uppercase tracking-[0.15em] whitespace-nowrap leading-none mt-[1px]">{carouselItems[carouselIndex].label}</span>
                </motion.div>
              </AnimatePresence>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center"><div className="w-1.5 h-1.5 rounded-full bg-[#D95319] animate-pulse shadow-[0_0_8px_rgba(217,83,25,0.8)]" /></div>
            </motion.div>
          ) : (
            <motion.div key="expanded" initial={{ opacity: 0, filter: "blur(12px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.4 }} className="absolute inset-0 flex flex-col p-8 md:p-10 box-border">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-orange-600/10 flex items-center justify-center border border-orange-600/20 shadow-inner"><CloudSun size={18} className="text-orange-500" /></div>
                  <div>
                    <h4 className="text-xl md:text-3xl font-bold text-white tracking-tighter lowercase leading-none">{activeMode}</h4>
                    <p className="text-[8px] md:text-[9px] text-orange-500 uppercase tracking-widest mt-1 font-black">Hà Nội • UTC+7</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-4 md:gap-8 py-2">
                <div>
                  <span className="text-[8px] md:text-[9px] font-black text-white/30 uppercase tracking-[0.4em] mb-2 block">Sentinel Directive</span>
                  <p className="text-[15px] md:text-[18px] text-white/95 font-medium leading-tight tracking-tight line-clamp-2">{priorityNote ? priorityNote.content : "Awaiting strategic input via Hub..."}</p>
                </div>
                <div className="h-px w-12 bg-white/10"></div>
                <div className="flex flex-col gap-3 min-h-[50px]">
                  <button onClick={(e) => { e.stopPropagation(); getTacticalInsight(); }} className="flex items-center gap-2 w-fit group">
                    <Sparkles size={14} className="text-orange-400 group-hover:rotate-12 transition-transform" />
                    <span className="text-[9px] font-bold text-orange-400/60 uppercase tracking-[0.3em]">AI Synthesis</span>
                  </button>
                  <p className="text-[12px] md:text-[13px] text-white/70 leading-relaxed font-medium line-clamp-3">
                    {loading ? "Distilling insights..." : insight || "Awaiting analysis of payload."}
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center mt-auto pt-4 md:pt-6 border-t border-white/5">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-white/90 font-mono">{fatigueLevel}%</span>
                  <div className="w-20 md:w-24 h-1 bg-white/10 rounded-full overflow-hidden border border-white/5">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${fatigueLevel}%` }} className="h-full bg-orange-600 shadow-[0_0_10px_rgba(217,83,25,0.4)]" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); speakBriefing(priorityNote?.content || ""); }} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full bg-white/[0.08] text-white border border-white/10 shadow-xl"><Volume2 size={18}/></button>
                  <button className="px-6 md:px-8 h-9 md:h-11 rounded-full bg-orange-600 text-white text-[9px] md:text-[11px] font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all">Sync</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
const DynamicIsland = () => <ErrorBoundary moduleName="DYNAMIC_ISLAND"><DynamicIslandCore /></ErrorBoundary>;

// ============================================================================
// [BOOT SCREEN] 
// ============================================================================
const BootScreen = ({ onUnlock }: { onUnlock: () => void }) => {
  const { tasks = [], notes = [] } = useSentinel() || {};
  const [time, setTime] = useState(new Date());
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState(false);

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "starlinetouren") { onUnlock(); } 
    else { setAuthError(true); setTimeout(() => setAuthError(false), 500); setPassword(""); }
  };

  const formattedDate = time.toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });
  const pendingTasks = tasks.filter((t: any) => !t.done).length;
  const priorityNote = notes[0]?.content || "No intel available.";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[500] bg-[#050505] flex flex-col items-center justify-between py-6 md:py-8 px-4 md:px-6 overflow-y-auto custom-scrollbar">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[60%] h-[60%] bg-[#D95319]/10 blur-[150px] rounded-full mix-blend-screen animate-[pulse_8s_ease-in-out_infinite]" />
        <div className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] bg-[#A67C52]/10 blur-[120px] rounded-full mix-blend-screen animate-[pulse_10s_ease-in-out_infinite_reverse]" />
      </div>

      <div className="w-full flex justify-between items-center text-white relative z-10 shrink-0">
        <div className="relative group">
          <button className="text-[10px] font-bold tracking-widest uppercase border border-white/10 px-4 py-2 rounded-full bg-white/5 backdrop-blur-md text-stone-300 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-2">
            <span className="text-[12px] font-black italic">T</span> KNOX SECURED
          </button>
        </div>
        <div className="flex items-center gap-3 px-3 md:px-4 py-1.5 bg-white/5 backdrop-blur-md rounded-full border border-white/10 text-[8px] md:text-[9px] font-mono text-emerald-500 uppercase tracking-widest shadow-sm">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Network Uplink Active
        </div>
      </div>

      <div className="flex flex-col items-center text-center mt-8 md:mt-12 relative z-10 shrink-0">
        <span className="text-white/60 font-medium tracking-widest text-xs md:text-sm mb-2">{formattedDate}</span>
        <h1 className="text-7xl md:text-[180px] font-light text-white tracking-tighter leading-none drop-shadow-2xl">{time.toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5)}</h1>
      </div>

      <div className="w-full max-w-3xl mt-10 md:mt-12 relative z-10 flex overflow-x-auto gap-4 md:gap-5 px-2 pb-4 custom-scrollbar snap-x shrink-0 no-scrollbar">
        <div className="min-w-[180px] md:min-w-[200px] h-24 md:h-28 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] md:rounded-[32px] p-4 md:p-5 flex flex-col justify-between snap-center shadow-lg">
          <div className="flex items-center gap-2 text-white/50"><ListTodo size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Tasks</span></div>
          <div><span className="text-2xl md:text-3xl font-bold text-white">{pendingTasks}</span><span className="text-xs text-white/40 ml-2">pending</span></div>
        </div>
        <div className="min-w-[220px] md:min-w-[260px] h-24 md:h-28 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] md:rounded-[32px] p-4 md:p-5 flex flex-col justify-between snap-center shadow-lg">
           <div className="flex items-center justify-between text-white/50"><div className="flex items-center gap-2"><Send size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Priority Intel</span></div></div>
           <p className="text-xs md:text-sm font-medium text-white/90 truncate">{priorityNote}</p>
        </div>
        <div className="min-w-[200px] h-24 md:h-28 bg-white/[0.03] backdrop-blur-2xl border border-white/10 rounded-[28px] md:rounded-[32px] p-4 md:p-5 flex flex-col justify-between snap-center shadow-lg">
          <div className="flex items-center gap-2 text-white/50"><Globe size={14} /><span className="text-[10px] font-bold uppercase tracking-widest">Global Ops</span></div>
          <p className="text-[10px] md:text-xs font-medium text-white/70 leading-relaxed truncate">Translating raw data to impact.</p>
        </div>
      </div>

      <div className="mt-12 md:mt-24 flex flex-col items-center relative z-10 mb-8 md:mb-12 w-full max-w-sm px-4 md:px-6 shrink-0">
        <motion.div animate={authError ? { x: [-10, 10, -10, 10, 0] } : {}} transition={{ duration: 0.4 }} className="w-full">
          <form onSubmit={handleLogin} className="w-full">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="ENTER OVERRIDE KEY" className="w-full bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl py-4 md:py-5 text-center text-white placeholder:text-white/20 outline-none focus:bg-white/10 transition-all text-xs md:text-sm tracking-[0.3em] shadow-2xl" autoFocus />
          </form>
        </motion.div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// [COMPONENTS: MENU BAR]
// ============================================================================
const MenuBarCore = () => {
  const { activeMode, setActiveMode, setIsLocked } = useSentinel();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => { const timer = setInterval(() => setCurrentDate(new Date()), 1000); return () => clearInterval(timer); }, []);

  const navItems = [
    { id: 'HEGEMONY', label: 'Hub' },
    { id: 'LIBRARY', label: 'Intel' },
    { id: 'PRUNER', label: 'Pruner' },
    { id: 'BAYESIAN', label: 'Markov' }
  ];

  return (
    <nav className="fixed top-0 w-full h-10 flex items-center justify-between px-5 z-[140] bg-white/30 backdrop-blur-2xl border-b border-white/20 shadow-sm">
      <div className="flex items-center gap-1 md:gap-2 justify-start">
        <div className="relative group py-1">
          <div className="flex items-center px-1 cursor-pointer shrink-0">
            <div className="w-5 h-5 bg-stone-900 rounded-md flex items-center justify-center shadow-sm group-hover:bg-orange-600 transition-colors">
              <span className="text-[12px] text-white font-bold italic">T</span>
            </div>
          </div>
          <div className="absolute top-full left-0 mt-1 w-48 bg-white/95 backdrop-blur-3xl border border-stone-200/50 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 origin-top-left flex flex-col p-1.5 z-[200]">
            <button onClick={() => setActiveMode('HOME')} className="text-[12px] font-medium text-stone-700 hover:text-stone-900 hover:bg-black/5 w-full text-left px-3 py-2.5 rounded-xl transition-colors">Menu</button>
            <div className="h-px w-full bg-stone-200/50 my-1"></div>
            <button onClick={() => setIsLocked(true)} className="text-[12px] font-medium text-red-600 hover:text-red-700 hover:bg-red-50 w-full text-left px-3 py-2.5 rounded-xl transition-colors">Lock System</button>
          </div>
        </div>
        <div className="flex items-center gap-1 pl-2 border-l border-stone-300 ml-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveMode(item.id)} className={cn("hover:bg-black/5 px-3 py-1.5 rounded-lg transition-colors text-[13px] font-medium relative tracking-wide", activeMode === item.id ? "text-orange-700 bg-orange-100/50" : "text-stone-700")}>{item.label}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 text-stone-600 justify-end pr-2 font-bold">
        <div className="hidden sm:flex gap-3 items-center"><Search size={15} /></div>
        <span className="text-[11px] md:text-[13px] tracking-wide text-stone-800 ml-1">{currentDate.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' }).replace(/,/g, '')} <span className="ml-1">{currentDate.toLocaleTimeString('en-GB', { hour12: false }).slice(0, 5)}</span></span>
      </div>
    </nav>
  );
};
const MenuBar = () => <ErrorBoundary moduleName="MENU_BAR"><MenuBarCore /></ErrorBoundary>;

// ============================================================================
// [COMPONENTS: DOCK]
// ============================================================================
const DockCore = () => {
  const { activeMode } = useSentinel();
  
  const googleApps = [
    { t: 'Gmail', i: Mail, color: 'text-[#EA4335]', url: 'https://mail.google.com' },
    { t: 'Drive', i: HardDrive, color: 'text-[#34A853]', url: 'https://drive.google.com' }, 
    { t: 'Calendar', i: Calendar, color: 'text-[#4285F4]', url: 'https://calendar.google.com' },
    { t: 'Docs', i: FileText, color: 'text-[#4285F4]', url: 'https://docs.google.com' },
    { t: 'Sheets', i: Table2, color: 'text-[#0F9D58]', url: 'https://sheets.google.com' },
    { t: 'Keep', i: StickyNote, color: 'text-[#FBBC04]', url: 'https://keep.google.com' },
    { t: 'Tasks', i: ListTodo, color: 'text-[#4285F4]', url: 'https://calendar.google.com/calendar/u/0/r/tasks' },
    { t: 'Scholar', i: GraduationCap, color: 'text-[#4D90FE]', url: 'https://scholar.google.com' },
    { t: 'NotebookLM', i: BrainCircuit, color: 'text-[#8E24AA]', url: 'https://notebooklm.google.com' } 
  ];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-full px-2 md:w-auto pointer-events-none">
      <AnimatePresence>
        {activeMode === 'HOME' && (
          <motion.div 
            initial={{ y: 120, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 120, opacity: 0, scale: 0.9 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} 
            className="pointer-events-auto flex items-end justify-center md:justify-start gap-2 md:gap-3 px-4 md:px-5 py-3 md:py-3.5 rounded-[28px] bg-white/30 backdrop-blur-2xl border border-white/20 shadow-2xl origin-bottom w-max max-w-[96vw] mx-auto"
          >
            {googleApps.map((app, idx) => {
              const Icon = app.i;
              return (
                <motion.a 
                  href={app.url} target="_blank" rel="noopener noreferrer"
                  key={idx} whileHover={{ scale: 1.4, y: -12 }} whileTap={{ scale: 0.9 }} 
                  className="w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center cursor-pointer border border-stone-100 group shrink-0 relative"
                  title={app.t}
                >
                  <Icon className={cn("!w-5 !h-5 md:!w-[26px] md:!h-[26px] transition-colors", app.color)} />
                </motion.a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
const Dock = () => <ErrorBoundary moduleName="DOCK"><DockCore /></ErrorBoundary>;

// ============================================================================
// [MODULE: BAYESIAN MARKOV ENGINE]
// ============================================================================
const BayesianMarkovCore = () => {
  const { fatigueLevel, notes, tasks, addNote } = useSentinel();
  const [simResult, setSimResult] = useState("");
  const [loading, setLoading] = useState(false);

  const simulate = async () => {
    setLoading(true);
    const p = `Hệ thống hiện tại: Fatigue=${fatigueLevel}%, Nhiệm vụ chưa xong=${tasks.filter((t:any)=>!t.done).length}, Ghi chú=${notes.length}. Áp dụng phương trình Bellman và thuyết điều khiển học (Cybernetics), đánh giá xác suất sụp đổ (Meltdown) hoặc thành công dài hạn. Không dài dòng. Dùng ngôn ngữ tác chiến sắc bén, tàn nhẫn (Candid, Rigorous).`;
    try {
      const res = await invokeGemini(p, "You are [BAYESIAN MARKOV ENGINE]. Execute brutal risk assessment.");
      setSimResult(res);
    } catch(e) { setSimResult("[KERNEL PANIC] - Predictive Engine Offline."); }
    setLoading(false);
  };

  return (
    <div className="p-4 md:p-12 pb-32 md:pb-48 flex flex-col lg:grid lg:grid-cols-2 gap-6 md:gap-10 h-full overflow-y-auto custom-scrollbar">
       <div className="flex flex-col gap-6">
          <motion.h2 className="text-4xl md:text-7xl font-bold text-stone-100 tracking-tighter lowercase leading-none pl-2 drop-shadow-md">bayesian</motion.h2>
          <div className="bg-stone-900 border border-stone-800 rounded-[30px] md:rounded-[40px] p-6 md:p-10 shadow-2xl relative overflow-hidden flex flex-col min-h-[320px]">
             <h3 className="text-xl font-bold text-white tracking-widest uppercase mb-6 text-[12px] opacity-50">Markov State Matrix</h3>
             <div className="flex-1 flex justify-center items-center font-mono text-orange-500 text-sm md:text-base opacity-80 mb-6 border border-dashed border-orange-500/20 rounded-xl bg-orange-500/5">
                <div className="text-center p-4">
                  <p>V(s) = max_a ( R(s,a) + γ Σ P(s'|s,a) V(s') )</p>
                  <p className="text-[10px] md:text-[11px] mt-4 opacity-50 uppercase tracking-widest text-stone-400">Long-term Reward Optimization</p>
                </div>
             </div>
             <div className="flex justify-between items-center text-white/80 font-mono text-[10px] md:text-[12px]">
                <span>F(t) = {fatigueLevel}%</span>
                <span className={fatigueLevel > 80 ? "text-red-500 animate-pulse font-bold" : "text-emerald-500"}>Risk Vector: {fatigueLevel > 80 ? 'CRITICAL' : 'STABLE'}</span>
             </div>
          </div>
          <button onClick={simulate} disabled={loading} className="py-4 md:py-5 rounded-full bg-orange-600 text-white font-bold uppercase tracking-widest text-[11px] md:text-[12px] shadow-[0_0_20px_rgba(217,83,25,0.4)] hover:bg-orange-500 transition-colors flex justify-center items-center gap-2 shrink-0">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <BrainCircuit size={18} />} Run Simulation
          </button>
       </div>
       <div className="bg-white/95 backdrop-blur-2xl border-2 border-dashed border-[#C5A059]/30 rounded-[30px] md:rounded-[40px] p-6 md:p-10 shadow-2xl flex flex-col min-h-[400px]">
          <h3 className="text-xl md:text-3xl font-bold text-stone-900 tracking-tight mb-6">Predictive Analytics</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar text-[13px] md:text-[15px] text-stone-800 font-medium whitespace-pre-wrap leading-relaxed bg-[#FBF9F6]/50 p-6 rounded-3xl border border-stone-200/50">
             {loading ? <span className="animate-pulse text-orange-600">Calculating variables...</span> : simResult || "Initiate simulation to assess probability vectors."}
          </div>
          {simResult && !loading && (
             <button onClick={() => { addNote(`[MARKOV]: ${simResult.slice(0, 80)}...`); setSimResult(""); }} className="mt-6 py-3 px-6 rounded-xl bg-stone-900 text-white font-bold uppercase tracking-widest text-[10px] shadow-lg hover:bg-orange-600 transition-colors self-start flex items-center gap-2 shrink-0">
               <HardDrive size={14} /> Inject to Hub Vault
             </button>
          )}
       </div>
    </div>
  );
}

// ============================================================================
// [MODULES: ECOSYSTEM / INTEL LIBRARY]
// ============================================================================
const EcosystemGridCore = () => {
  const { notes, addNote } = useSentinel();
  const [activeTool, setActiveTool] = useState<any>(null);
  const [toolInput, setToolInput] = useState("");
  const [toolOut, setToolOut] = useState("");
  const [loading, setLoading] = useState(false);

  const items = [
    { id: 'RECALL', t: 'ACTIVE RECALL VAULT', i: BrainCircuit, desc: "Truy xuất ngược & Cọ xát nhận thức từ Hub" }, 
    { id: 'CRUNCHER', t: 'DOC CRUNCHER', i: FileText, desc: "Cày tài liệu nặng & Ép ra First Principles" }, 
    { id: 'DRILL', t: 'DRILL STATION', i: Target, desc: "Hệ sinh thái Website & Ứng dụng luyện đề" }
  ];

  const activeCampaigns = [
    { title: 'HSGTP Đà Nẵng', links: [{ n: 'Ludwig.guru (Context)', u: 'https://ludwig.guru/', t: 'GLOBAL' }, { n: 'OZDIC', u: 'https://ozdic.com/', t: 'GLOBAL' }, { n: 'Cambridge Dict', u: 'https://dictionary.cambridge.org/', t: 'GLOBAL' }] },
    { title: 'IELTS Inversion', links: [{ n: 'IELTS Liz', u: 'https://ieltsliz.com/', t: 'GLOBAL' }, { n: 'Mini-IELTS', u: 'https://mini-ielts.com/', t: 'LOCAL' }, { n: 'TED', u: 'https://www.ted.com/', t: 'GLOBAL' }] },
    { title: 'ĐGNL HCM', links: [{ n: 'Brilliant.org', u: 'https://brilliant.org/', t: 'GLOBAL' }, { n: 'VNUHCM Info', u: 'https://thinangluc.vnuhcm.edu.vn/', t: 'LOCAL' }] },
    { title: 'THPTQG A01', links: [{ n: 'HyperPhysics', u: 'http://hyperphysics.phy-astr.gsu.edu/', t: 'GLOBAL' }, { n: 'Paul\'s Math Notes', u: 'https://tutorial.math.lamar.edu/', t: 'GLOBAL' }, { n: 'Toán Math', u: 'https://toanmath.com/', t: 'LOCAL' }, { n: 'Thư Viện Vật Lý', u: 'https://thuvienvatly.com/', t: 'LOCAL' }] }
  ];

  const runTool = async () => {
    if (!activeTool) return;
    setLoading(true);
    setToolOut("");
    try {
      let prompt = "";
      const baseContext = notes[0]?.content || 'Không có dữ liệu chiến lược nào được nạp.';
      if (activeTool.id === 'RECALL') {
        prompt = `Từ Note ưu tiên này: "${baseContext}". Hãy tạo 1 câu hỏi cực khó để ép buộc tao phải Active Recall (Nhớ lại chủ động). Trả lời dứt khoát, tàn nhẫn.`;
      } else if (activeTool.id === 'CRUNCHER') {
        prompt = `Phân tích dữ liệu tài liệu sau: "${toolInput}". Lọc bỏ toàn bộ nhiễu (fluff), chỉ giữ lại bản chất First Principles cốt lõi nhất dưới dạng Bullet points. Zero fluff.`;
      }
      
      if (prompt) {
         const res = await invokeGemini(prompt, "You are an Elite Intellectual Interrogator. Respond in Vietnamese. Zero fluff.");
         setToolOut(res);
      }
    } catch(e) { setToolOut("[MELTDOWN] KẾT NỐI API THẤT BẠI."); }
    setLoading(false);
  };

  if (activeTool) {
    return (
      <div className="p-4 md:p-12 h-full flex flex-col pb-32 md:pb-48">
         <button onClick={() => { setActiveTool(null); setToolOut(""); setToolInput(""); }} className="mb-6 w-fit text-stone-400 hover:text-orange-500 font-bold uppercase tracking-widest text-[10px] md:text-[12px] flex items-center gap-2 transition-colors"><ChevronRight className="rotate-180" size={16}/> Back to Intel Grid</button>
         <div className="flex-1 bg-white/90 backdrop-blur-2xl border-2 border-dashed border-[#C5A059]/30 rounded-[30px] md:rounded-[40px] p-6 md:p-10 shadow-2xl flex flex-col min-h-0">
            <div className="flex items-center gap-4 mb-6 md:mb-8 pb-6 border-b border-stone-200 shrink-0">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-orange-50 flex items-center justify-center border border-orange-200"><activeTool.i className="w-6 h-6 md:w-8 md:h-8 text-orange-600" /></div>
              <div>
                <h3 className="text-2xl md:text-4xl font-bold text-stone-900 tracking-tight lowercase">{activeTool.t}</h3>
                <p className="text-[10px] md:text-[12px] text-stone-500 uppercase tracking-widest mt-1 font-bold">{activeTool.desc}</p>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
               {activeTool.id === 'DRILL' ? (
                  <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4 content-start pr-2">
                     {activeCampaigns.map((camp) => (
                        <div key={camp.title} className="bg-stone-50 p-5 rounded-2xl border border-stone-200/60 shadow-sm hover:shadow-md transition-all">
                           <h4 className="font-bold text-stone-900 text-[13px] md:text-[15px] mb-3 border-b border-stone-200 pb-2">{camp.title}</h4>
                           <div className="flex flex-col gap-2">
                             {camp.links.map((l, i) => (
                               <a key={i} href={l.u} target="_blank" rel="noopener noreferrer" className="text-[10px] md:text-[11px] font-bold bg-white px-3 py-2.5 rounded-xl text-stone-600 hover:text-orange-600 hover:bg-orange-50 border border-stone-100 shadow-sm flex items-center justify-between group transition-colors">
                                 <div className="flex items-center gap-2">
                                    <span className={cn("px-1.5 py-0.5 rounded-[4px] text-[8px]", l.t === 'GLOBAL' ? "bg-blue-100 text-blue-600" : "bg-stone-200 text-stone-600")}>{l.t}</span>
                                    {l.n}
                                 </div>
                                 <ExternalLink size={12} className="opacity-40 group-hover:opacity-100"/>
                               </a>
                             ))}
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2 gap-6 overflow-hidden">
                     <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                        {activeTool.id === 'CRUNCHER' && (
                           <textarea value={toolInput} onChange={(e) => setToolInput(e.target.value)} placeholder="Paste massive documents, raw theories, or unorganized notes here..." className="flex-1 min-h-[150px] p-4 bg-white border border-stone-200 rounded-2xl text-[13px] text-stone-800 outline-none focus:border-orange-500 transition-colors resize-none custom-scrollbar" />
                        )}
                        {activeTool.id === 'RECALL' && (
                           <div className="flex-1 p-6 bg-stone-100 border border-stone-200 rounded-2xl text-[13px] text-stone-600 flex items-center justify-center text-center italic">
                              Hệ thống sẽ ép bộ não của bạn truy xuất ngược lại Priority Directive hiện tại đang ghim trong Hub. Sẵn sàng chưa?
                           </div>
                        )}
                        <button onClick={runTool} disabled={loading || (activeTool.id === 'CRUNCHER' && !toolInput.trim())} className="py-3.5 rounded-xl bg-stone-900 text-white font-bold uppercase tracking-widest text-[11px] shadow-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shrink-0">
                           {loading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Execute Protocol
                        </button>
                     </div>
                     <div className="flex flex-col gap-4 overflow-hidden mt-4 lg:mt-0">
                        <div className="flex-1 overflow-y-auto custom-scrollbar text-[13px] md:text-[15px] text-stone-800 font-medium whitespace-pre-wrap leading-relaxed p-5 bg-[#FBF9F6]/80 rounded-2xl border border-stone-200 shadow-inner">
                           {toolOut || "Awaiting execution payload..."}
                        </div>
                        {toolOut && (
                           <button onClick={() => { addNote(`[${activeTool.t}]: ${toolOut.slice(0, 100)}...`); setToolOut(""); setToolInput(""); setActiveTool(null); }} className="py-3.5 rounded-xl bg-orange-100 text-orange-700 font-bold uppercase tracking-widest text-[10px] shadow-sm border border-orange-200 hover:bg-orange-600 hover:text-white transition-colors flex items-center justify-center gap-2 shrink-0">
                              <HardDrive size={14} /> Inject Result to Hub Vault
                           </button>
                        )}
                     </div>
                  </div>
               )}
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-12 pb-32 md:pb-48">
      <motion.h2 className="text-4xl md:text-7xl font-bold text-stone-100 tracking-tighter lowercase leading-none mb-6 md:mb-10 pl-2 drop-shadow-md">library</motion.h2>
      <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 overflow-y-auto custom-scrollbar content-start">
        {items.map((app, idx) => {
          const Icon = app.i;
          return (
            <motion.div key={idx} onClick={() => setActiveTool(app)} whileHover={{ y: -8, scale: 1.02 }} className={cn("flex flex-col h-40 md:h-56 cursor-pointer p-1.5 rounded-[24px] md:rounded-[36px] bg-white/40 border-2 border-dashed border-[#C5A059]/30 shadow-lg")}>
              <div className="flex flex-col items-center justify-center text-center h-full group bg-[#FBF9F6]/80 rounded-[20px] md:rounded-[30px] hover:bg-white transition-all duration-500">
                <Icon className="w-10 h-10 md:w-12 md:h-12 text-stone-400 mb-4 md:mb-6 group-hover:text-orange-600 transition-colors duration-300" />
                <span className="text-[11px] md:text-[13px] font-bold uppercase tracking-widest text-stone-800">{app.t}</span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};
const EcosystemGrid = () => <ErrorBoundary moduleName="LIBRARY_GRID"><EcosystemGridCore /></ErrorBoundary>;

// ============================================================================
// [MODULES: LOGIC PRUNER]
// ============================================================================
const LogicPrunerCore = () => {
  const { addNote } = useSentinel();
  const [raw, setRaw] = useState("");
  const [out, setOut] = useState("");
  const [loading, setLoading] = useState(false);
  
  const handlePrune = async () => {
    if (!raw.trim()) return;
    setLoading(true);
    setOut("[SENTINEL]: Executing Active Translation. Stripping fluff...");
    try {
      const res = await invokeGemini(raw, "Trích xuất First Principles cốt lõi. CẤM sao chép nguyên văn (No Verbatim). Ép dữ liệu thành các 'Cognitive Hooks' hóc búa để ghim vào não. Dùng phong cách sắc bén, tàn nhẫn.");
      setOut(res);
    } catch (e) { setOut("[MELTDOWN]: Lỗi kết nối KERNEL."); } finally { setLoading(false); }
  };
  
  return (
    <div className="flex flex-col lg:grid lg:grid-cols-2 gap-6 md:gap-10 h-full p-4 md:p-12 pb-32 md:pb-48 overflow-y-auto lg:overflow-hidden">
      <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className={cn("flex flex-col p-6 md:p-10 rounded-[30px] md:rounded-[40px] bg-white/80 backdrop-blur-2xl border-2 border-dashed border-[#C5A059]/30 shadow-2xl min-h-[300px] lg:min-h-0")}>
        <div className="flex justify-between items-center mb-6 md:mb-8">
           <h3 className="text-3xl md:text-5xl font-bold text-stone-900 tracking-tighter lowercase">pruner</h3>
           <span className="text-[9px] md:text-[10px] font-bold text-red-600 uppercase tracking-widest bg-red-100 px-4 py-1.5 rounded-full border border-red-200 shadow-sm">No Transcribing</span>
        </div>
        <textarea className="flex-1 bg-transparent text-[14px] md:text-[16px] font-medium outline-none resize-none text-stone-800 custom-scrollbar leading-relaxed p-4 bg-white/50 rounded-2xl border border-stone-200/50 min-h-[150px]" placeholder="Paste raw data here. Embed inner monologue (WTF/?) for cognitive hooks. Force friction..." value={raw} onChange={(e) => setRaw(e.target.value)} />
        <button onClick={handlePrune} disabled={loading} className="mt-6 md:mt-8 py-4 md:py-5 rounded-full bg-stone-900 text-white text-[11px] md:text-[12px] font-bold tracking-widest uppercase hover:bg-orange-700 transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-orange-900/30 shrink-0">{loading ? <Loader2 size={18} className="animate-spin" /> : "✨ Synthesize Knowledge"}</button>
      </motion.div>
      <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} className="flex flex-col p-6 md:p-10 rounded-[30px] md:rounded-[40px] bg-stone-900 border border-stone-800 shadow-2xl overflow-hidden min-h-[300px] lg:min-h-0 mt-4 lg:mt-0">
        <h3 className="text-xl md:text-2xl font-bold text-white tracking-widest uppercase mb-6 md:mb-8 opacity-50 text-[12px] md:text-[14px]">Cognitive Hooks</h3>
        <div className="flex-1 overflow-y-auto custom-scrollbar text-[14px] md:text-[16px] text-stone-300 font-medium whitespace-pre-wrap opacity-95 leading-relaxed bg-[#161412] p-6 rounded-3xl border border-stone-800/50 shadow-inner">
           {out || "Awaiting Payload..."}
        </div>
        {out && !loading && (
           <button onClick={() => { addNote(`[PRUNED]: ${out.slice(0, 80)}...`); setOut(""); setRaw(""); }} className="mt-6 py-3 px-6 rounded-xl bg-white/10 text-white font-bold uppercase tracking-widest text-[10px] shadow-lg border border-white/20 hover:bg-orange-600 hover:border-orange-500 transition-colors self-start flex items-center gap-2 shrink-0">
              <HardDrive size={14} /> Inject to Hub Vault
           </button>
        )}
      </motion.div>
    </div>
  );
};
const LogicPruner = () => <ErrorBoundary moduleName="LOGIC_PRUNER"><LogicPrunerCore /></ErrorBoundary>;

// ============================================================================
// [CORE: App]
// ============================================================================

const PHET_SIMS = [
  { name: 'Mạch Điện (DC)', url: 'https://phet.colorado.edu/sims/html/circuit-construction-kit-dc/latest/circuit-construction-kit-dc_all.html' },
  { name: 'Động Học & Lực', url: 'https://phet.colorado.edu/sims/html/forces-and-motion-basics/latest/forces-and-motion-basics_all.html' },
  { name: 'Sóng & Giao Thoa', url: 'https://phet.colorado.edu/sims/html/wave-interference/latest/wave-interference_all.html' },
  { name: 'Định Luật Faraday', url: 'https://phet.colorado.edu/sims/html/faradays-law/latest/faradays-law_all.html' },
  { name: 'Bảo Toàn Năng Lượng', url: 'https://phet.colorado.edu/sims/html/energy-skate-park/latest/energy-skate-park_all.html' },
  { name: 'Trạng Thái Vật Chất', url: 'https://phet.colorado.edu/sims/html/states-of-matter-basics/latest/states-of-matter-basics_all.html' },
  { name: 'Quang Học', url: 'https://phet.colorado.edu/sims/html/bending-light/latest/bending-light_all.html' }
];

const CAMPAIGN_DATA = {
  'HSGTP': {
    title: 'HSGTP Đà Nẵng (24/03)',
    focus: 'Advanced Lexicon & Grammar Hegemony',
    patterns: [
      { t: 'Inversions & Cleft', d: 'Not until..., Sooner..., What... is...' },
      { t: 'Idiomatic Hegemony', d: 'leave to your own devices, strike as odd, make ends meet' },
      { t: 'Essay Architecture', d: '150 words: Coherence, Cohesion, Stress Reduction' }
    ],
    links: [
      { n: 'Ludwig.guru (Context)', u: 'https://ludwig.guru/', t: 'GLOBAL' },
      { n: 'OZDIC', u: 'https://ozdic.com/', t: 'GLOBAL' },
      { n: 'Cambridge Dict', u: 'https://dictionary.cambridge.org/', t: 'GLOBAL' }
    ]
  },
  'IELTS': {
    title: 'IELTS Inversion (Cuối T3)',
    focus: '4-Skill Rigorous Optimization',
    patterns: [
      { t: 'Reading', d: 'True/False/Not Given Trap Avoidance' },
      { t: 'Listening', d: 'Map Labeling & Distractor Filtering' },
      { t: 'Writing Task 1', d: 'Data Topology & Trend Lexicon' },
      { t: 'Writing Task 2', d: 'Rigorous Logical Architecture' }
    ],
    links: [
      { n: 'IELTS Liz', u: 'https://ieltsliz.com/', t: 'GLOBAL' },
      { n: 'Mini-IELTS', u: 'https://mini-ielts.com/', t: 'LOCAL' },
      { n: 'TED', u: 'https://www.ted.com/', t: 'GLOBAL' }
    ]
  },
  'DGNL': {
    title: 'ĐGNL HCM (T4 & T6)',
    focus: 'Cross-disciplinary Analytics',
    patterns: [
      { t: 'Logic & Phân tích', d: 'Logic mệnh đề, Biểu đồ dữ liệu (Data Analysis)' },
      { t: 'Kinh tế & Xã hội', d: 'Kinh tế thị trường định hướng XHCN, GDP vs HDI' },
      { t: 'Khoa học (Tự nhiên)', d: 'Suy luận thực nghiệm Lý-Hóa-Sinh' },
      { t: 'Tiếng Việt', d: 'Đọc hiểu văn bản đa phương thức' }
    ],
    links: [
      { n: 'Brilliant.org', u: 'https://brilliant.org/', t: 'GLOBAL' },
      { n: 'VNUHCM Info', u: 'https://thinangluc.vnuhcm.edu.vn/', t: 'LOCAL' }
    ]
  },
  'THPTQG': {
    title: 'THPTQG A01 (Cuối T6)',
    focus: 'STEM Hegemony',
    patterns: [
      { t: 'Vật Lý: Nhiệt Động', d: 'Khí lí tưởng, Áp suất, Sự nóng chảy (Đề 2025)' },
      { t: 'Vật Lý: Hạt nhân', d: 'Phóng xạ Ra-226, Chu kì bán rã, Độ phóng xạ' },
      { t: 'Vật Lý: Điện mạch', d: 'Định luật Ôm, Mạch RLC (Sử dụng PhET)' },
      { t: 'Toán Học', d: 'Khối đa diện, Vector không gian, Tổ hợp xác suất' }
    ],
    links: [
      { n: 'HyperPhysics', u: 'http://hyperphysics.phy-astr.gsu.edu/', t: 'GLOBAL' },
      { n: 'Paul\'s Math Notes', u: 'https://tutorial.math.lamar.edu/', t: 'GLOBAL' },
      { n: 'Toán Math', u: 'https://toanmath.com/', t: 'LOCAL' },
      { n: 'Thư Viện Vật Lý', u: 'https://thuvienvatly.com/', t: 'LOCAL' }
    ]
  }
};

export default function App() {
  const [isLocked, setIsLocked] = useState(true);
  const [activeMode, setActiveMode] = useState('HEGEMONY');
  const [fatigueLevel, setFatigueLevel] = useState(12);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [notes, setNotes] = useState([{ id: '1', content: "Establish Vertical Impact metrics. No horizontal hoarding.", timestamp: Date.now() - 3600000 }]);
  
  const [tasks, setTasks] = useState<any[]>([]);
  const [architectLoading, setArchitectLoading] = useState(false);

  const architectTasks = async () => {
    if (notes.length === 0) return;
    setArchitectLoading(true);
    try {
      const res = await invokeGemini(`Biến mục tiêu chiến lược sau thành một danh sách 5 nhiệm vụ cụ thể: "${notes[0].content}"`, "You are a Task Architect. Respond with 5 short bullet points.");
      setTasks(res.split('\n').filter(t => t.trim()).map(t => ({ id: crypto.randomUUID(), title: t, done: false })));
    } catch (e) { console.error(e); } finally { setArchitectLoading(false); }
  };

  const [isEmbedExpanded, setIsEmbedExpanded] = useState(true);
  const [activeIframe, setActiveIframe] = useState('https://www.desmos.com/calculator');
  const [activeCampaign, setActiveCampaign] = useState<keyof typeof CAMPAIGN_DATA>('THPTQG');

  const addNote = (content: string) => { setNotes(prev => [{ id: crypto.randomUUID(), content, timestamp: Date.now() }, ...prev]); };
  const deleteNote = (id: string) => { setNotes(prev => prev.filter(n => n.id !== id)); };

  const currentCamp = CAMPAIGN_DATA[activeCampaign];

  // [NUCLEAR FORCE] Khóa Context bằng useMemo. Chặn đứng mọi đợt re-render rác.
  const contextValue = useMemo(() => ({
    fatigueLevel, setFatigueLevel, 
    activeMode, setActiveMode, 
    isProcessing, setIsProcessing, 
    notes, addNote, deleteNote, 
    isLocked, setIsLocked, 
    tasks, setTasks, architectTasks, architectLoading
  }), [fatigueLevel, activeMode, isProcessing, notes, isLocked, tasks, architectLoading]);

  return (
    <ErrorBoundary moduleName="ROOT_SYSTEM">
      <SentinelContext.Provider value={contextValue}>
        <LayoutGroup>
          <AnimatePresence mode="wait">
            {isLocked ? (
              <BootScreen key="boot" onUnlock={() => setIsLocked(false)} />
            ) : (
              <motion.div key="workspace" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn("w-full h-screen flex flex-col overflow-hidden selection:bg-orange-600/20", "bg-[#161412] relative")}>
                <div className="absolute inset-0 z-0 opacity-10 pointer-events-none mix-blend-multiply" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)'/%3E%3C/svg%3E")` }}></div>
                
                <div 
                  className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-1000" 
                  style={{ backgroundImage: `url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=2070')`, filter: activeMode === 'HOME' ? 'none' : 'blur(40px) brightness(0.35) saturate(1.2)', transform: activeMode === 'HOME' ? 'scale(1)' : 'scale(1.1)' }} 
                />
                
                <MenuBar />
                <DynamicIsland />
                
                <main className="flex-1 mt-10 relative overflow-hidden flex flex-col z-10">
                  <AnimatePresence mode="wait">
                    {activeMode !== 'HOME' && (
                      <motion.div 
                        key={activeMode} initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -30, filter: 'blur(10px)' }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} 
                        className="h-full w-full max-w-7xl mx-auto flex flex-col"
                      >
                        {activeMode === 'LIBRARY' && <div className="flex-1 overflow-y-auto"><EcosystemGrid /></div>}
                        {activeMode === 'PRUNER' && <div className="flex-1 overflow-y-auto"><LogicPruner /></div>}
                        {activeMode === 'BAYESIAN' && <ErrorBoundary moduleName="BAYESIAN_CORE"><BayesianMarkovCore /></ErrorBoundary>}
                        
                        {activeMode === 'HEGEMONY' && (
                          <ErrorBoundary moduleName="HEGEMONY_HUB">
                            <div className="p-4 md:p-8 lg:p-10 pb-48 flex flex-col h-full overflow-y-auto custom-scrollbar">
                              <div className="flex justify-between items-end mb-6 md:mb-8 pl-2">
                                <motion.h2 className="text-4xl md:text-7xl font-bold text-stone-100 tracking-tighter lowercase leading-none drop-shadow-md">hegemony</motion.h2>
                                <span className="text-[10px] md:text-[12px] font-mono text-orange-500 uppercase tracking-widest hidden md:block">Tactical Operation Hub</span>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 min-h-[700px]">
                                {/* LÕI THỰC THI (LEFT: 8 COLUMNS) */}
                                <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8">
                                  
                                  {/* TACTICAL CAMPAIGNS (UNIT TESTS) - INTERACTIVE */}
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
                                    {Object.entries(CAMPAIGN_DATA).map(([key, camp]) => {
                                      const isActive = activeCampaign === key;
                                      return (
                                        <button 
                                          key={key} onClick={() => setActiveCampaign(key as any)} 
                                          className={cn("p-3 rounded-2xl border flex flex-col justify-center items-center text-center transition-all cursor-pointer backdrop-blur-md outline-none", isActive ? "border-orange-500 bg-orange-600 shadow-[0_0_15px_rgba(217,83,25,0.4)] text-white scale-[1.02]" : "border-stone-700 bg-stone-900/50 text-stone-400 hover:border-stone-500 hover:text-stone-200")}
                                        >
                                          <span className="text-[10px] font-black uppercase tracking-widest mb-1">{camp.title.split(' ')[0]}</span>
                                          <span className={cn("text-[11px] font-mono font-bold", isActive ? "opacity-90" : "opacity-50")}>{camp.title.split(' ').slice(1).join(' ')}</span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* CAMPAIGN INTEL & DEEP WORK PROTOCOL (SPLIT ROW) */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
                                    {/* Campaign Intel */}
                                    <div className="bg-[#161412] rounded-[30px] border border-stone-800 p-6 flex flex-col shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)] h-64">
                                      <div className="flex justify-between items-start mb-4">
                                        <h4 className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-orange-500 flex items-center gap-2"><Target size={14}/> Core Patterns Extracted</h4>
                                      </div>
                                      <span className="text-[11px] font-bold text-stone-200 mb-3">{currentCamp.focus}</span>
                                      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                                        {currentCamp.patterns.map((p, i) => (
                                          <div key={i} className="flex flex-col p-2 bg-stone-900/50 rounded-lg border border-stone-800/50">
                                            <span className="text-[10px] font-bold text-orange-400 mb-0.5">{p.t}</span>
                                            <span className="text-[11px] text-stone-300 font-medium leading-tight">{p.d}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* DECOUPLED TIMER: Đồng hồ sẽ chạy độc lập, không ép cả cái App re-render */}
                                    <DeepWorkTimer />
                                    
                                  </div>

                                  {/* EMBED MATRIX (NOTION-LIKE IFRAME) - UPGRADED */}
                                  <motion.div layout className={cn("rounded-[30px] md:rounded-[40px] bg-white/95 backdrop-blur-2xl flex flex-col shadow-2xl overflow-hidden relative", TOKENS.borderSaddle, isEmbedExpanded ? "flex-1 min-h-[400px]" : "h-12 md:h-14 shrink-0")}>
                                    <div className="h-12 md:h-14 bg-[#161412] flex items-center px-4 md:px-6 shrink-0 border-b border-stone-800 gap-4 overflow-hidden">
                                      <button onClick={() => setIsEmbedExpanded(!isEmbedExpanded)} className="flex items-center gap-2 outline-none group shrink-0">
                                        <ChevronRight size={14} className={cn("text-orange-500 transition-transform duration-300", isEmbedExpanded && "rotate-90")} />
                                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-orange-500 group-hover:text-orange-400 transition-colors hidden md:inline">Embed Matrix</span>
                                      </button>
                                      
                                      <AnimatePresence>
                                        {isEmbedExpanded && (
                                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex gap-1.5 md:gap-2 overflow-x-auto custom-scrollbar pb-1 items-center">
                                            {/* Native Embeds */}
                                            <button onClick={() => setActiveIframe('https://www.desmos.com/calculator')} className={cn("text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors whitespace-nowrap", activeIframe.includes('desmos') ? 'bg-orange-600 text-white' : 'bg-white/10 text-stone-400 hover:bg-white/20')}>Desmos 2D</button>
                                            <button onClick={() => setActiveIframe('https://www.geogebra.org/3d?embed')} className={cn("text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors whitespace-nowrap", activeIframe.includes('geogebra') ? 'bg-orange-600 text-white' : 'bg-white/10 text-stone-400 hover:bg-white/20')}>GeoGebra 3D</button>
                                            
                                            {/* Sửa lại link gọi thẳng vào Thí nghiệm đầu tiên của PhET thay vì Filter Page bị cấm */}
                                            <button onClick={() => setActiveIframe(PHET_SIMS[0].url)} className={cn("text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors whitespace-nowrap", activeIframe.includes('phet.colorado.edu') ? 'bg-orange-600 text-white' : 'bg-white/10 text-stone-400 hover:bg-white/20')}>PhET Hub</button>
                                            
                                            <button onClick={() => setActiveIframe('https://open.spotify.com/embed/playlist/37i9dQZF1DWZeKCadgRdKQ?utm_source=generator&theme=0')} className={cn("text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-colors whitespace-nowrap", activeIframe.includes('spotify') ? 'bg-orange-600 text-white' : 'bg-white/10 text-stone-400 hover:bg-white/20')}>Spotify</button>
                                            
                                            <div className="w-px h-4 bg-stone-700 mx-1 shrink-0"></div>
                                            
                                            {/* Pop-out Links (Bypassing X-Frame-Options) */}
                                            <a href="https://pomofocus.io/" target="_blank" rel="noopener noreferrer" className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors whitespace-nowrap flex items-center gap-1">Pomodoro <ExternalLink size={10}/></a>
                                            <a href="https://phet.colorado.edu/vi/simulations/filter?subjects=physics&type=html" target="_blank" rel="noopener noreferrer" className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors whitespace-nowrap flex items-center gap-1">PhET (Ext) <ExternalLink size={10}/></a>
                                            <a href="https://www.khanacademy.org/" target="_blank" rel="noopener noreferrer" className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors whitespace-nowrap flex items-center gap-1">Khan <ExternalLink size={10}/></a>
                                            <a href="https://news.ycombinator.com/" target="_blank" rel="noopener noreferrer" className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors whitespace-nowrap flex items-center gap-1">News <ExternalLink size={10}/></a>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                    <AnimatePresence>
                                      {isEmbedExpanded && (
                                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: '100%' }} exit={{ opacity: 0, height: 0 }} className="flex-1 bg-[#FBF9F6] flex flex-col">
                                          
                                          {/* [SURGICAL ADDITION] - PhET Mini-Library Bar: Chỉ hiện khi m kích hoạt PhET Hub */}
                                          {activeIframe.includes('phet.colorado.edu') && (
                                            <div className="bg-[#161412] border-b border-stone-800 flex gap-2 overflow-x-auto px-4 py-2 custom-scrollbar shrink-0 items-center">
                                              <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest mr-2 shrink-0 flex items-center gap-1"><Target size={12}/> PhET Library</span>
                                              {PHET_SIMS.map(sim => (
                                                <button key={sim.name} onClick={() => setActiveIframe(sim.url)} className={cn("text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-md transition-all whitespace-nowrap", activeIframe === sim.url ? "bg-emerald-600 text-white shadow-md" : "bg-white/5 text-stone-400 border border-stone-800 hover:bg-white/10 hover:text-stone-200")}>{sim.name}</button>
                                              ))}
                                            </div>
                                          )}

                                          <iframe src={activeIframe} className="w-full h-full border-none flex-1" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </motion.div>

                                </div>

                                {/* LÕI CHIẾN LƯỢC (RIGHT: 4 COLUMNS) */}
                                <div className="lg:col-span-4 flex flex-col gap-6 md:gap-8">
                                  {/* THE GEMINI NEXUS & DATA COLLECTION */}
                                  <div className="bg-[#161412] rounded-[30px] md:rounded-[40px] p-6 flex-1 flex flex-col shadow-2xl border border-stone-800 relative overflow-hidden min-h-[450px]">
                                    
                                    {/* GEMINI NEURAL LINK HEADER */}
                                    <div className="mb-6 p-5 rounded-3xl border border-orange-500/30 bg-orange-500/5 relative overflow-hidden group">
                                      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/10 blur-[40px] rounded-full pointer-events-none group-hover:bg-orange-600/20 transition-all duration-700"></div>
                                      <div className="flex justify-between items-start mb-3 relative z-10">
                                        <div>
                                          <h4 className="text-[11px] md:text-[12px] font-bold uppercase tracking-widest text-orange-500 flex items-center gap-2"><BrainCircuit size={14}/> Neural Nexus</h4>
                                          <span className="text-[9px] font-mono text-stone-400 mt-1 block">EXTERNAL DATA GATHERING</span>
                                        </div>
                                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                      </div>
                                      <a href="https://gemini.google.com/share/1b10a2d6c9a6" target="_blank" rel="noopener noreferrer" className="block w-full py-3 rounded-xl bg-orange-600 text-white text-[10px] font-bold tracking-[0.2em] uppercase text-center shadow-lg hover:bg-orange-500 transition-colors relative z-10">
                                        Initiate Uplink <ChevronRight size={14} className="inline mb-0.5" />
                                      </a>
                                    </div>

                                    <div className="flex justify-between items-center mb-4">
                                      <h4 className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-stone-400">Weaponized Links</h4>
                                    </div>
                                    
                                    <div className="space-y-2 mb-6 flex-1">
                                      {currentCamp.links.map((link, idx) => (
                                        <a key={idx} href={link.u} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-xl border border-stone-700 bg-[#211E1C] hover:border-orange-500/50 transition-all group">
                                          <div className="flex items-center gap-2">
                                            <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-widest", link.t === 'GLOBAL' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-stone-500/10 text-stone-400 border border-stone-500/20")}>{link.t}</span>
                                            <span className="text-[11px] md:text-[12px] font-bold text-stone-200 group-hover:text-orange-400 transition-colors">{link.n}</span>
                                          </div>
                                          <ExternalLink size={14} className="text-stone-500 group-hover:text-orange-400 transition-colors" />
                                        </a>
                                      ))}
                                    </div>

                                    <div className="h-px w-full bg-stone-800 my-4"></div>

                                    {/* EPISTEMOLOGICAL TRACE & ORPHAN FIX */}
                                    <div className="flex justify-between items-center mb-3">
                                      <h4 className="text-[10px] md:text-[11px] font-bold uppercase tracking-widest text-stone-400 flex items-center gap-2">
                                        <HardDrive size={12}/> Epistemological Trace
                                      </h4>
                                      <button onClick={architectTasks} disabled={architectLoading} className="text-[9px] uppercase tracking-widest font-bold text-orange-500 hover:text-white transition-colors flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/10 hover:bg-orange-600">
                                        {architectLoading ? <Loader2 size={10} className="animate-spin"/> : <ListTodo size={10}/>} Extract Tasks
                                      </button>
                                    </div>
                                    
                                    <form onSubmit={(e) => {
                                      e.preventDefault();
                                      const target = e.target as any;
                                      if (target.noteInput.value.trim()) { addNote(target.noteInput.value); target.noteInput.value = ""; }
                                    }} className="mb-4">
                                      <input name="noteInput" type="text" placeholder="Inject macro-hypothesis..." className="w-full bg-[#0A0908] border border-stone-800 rounded-xl px-4 py-2.5 outline-none text-[12px] font-medium text-stone-200 focus:border-orange-600 transition-colors placeholder:text-stone-600" />
                                    </form>

                                    <div className="space-y-2 overflow-y-auto h-32 custom-scrollbar pr-2">
                                      {notes.length > 0 ? notes.map((n) => (
                                        <div key={n.id} className="group text-[10px] md:text-[11px] text-stone-400 flex justify-between items-start border-b border-stone-800/50 py-2 transition-all hover:bg-stone-900 rounded-md px-2">
                                          <span className="pr-4 font-medium leading-relaxed">{n.content}</span>
                                          <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                            <span className="opacity-40 font-mono text-[8px] md:text-[9px]">{new Date(n.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <button onClick={() => deleteNote(n.id)} className="text-stone-500 hover:text-red-500 md:opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12} /></button>
                                          </div>
                                        </div>
                                      )) : (
                                        <div className="text-[10px] md:text-[11px] italic text-stone-600 py-2 text-center">Vault Empty.</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </ErrorBoundary>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </main>
                <Dock />
              </motion.div>
            )}
          </AnimatePresence>
          <style dangerouslySetInnerHTML={{ __html: `
            @import url('https://fonts.googleapis.com/css2?family=Product+Sans:wght@400;700&display=swap');
            @import url('https://fonts.cdnfonts.com/css/google-sans');
            *, body, input, textarea, button, span, h1, h2, h3, h4 { font-family: 'Product Sans', 'Google Sans', sans-serif !important; }
            .custom-scrollbar::-webkit-scrollbar { width: 3px; height: 3px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #A67C52; border-radius: 10px; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
          `}} />
        </LayoutGroup>
      </SentinelContext.Provider>
    </ErrorBoundary>
  );
}
