
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  Language, 
  UserSession, 
  Reservation, 
  ACCESS_CODE, 
  ADMIN_CODE, 
  RESOURCES, 
  ResourceType,
  RecurrenceType 
} from './types';
import { translations } from './translations';
import { 
  Calendar as CalendarIcon, 
  ClipboardList, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  LogOut, 
  Trash2, 
  Edit,
  ArrowLeft,
  Volume2,
  VolumeX,
  Check,
  X
} from 'lucide-react';
import { 
  format, 
  addDays, 
  addMonths, 
  addMinutes, 
  isAfter,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  isSameDay
} from 'date-fns';
import { es } from 'date-fns/locale/es';
import { eu } from 'date-fns/locale/eu';

// --- SVGS INTEGRADOS (Para asegurar visibilidad sin archivos externos) ---

const SkullLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} fill="currentColor">
    <path d="M50 15c-16.6 0-30 13.4-30 30 0 11.2 6.1 21 15.2 26.2v8.8c0 2.8 2.2 5 5 5h19.6c2.8 0 5-2.2 5-5v-8.8c9.1-5.2 15.2-15 15.2-26.2 0-16.6-13.4-30-30-30zm-12 30c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4zm24 0c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
    <rect x="10" y="45" width="6" height="15" rx="3" />
    <rect x="84" y="45" width="6" height="15" rx="3" />
    <path d="M40 75h20M45 80h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const HalaBediText = ({ className }: { className?: string }) => (
  <div className={`flex flex-col items-center leading-none font-black italic tracking-tighter ${className}`}>
    <span className="text-pink-600 text-3xl">HALA BEDI</span>
    <span className="text-white text-xl">IRRATIA</span>
  </div>
);

// --- DATE HELPERS ---

const parseISO = (dateString: string): Date => {
  if (!dateString) return new Date();
  const [datePart, timePart] = dateString.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (timePart) {
    const [hours, minutes] = timePart.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
};

// Fix: subDays is missing from date-fns, using addDays with negative value instead
const subDays_custom = (date: Date, amount: number): Date => addDays(date, -amount);
const startOfMonth_custom = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfWeek_custom = (date: Date, options?: { weekStartsOn?: number }): Date => {
  const weekStartsOn = options?.weekStartsOn ?? 0;
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

// --- AUDIO HELPERS ---

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- HELPER FUNCTIONS ---

const getLoc = (lang: Language) => (lang === 'es' ? es : eu);

const generateProgramCode = (name: string): string => {
  const cleanName = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = cleanName.substring(0, 5);
  return `HBI_${prefix}`;
};

const getOverlap = (newRes: Partial<Reservation>, existing: Reservation[]) => {
  if (!newRes.date || !newRes.startTime || !newRes.duration) return false;
  const newStart = parseISO(`${newRes.date}T${newRes.startTime}`);
  const newEnd = addMinutes(newStart, newRes.duration);

  return existing.some(res => {
    if (res.id === newRes.id) return false;
    if (res.resourceId !== newRes.resourceId || res.date !== newRes.date) return false;

    const resStart = parseISO(`${res.date}T${res.startTime}`);
    const resEnd = addMinutes(resStart, res.duration);

    return (
      (newStart >= resStart && newStart < resEnd) ||
      (newEnd > resStart && newEnd <= resEnd) ||
      (resStart >= newStart && resStart < newEnd)
    );
  });
};

// --- COMPONENTS ---

const Header: React.FC<{ 
  lang: Language, 
  onBack?: () => void, 
  title: string, 
  isAdmin?: boolean,
  onListen?: () => void,
  isAudioPlaying?: boolean
}> = ({ lang, onBack, title, isAdmin, onListen, isAudioPlaying }) => {
  const t = translations[lang];
  return (
    <div className="bg-black text-white p-4 sticky top-0 z-50 flex items-center justify-between border-b border-pink-600 shadow-xl backdrop-blur-md bg-black/80">
      <div className="flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-full transition-colors active:scale-90">
            <ChevronLeft className="text-pink-500 pointer-events-none" />
          </button>
        )}
        <h1 className="text-sm md:text-lg font-black uppercase tracking-tighter truncate max-w-[150px] md:max-w-none">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={onListen} 
          title={t.listen}
          className={`p-2 rounded-full transition-all ${isAudioPlaying ? 'bg-pink-600 animate-pulse' : 'bg-zinc-900 border border-zinc-800 hover:border-pink-600'}`}
        >
          {isAudioPlaying ? <VolumeX size={18} className="pointer-events-none" /> : <Volume2 size={18} className="pointer-events-none" />}
        </button>
        {isAdmin && <span className="bg-amber-500 text-[9px] px-2 py-0.5 rounded-full uppercase font-black text-black">Admin</span>}
        <SkullLogo className="h-8 w-8 text-pink-600 ml-1" />
      </div>
    </div>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col max-w-4xl mx-auto shadow-2xl overflow-x-hidden border-x border-zinc-900">
      {children}
    </div>
  );
};

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [lang, setLang] = useState<Language | null>(null);
  const [session, setSession] = useState<UserSession | null>(null);
  const [view, setView] = useState<'home' | 'calendar' | 'my-reservations' | 'admin' | 'new-reservation'>('home');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('day');
  const [selectedSlot, setSelectedSlot] = useState<{ date: string, time: string, resourceId: string } | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [showCodeModal, setShowCodeModal] = useState<string | null>(null);
  const [searchCode, setSearchCode] = useState("");
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('hbi_reservations');
    if (saved) setReservations(JSON.parse(saved));
    const savedSession = localStorage.getItem('hbi_session');
    if (savedSession) {
      const parsed = JSON.parse(savedSession);
      setSession(parsed);
      setLang(parsed.language);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('hbi_reservations', JSON.stringify(reservations));
  }, [reservations]);

  const handleSetLang = (l: Language) => {
    setLang(l);
  };

  const handleLogin = (code: string) => {
    const upperCode = code.trim();
    if (upperCode === ACCESS_CODE) {
      const newSession = { isAuthenticated: true, isAdmin: false, language: lang! };
      setSession(newSession);
      localStorage.setItem('hbi_session', JSON.stringify(newSession));
    } else if (upperCode === ADMIN_CODE) {
      const newSession = { isAuthenticated: true, isAdmin: true, language: lang! };
      setSession(newSession);
      localStorage.setItem('hbi_session', JSON.stringify(newSession));
    } else {
      alert(translations[lang!].invalid_code);
    }
  };

  const handleAdminAuth = (code: string) => {
    if (code.trim() === ADMIN_CODE) {
      const newSession = { ...session!, isAdmin: true };
      setSession(newSession);
      localStorage.setItem('hbi_session', JSON.stringify(newSession));
      setView('admin');
    } else {
      alert(translations[lang!].invalid_code);
    }
  };

  const addReservation = (data: Omit<Reservation, 'id' | 'createdAt' | 'notified'>, recurrence: RecurrenceType) => {
    const t = translations[lang!];
    const newId = Math.random().toString(36).substr(2, 9);
    const newRes: Reservation = { ...data, id: newId, createdAt: Date.now(), notified: false };

    if (getOverlap(newRes, reservations)) {
      alert(t.overlap_error);
      return;
    }

    const newBatch = [newRes];
    if (recurrence !== 'none') {
      let nextDate = parseISO(data.date);
      for (let i = 1; i <= 8; i++) {
        if (recurrence === 'weekly') nextDate = addWeeks(nextDate, 1);
        else if (recurrence === 'biweekly') nextDate = addWeeks(nextDate, 2);
        else if (recurrence === 'monthly') nextDate = addMonths(nextDate, 1);

        const recRes: Reservation = { 
          ...data, 
          id: Math.random().toString(36).substr(2, 9), 
          date: format(nextDate, 'yyyy-MM-dd'),
          createdAt: Date.now(),
          notified: false
        };
        if (!getOverlap(recRes, reservations)) newBatch.push(recRes);
      }
    }

    setReservations(prev => [...prev, ...newBatch]);
    setShowCodeModal(data.programCode);
    setView('calendar');
  };

  const updateReservation = (id: string, data: Partial<Reservation>) => {
    const t = translations[lang!];
    const existing = reservations.find(r => r.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data };
    if (getOverlap(updated, reservations)) {
      alert(t.overlap_error);
      return;
    }
    setReservations(prev => prev.map(r => r.id === id ? updated : r));
    setEditingReservation(null);
    setView('my-reservations');
  };

  const deleteReservation = (id: string) => {
    setReservations(prev => prev.filter(r => r.id !== id));
    setConfirmDeleteId(null);
  };

  const speakPage = async () => {
    if (isAudioPlaying) {
      audioSourceRef.current?.stop();
      setIsAudioPlaying(false);
      return;
    }
    const t = translations[lang!];
    let pageText = view === 'home' ? (lang === 'es' ? "Bienvenido a Hala Bedi. Elige una opción." : "Ongi etorri Hala Bedira. Aukeratu bat.") : t[view as keyof typeof t] || "";
    try {
      setIsAudioPlaying(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: pageText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const ctx = audioContextRef.current;
        const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => setIsAudioPlaying(false);
        audioSourceRef.current = source;
        source.start();
      } else setIsAudioPlaying(false);
    } catch (e) { setIsAudioPlaying(false); }
  };

  const t = lang ? translations[lang] : translations.es;

  if (!lang) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-12 bg-black">
          <SkullLogo className="h-48 md:h-64 text-pink-600 animate-pulse" />
          <HalaBediText className="scale-125" />
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-widest text-pink-600">{translations.es.select_language}</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-lg">
            <button onClick={() => handleSetLang('es')} className="bg-zinc-950 border-2 border-zinc-800 p-8 rounded-3xl text-xl md:text-2xl font-black hover:border-pink-600 transition-all shadow-xl active:scale-95 uppercase">CASTELLANO</button>
            <button onClick={() => handleSetLang('eu')} className="bg-zinc-950 border-2 border-zinc-800 p-8 rounded-3xl text-xl md:text-2xl font-black hover:border-pink-600 transition-all shadow-xl active:scale-95 uppercase">EUSKERA</button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!session?.isAuthenticated) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-10 relative bg-black">
          <button onClick={() => setLang(null)} className="absolute top-6 left-6 p-2 text-zinc-600 flex items-center gap-2 hover:text-white transition-colors uppercase text-xs font-black">
            <ArrowLeft size={18} /> {t.go_back}
          </button>
          <SkullLogo className="h-32 md:h-40 text-pink-600" />
          <div className="w-full max-w-sm space-y-6">
            <h2 className="text-xl font-black text-center uppercase tracking-[0.2em] text-pink-600">{t.enter_access_code}</h2>
            <input 
              type="password"
              placeholder="••••••••"
              autoFocus
              className="w-full bg-zinc-900 border-2 border-zinc-800 p-5 rounded-3xl text-center text-3xl md:text-4xl tracking-widest outline-none focus:border-pink-600 transition-all text-white"
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(e.currentTarget.value); }}
            />
            <p className="text-[10px] text-zinc-600 text-center uppercase font-black tracking-widest">Gorde sekretua, izan libre</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {view === 'home' && (
        <div className="flex-1 flex flex-col p-6 space-y-8 animate-in fade-in duration-500">
          <Header lang={lang} title={t.home} onListen={speakPage} isAudioPlaying={isAudioPlaying} isAdmin={session.isAdmin} />
          <div className="flex flex-col items-center py-4">
            <SkullLogo className="h-40 text-pink-600 mb-6" />
            <HalaBediText className="mb-8" />
            <h1 className="text-2xl md:text-3xl font-black text-pink-600 tracking-tighter uppercase italic text-center">ERRESERBA GUNEA</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <button onClick={() => setView('calendar')} className="flex flex-col items-center justify-center gap-4 bg-zinc-900 border border-zinc-800 hover:border-pink-600 p-10 md:p-12 rounded-[2.5rem] transition-all group active:scale-95 shadow-2xl">
              <CalendarIcon size={64} className="text-pink-600 group-hover:scale-110 transition-transform pointer-events-none" />
              <div className="text-center font-black uppercase text-lg md:text-xl tracking-widest">{t.calendar}</div>
            </button>
            <button onClick={() => setView('my-reservations')} className="flex flex-col items-center justify-center gap-4 bg-zinc-900 border border-zinc-800 hover:border-pink-600 p-10 md:p-12 rounded-[2.5rem] transition-all group active:scale-95 shadow-2xl">
              <ClipboardList size={64} className="text-pink-600 group-hover:scale-110 transition-transform pointer-events-none" />
              <div className="text-center font-black uppercase text-lg md:text-xl tracking-widest">{t.my_reservations}</div>
            </button>
            {session.isAdmin && (
               <button onClick={() => setView('admin')} className="md:col-span-2 flex items-center justify-center gap-6 bg-amber-900/20 border-2 border-amber-600/50 hover:bg-amber-900/40 p-8 rounded-[2.5rem] transition-all group active:scale-95 shadow-xl">
                 <Settings size={32} className="text-amber-500 group-hover:rotate-90 transition-transform duration-700 pointer-events-none" />
                 <div className="text-lg md:text-xl font-black uppercase tracking-widest text-amber-500">{t.admin}</div>
               </button>
            )}
          </div>

          {!session.isAdmin && (
            <div className="pt-8 text-center">
              <button onClick={() => { const code = prompt(t.admin_access_hint); if (code) handleAdminAuth(code); }} className="text-zinc-800 hover:text-zinc-600 transition-colors uppercase text-[10px] font-black tracking-widest flex items-center justify-center gap-2 mx-auto">
                <Settings size={14} className="pointer-events-none" /> Admin Access
              </button>
            </div>
          )}

          <button onClick={() => { setSession(null); localStorage.removeItem('hbi_session'); }} className="mt-auto py-4 text-zinc-800 hover:text-red-800 transition-colors uppercase text-[10px] font-black tracking-widest flex items-center justify-center gap-2">
            <LogOut size={14} className="pointer-events-none" /> Saioa Itxi / Cerrar Sesión
          </button>
        </div>
      )}

      {view === 'calendar' && (
        <div className="flex-1 flex flex-col min-h-screen">
          <Header lang={lang} title={t.calendar} onBack={() => setView('home')} isAdmin={session.isAdmin} onListen={speakPage} isAudioPlaying={isAudioPlaying} />
          
          <div className="p-4 bg-black flex flex-col md:flex-row items-center justify-between gap-4 sticky top-[73px] z-40 border-b border-zinc-900">
            <div className="flex items-center gap-4 bg-zinc-900 p-2 rounded-2xl w-full md:w-auto justify-between">
              <button onClick={() => {
                if (calendarView === 'month') setCurrentDate(prev => subDays_custom(startOfMonth_custom(prev), 1));
                else if (calendarView === 'week') setCurrentDate(prev => addDays(prev, -7));
                else setCurrentDate(prev => addDays(prev, -1));
              }} className="p-2 hover:bg-pink-600 rounded-xl transition-colors"><ChevronLeft size={20} className="pointer-events-none" /></button>
              <span className="font-black text-xs md:text-sm min-w-[140px] text-center uppercase tracking-tighter">
                {format(currentDate, calendarView === 'month' ? 'MMMM yyyy' : 'EEEE, d MMMM', { locale: getLoc(lang) })}
              </span>
              <button onClick={() => {
                if (calendarView === 'month') setCurrentDate(prev => addDays(endOfMonth(prev), 1));
                else if (calendarView === 'week') setCurrentDate(prev => addDays(prev, 7));
                else setCurrentDate(prev => addDays(prev, 1));
              }} className="p-2 hover:bg-pink-600 rounded-xl transition-colors"><ChevronRight size={20} className="pointer-events-none" /></button>
            </div>
            <div className="flex p-1 bg-zinc-900 rounded-2xl w-full md:w-auto">
              {(['day', 'week', 'month'] as const).map(v => (
                <button key={v} onClick={() => setCalendarView(v)} className={`flex-1 md:flex-none px-4 py-2 rounded-xl transition-all uppercase text-[10px] font-black ${calendarView === v ? 'bg-pink-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}>
                  {t[v as keyof typeof t] as string}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-zinc-950">
            {calendarView === 'day' && (
              <div className="min-w-[1200px]">
                <div className="grid grid-cols-[100px_repeat(7,1fr)] bg-black border-b border-zinc-900 sticky top-0 z-30 shadow-md">
                  <div className="p-4"></div>
                  {RESOURCES.map(r => (
                    <div key={r.id} className="p-4 font-black text-[10px] text-center uppercase text-zinc-400 tracking-widest border-l border-zinc-900">
                      {r.name}
                    </div>
                  ))}
                </div>
                {Array.from({ length: 37 }).map((_, i) => {
                  const hour = Math.floor(i / 2) + 6;
                  const min = i % 2 === 0 ? '00' : '30';
                  const timeStr = `${hour.toString().padStart(2, '0')}:${min}`;
                  if (hour >= 24) return null;
                  return (
                    <div key={timeStr} className={`grid grid-cols-[100px_repeat(7,1fr)] border-b border-zinc-900/50 h-14 ${i % 2 === 0 ? 'bg-black' : 'bg-zinc-900/10'}`}>
                      <div className="flex items-center justify-center text-[11px] text-zinc-500 font-black font-mono border-r border-zinc-900">{timeStr}</div>
                      {RESOURCES.map(r => {
                        const reservation = reservations.find(res => {
                          if (res.resourceId !== r.id || res.date !== format(currentDate, 'yyyy-MM-dd')) return false;
                          const start = parseISO(`${res.date}T${res.startTime}`);
                          const end = addMinutes(start, res.duration);
                          const current = parseISO(`${res.date}T${timeStr}`);
                          return current >= start && current < end;
                        });
                        return (
                          <div 
                            key={`${r.id}-${timeStr}`} 
                            onClick={() => !reservation && (setSelectedSlot({ date: format(currentDate, 'yyyy-MM-dd'), time: timeStr, resourceId: r.id }), setView('new-reservation'))}
                            className={`border-r border-zinc-900 relative group cursor-pointer transition-colors ${reservation ? 'bg-zinc-800' : 'hover:bg-pink-600/10'}`}
                          >
                            {reservation && (
                              <div className="absolute inset-0 p-1 flex items-center justify-center">
                                <div className="w-full h-full bg-[#82072a] border-l-4 border-pink-500 rounded-sm flex flex-col justify-center px-2 overflow-hidden shadow-inner">
                                  <span className="text-[10px] font-black text-white uppercase truncate drop-shadow-md">
                                    {reservation.programName}
                                  </span>
                                  {session.isAdmin && (
                                    <span className="text-[8px] text-pink-200 uppercase font-bold truncate">
                                      {reservation.userName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {calendarView === 'week' && (
              <div className="p-4 overflow-x-auto h-full">
                <div className="min-w-[1000px] border border-zinc-900 rounded-3xl overflow-hidden bg-zinc-950 shadow-2xl flex flex-col h-full max-h-[70vh]">
                  <div className="grid grid-cols-[80px_repeat(7,1fr)] bg-black border-b border-zinc-900 sticky top-0 z-20">
                    <div className="p-3 border-r border-zinc-900"></div>
                    {eachDayOfInterval({
                      start: startOfWeek_custom(currentDate, { weekStartsOn: 1 }),
                      end: addDays(startOfWeek_custom(currentDate, { weekStartsOn: 1 }), 6)
                    }).map(day => (
                      <div 
                        key={day.toISOString()} 
                        onClick={() => { setCurrentDate(day); setCalendarView('day'); }}
                        className={`p-4 text-center cursor-pointer hover:bg-zinc-900 border-r border-zinc-900 transition-all ${isSameDay(day, new Date()) ? 'bg-pink-900/10' : ''}`}
                      >
                        <div className="text-[10px] uppercase font-black tracking-widest text-zinc-600">{format(day, 'EEE', { locale: getLoc(lang) })}</div>
                        <div className={`text-xl font-black mt-1 ${isSameDay(day, new Date()) ? 'text-pink-500' : 'text-white'}`}>{format(day, 'd')}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {Array.from({ length: 37 }).map((_, i) => {
                      const hour = Math.floor(i / 2) + 6;
                      const min = i % 2 === 0 ? '00' : '30';
                      const timeStr = `${hour.toString().padStart(2, '0')}:${min}`;
                      if (hour >= 24) return null;
                      return (
                        <div key={timeStr} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-zinc-900 h-10">
                          <div className="text-[9px] text-zinc-700 flex items-center justify-center font-black font-mono border-r border-zinc-900 bg-black/40">{timeStr}</div>
                          {eachDayOfInterval({
                            start: startOfWeek_custom(currentDate, { weekStartsOn: 1 }),
                            end: addDays(startOfWeek_custom(currentDate, { weekStartsOn: 1 }), 6)
                          }).map(day => {
                            const resOnDay = reservations.filter(res => res.date === format(day, 'yyyy-MM-dd'));
                            const hasReservation = resOnDay.some(res => {
                              const start = parseISO(`${res.date}T${res.startTime}`);
                              const end = addMinutes(start, res.duration);
                              const current = parseISO(`${res.date}T${timeStr}`);
                              return current >= start && current < end;
                            });
                            return (
                              <div 
                                key={day.toISOString()} 
                                onClick={() => { setCurrentDate(day); setCalendarView('day'); }}
                                className={`border-r border-zinc-900 cursor-pointer transition-colors ${hasReservation ? 'bg-[#82072a]' : 'hover:bg-pink-600/5'}`} 
                              />
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {calendarView === 'month' && (
              <div className="p-4 h-full">
                <div className="grid grid-cols-7 gap-2 md:gap-4 bg-zinc-950 p-4 rounded-3xl border border-zinc-900 shadow-2xl content-start min-h-[500px]">
                  {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                    <div key={d} className="p-2 text-center text-xs font-black text-zinc-500 tracking-widest">{d}</div>
                  ))}
                  {eachDayOfInterval({
                    start: startOfMonth_custom(currentDate),
                    end: endOfMonth(currentDate)
                  }).map((day, idx) => {
                    const dayRes = reservations.filter(res => res.date === format(day, 'yyyy-MM-dd'));
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div 
                        key={day.toISOString()} 
                        onClick={() => { setCurrentDate(day); setCalendarView('day'); }}
                        className={`aspect-square md:aspect-auto md:min-h-[120px] p-3 bg-black border border-zinc-900 rounded-2xl hover:border-pink-600 cursor-pointer transition-all relative group shadow-lg ${idx === 0 ? `col-start-${format(day, 'i')}` : ''}`}
                      >
                        <span className={`text-sm font-black transition-colors ${isToday ? 'text-pink-500' : 'text-zinc-600 group-hover:text-zinc-200'}`}>{format(day, 'd')}</span>
                        <div className="mt-2 flex flex-col gap-1 overflow-hidden">
                          {dayRes.slice(0, 3).map(r => (
                            <div key={r.id} className="h-1.5 w-full bg-[#82072a] rounded-full border-l-2 border-pink-500" />
                          ))}
                          {dayRes.length > 3 && <div className="text-[8px] text-zinc-600 font-black text-center mt-1">+{dayRes.length - 3}</div>}
                        </div>
                        {isToday && <div className="absolute top-2 right-2 w-2 h-2 bg-pink-500 rounded-full shadow-[0_0_8px_rgba(230,0,126,1)]" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 flex justify-center border-t border-zinc-900 bg-black sticky bottom-0 z-50">
            <button onClick={() => setView('home')} className="flex items-center gap-2 px-8 py-3 bg-zinc-900 border border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:border-pink-600 transition-all shadow-xl">
              <ArrowLeft size={16} className="pointer-events-none" /> {t.go_back}
            </button>
          </div>
        </div>
      )}

      {view === 'my-reservations' && (
        <div className="flex-1 flex flex-col min-h-screen">
          <Header lang={lang} title={t.my_reservations} onBack={() => setView('home')} />
          <div className="p-8 space-y-10 max-w-xl mx-auto w-full">
            <div className="space-y-4">
              <label className="text-[11px] uppercase font-black text-zinc-500 tracking-widest ml-1">{t.program_code_label}</label>
              <input 
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                placeholder="HBI_XXXXX"
                className="w-full bg-zinc-900 border-2 border-zinc-800 p-6 rounded-[2rem] text-2xl font-black font-mono uppercase tracking-[0.4em] outline-none focus:border-pink-600 shadow-inner text-white"
              />
            </div>
            <div className="space-y-6">
              {reservations
                .filter(r => r.programCode === searchCode.trim())
                .sort((a,b) => isAfter(parseISO(a.date), parseISO(b.date)) ? 1 : -1)
                .map(r => (
                  <div key={r.id} className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-[2rem] flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 shadow-lg">
                    <div className="flex-1">
                      <div className="text-[10px] bg-pink-600/20 text-pink-500 border border-pink-500/30 px-3 py-1 rounded-full inline-block font-black uppercase mb-3">
                        {RESOURCES.find(res => res.id === r.resourceId)?.name}
                      </div>
                      <div className="text-xl font-black text-white">{format(parseISO(r.date), 'dd/MM/yyyy')} — {r.startTime}</div>
                      <div className="text-xs text-zinc-500 uppercase font-black tracking-tight mt-1">{r.programName} ({r.duration} min)</div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => { setEditingReservation(r); setView('new-reservation'); }} className="p-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-2xl transition-all">
                        <Edit size={20} className="pointer-events-none" />
                      </button>
                      
                      {confirmDeleteId === r.id ? (
                        <div className="flex gap-2">
                           <button onClick={() => deleteReservation(r.id)} className="p-4 bg-red-600 text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-tighter shadow-lg shadow-red-600/20">
                             OK
                           </button>
                           <button onClick={() => setConfirmDeleteId(null)} className="p-4 bg-zinc-700 text-white rounded-2xl transition-all">
                             <X size={20} className="pointer-events-none" />
                           </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(r.id)} className="p-4 bg-zinc-800 hover:bg-red-900/40 text-zinc-400 hover:text-red-500 rounded-2xl transition-all">
                          <Trash2 size={20} className="pointer-events-none" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              {searchCode.trim().length > 4 && reservations.filter(r => r.programCode === searchCode.trim()).length === 0 && (
                <div className="text-center py-12 text-zinc-700 font-black uppercase tracking-widest animate-pulse">
                  {t.no_reservations}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'admin' && (
        <div className="flex-1 flex flex-col min-h-screen">
          <Header lang={lang} title={t.admin} onBack={() => setView('home')} isAdmin onListen={speakPage} isAudioPlaying={isAudioPlaying} />
          <div className="p-6 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800 shadow-xl">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{t.filter_by_date}</label>
                <input type="date" onChange={(e) => e.target.value && setCurrentDate(parseISO(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-xs font-black uppercase text-white outline-none focus:border-pink-600" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">{t.resource}</label>
                <select className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-xs font-black uppercase text-zinc-400 outline-none focus:border-pink-600"><option value="all">{t.all.toUpperCase()}</option></select>
              </div>
            </div>
            <div className="space-y-4">
              {reservations.sort((a,b) => isAfter(parseISO(a.date), parseISO(b.date)) ? 1 : -1).map(r => (
                <div key={r.id} className="bg-zinc-900/30 p-8 rounded-[2.5rem] border border-zinc-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-md hover:border-zinc-700 transition-all">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="text-[9px] bg-amber-500 text-black px-3 py-1 rounded-full font-black uppercase tracking-tighter">{RESOURCES.find(res => res.id === r.resourceId)?.name}</span>
                      <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-1"><Check size={12} className="text-pink-600" /> {r.programCode}</span>
                    </div>
                    <h3 className="text-2xl font-black text-white mb-4 italic tracking-tighter uppercase">{r.programName}</h3>
                    <div className="text-[11px] text-zinc-500 uppercase font-black p-5 bg-black/60 rounded-[1.5rem] border border-zinc-800/50 shadow-inner">
                      <div className="flex justify-between items-center"><span className="text-zinc-700">{t.name}</span><span className="text-zinc-200">{r.userName}</span></div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-800/50"><span className="text-zinc-700">{t.date}</span><span className="text-zinc-200">{format(parseISO(r.date), 'dd/MM/yyyy')} — {r.startTime}</span></div>
                    </div>
                  </div>
                  <button onClick={() => deleteReservation(r.id)} className="p-6 bg-zinc-800 text-red-700 hover:bg-red-600 hover:text-white rounded-[2rem] transition-all shadow-lg active:scale-95">
                    <Trash2 size={28} className="pointer-events-none" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'new-reservation' && (
        <div className="flex-1 flex flex-col min-h-screen">
          <Header lang={lang} title={editingReservation ? t.edit_reservation : t.new_reservation} onBack={() => { setView('calendar'); setEditingReservation(null); }} />
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const data = {
              userName: fd.get('userName') as string,
              programName: fd.get('programName') as string,
              resourceId: fd.get('resourceId') as string,
              date: fd.get('date') as string,
              startTime: fd.get('startTime') as string,
              duration: parseInt(fd.get('duration') as string),
              programCode: editingReservation?.programCode || generateProgramCode(fd.get('programName') as string)
            };
            if (editingReservation) updateReservation(editingReservation.id, data);
            else addReservation(data, fd.get('recurrence') as RecurrenceType);
          }} className="p-8 space-y-8 max-w-2xl mx-auto w-full animate-in slide-in-from-bottom-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-zinc-900/30 p-8 rounded-[3rem] border border-zinc-900 shadow-2xl">
              <div className="space-y-2"><label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">{t.name}</label><input name="userName" defaultValue={editingReservation?.userName} required className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-pink-600 font-bold text-white transition-all" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">{t.program}</label><input name="programName" defaultValue={editingReservation?.programName} required className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-pink-600 font-bold text-white transition-all" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">{t.resource}</label><select name="resourceId" defaultValue={editingReservation?.resourceId || selectedSlot?.resourceId} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-pink-600 font-black appearance-none text-pink-500 uppercase">{RESOURCES.map(r => <option key={r.id} value={r.id} className="bg-zinc-950 text-white">{r.name}</option>)}</select></div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">{t.date}</label><input name="date" type="date" defaultValue={editingReservation?.date || selectedSlot?.date} required className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-pink-600 font-bold text-white" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">{t.time}</label><input name="startTime" type="time" step="1800" defaultValue={editingReservation?.startTime || selectedSlot?.time} required className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-pink-600 font-bold text-white" /></div>
              <div className="space-y-2"><label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">{t.duration}</label><select name="duration" defaultValue={editingReservation?.duration || 60} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl outline-none focus:border-pink-600 font-bold appearance-none text-white">{[30, 60, 90, 120, 150, 180, 240, 300, 360, 480].map(m => <option key={m} value={m}>{m} min</option>)}</select></div>
              {!editingReservation && <div className="space-y-2 md:col-span-2"><label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest ml-1">{t.recurrence}</label><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{(['none', 'weekly', 'biweekly', 'monthly'] as RecurrenceType[]).map(rt => (
                <label key={rt} className="flex items-center gap-2 bg-zinc-950 p-4 rounded-2xl border border-zinc-800 cursor-pointer hover:border-pink-600 transition-all has-[:checked]:border-pink-600 has-[:checked]:bg-pink-600/10">
                  <input type="radio" name="recurrence" value={rt} defaultChecked={rt === 'none'} className="hidden" />
                  <span className="text-[10px] font-black uppercase tracking-tighter text-center w-full">{t[rt as keyof typeof t] as string}</span>
                </label>
              ))}</div></div>}
            </div>
            <div className="flex gap-6 pt-4"><button type="button" onClick={() => { setView('calendar'); setEditingReservation(null); }} className="flex-1 py-6 bg-zinc-950 border-2 border-zinc-900 rounded-[2rem] font-black uppercase text-zinc-600 hover:text-white hover:border-zinc-700 transition-all shadow-xl">{t.cancel}</button><button type="submit" className="flex-1 py-6 bg-pink-600 rounded-[2rem] font-black uppercase text-white shadow-[0_0_40px_rgba(230,0,126,0.3)] hover:shadow-[0_0_60px_rgba(230,0,126,0.5)] active:scale-95 transition-all">{t.save}</button></div>
          </form>
        </div>
      )}

      {showCodeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/98 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-zinc-950 border-4 border-pink-600 p-12 rounded-[4rem] max-w-sm w-full text-center space-y-12 shadow-[0_0_150px_rgba(230,0,126,0.6)] animate-in zoom-in duration-500 delay-100">
            <div className="flex justify-center"><div className="bg-pink-600 p-8 rounded-full shadow-[0_0_40px_rgba(230,0,126,1)] animate-bounce"><Check size={56} className="text-white pointer-events-none" /></div></div>
            <div className="space-y-4">
              <h2 className="text-3xl font-black uppercase text-white tracking-[0.2em] italic">{t.save_code}</h2>
              <p className="text-pink-500 text-[11px] uppercase font-black tracking-widest">KUDEATU ZURE ERRESERBAK KODE HONEKIN</p>
            </div>
            <div className="bg-black p-10 rounded-[2.5rem] border-2 border-zinc-800 shadow-inner group hover:border-pink-500/50 transition-all">
              <span className="text-4xl font-black font-mono tracking-[0.3em] text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">{showCodeModal}</span>
            </div>
            <button onClick={() => { setShowCodeModal(null); setView('calendar'); }} className="w-full bg-pink-600 text-white py-7 rounded-[2.5rem] font-black text-2xl shadow-2xl active:scale-95 hover:bg-pink-500 transition-all tracking-widest">{t.accept}</button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;

