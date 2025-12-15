import React, { useState } from 'react';
import { Search, Info, ZoomIn, Loader2, ArrowLeftRight, Clipboard, Shield } from 'lucide-react';

// Configuration for API Calls
const LLM_API_KEY = ""; // Canvas will provide this if empty
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${LLM_API_KEY}`;
const MAX_RETRIES = 5;

// Utility function for exponential backoff
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const LevisArchive = () => {
  const [view, setView] = useState('front'); // 'front' or 'back'
  const [modelYear, setModelYear] = useState('1933'); // '1933' or '2025'
  const [activeHotspot, setActiveHotspot] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  
  // State for LLM generation
  const [summary, setSummary] = useState(null);
  const [summarySources, setSummarySources] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryError, setSummaryError] = useState(null);

  const thesis = {
    title: "The 1933 Transition Spec",
    content: "The 1930’s Levi’s 501 represents a pivotal transition from purely utilitarian workwear to an emerging cultural symbol. It blended rugged function designed for miners and laborers of the 19th Century American West, with the first hints of 20th Century denim style. Levi’s hybrid construction: belt loops paired with suspender buttons, early selvedge design details, and Depression-era material efficiency, captures a moment when necessity drove innovation. This model set the blueprint for the contemporary five-pocket jean and established the visual language that still defines denim today."
  };

  const hotspots = {
    '1933': {
      front: [
        { id: 'suspender', x: 25, y: 5, label: 'Suspender Buttons (Original)', text: 'Original spec included zinc buttons for suspenders, essential before belts became the standard for workers.' },
        { id: 'fly', x: 48, y: 15, label: 'Donut Button Fly', text: 'Standard "donut" style buttons used during the 1930s era.' },
        { id: 'crotchRivet', x: 50, y: 36, label: 'Crotch Rivet', text: 'The exposed crotch rivet was still standard issue in 1933 to reinforce the fly base.' },
        { id: 'rivet', x: 75, y: 12, label: 'Copper Rivets', text: 'Exposed copper rivets at pocket corners for maximum durability.' },
      ],
      back: [
        { id: 'cinch', x: 50, y: 6, label: 'Buckle-Back Cinch', text: 'The classic adjustment method of the era, placed high on the yoke.' },
        { id: 'patch', x: 75, y: 4, label: 'Two Horse Patch', text: 'The guarantee of quality. Note the absence of any extra tabs underneath in the original run.' },
        { id: 'tab', x: 78, y: 18, label: 'The Red Tab', text: 'AUTHENTICITY MARKER: The red tab was introduced in 1936, but often associated with this era of "Golden Age" denim. Its presence here signifies the definitive brand identifier.' },
        { id: 'arcuate', x: 25, y: 20, label: 'Single Needle Arcuate', text: 'Decorative stitching applied with a single needle machine, often resulting in slightly irregular, unique curves.' },
      ]
    },
    '2025': {
      front: [
        { id: 'suspender', x: 25, y: 5, label: 'Suspender Buttons (Repro)', text: 'The 2025 reproduction faithfully recreates the suspender buttons, though often with modern alloy materials.' },
        { id: 'fly', x: 48, y: 15, label: 'Reproduction Fly', text: 'Modern recreation of the donut button style.' },
        { id: 'rivet', x: 75, y: 12, label: 'LVC Copper Rivets', text: 'Copper rivets are present, replicating the 1933 spec.' },
        { id: 'fit_25', x: 85, y: 90, label: 'Heritage Fit', text: 'Maintains the wide, anti-fit block of the 1933 original, unlike modern tapered cuts.' },
      ],
      back: [
        { id: 'cinch', x: 50, y: 6, label: 'Buckle-Back (Repro)', text: 'The cinch is retained for historical accuracy in the 2025 LVC iteration.' },
        { id: 'whitetab_25', x: 78, y: 10, label: 'The "White Tab" Issue', text: 'DISCREPANCY: The 2025 iteration features a white tear-away tab under the leather patch, a modern manufacturing detail not present on originals.' },
        { id: 'missing_tab', x: 78, y: 18, label: 'Missing Red Tab', text: 'HISTORICAL INACCURACY: The 2025 reproduction notably lacks the Red Tab on the pocket, a detail often omitted in modern "1933" specific reproductions due to trademark or dating specifics (Red Tab officially starts 1936).' },
        { id: 'arcuate_25', x: 25, y: 20, label: 'Arcuate (Modern Stitch)', text: 'While simulating the shape, modern machines produce a cleaner, more uniform stitch than the handmade look of 1933.' },
      ]
    }
  };

  const generateSummary = async () => {
    setIsGenerating(true);
    setSummary(null);
    setSummaryError(null);
    setSummarySources([]);

    const userQuery = `Using external sources, summarize the key historical features and discrepancies of the Levi's 1933 501 jeans compared to the 2025 reproduction model. Focus on the white tab and red tab differences.`;
    const systemPrompt = "You are a specialized fashion archivist. Provide a concise 3-sentence comparison. Highlight the 'White Tab' anomaly and the missing Red Tab on the 2025 reproduction.";

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        tools: [{ "google_search": {} }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                if (response.status === 429 && i < MAX_RETRIES - 1) {
                    await delay(Math.pow(2, i) * 1000);
                    continue;
                }
                throw new Error(`API error: ${response.statusText}`);
            }

            const result = await response.json();
            const candidate = result.candidates?.[0];

            if (candidate && candidate.content?.parts?.[0]?.text) {
                setSummary(candidate.content.parts[0].text);
                if (candidate.groundingMetadata?.groundingAttributions) {
                    setSummarySources(candidate.groundingMetadata.groundingAttributions
                        .map(a => ({ uri: a.web?.uri, title: a.web?.title }))
                        .filter(s => s.uri)
                        .slice(0, 3));
                }
                break;
            }
        } catch (err) {
            if (i === MAX_RETRIES - 1) setSummaryError(`Failed to generate: ${err.message}`);
        }
    }
    setIsGenerating(false);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        console.log('Copied to clipboard');
    }).catch(err => {
        console.error('Failed to copy', err);
    });
  };

  const renderJeansSVG = (year, currentView) => {
    // Both 1933 and 2025 Repro use the SAME wide fit, raw denim look
    const denimFill = 'url(#denim)';
    const stitchingColor = year === '1933' ? '#d4af37' : '#e0c060'; // Slightly brighter on new
    const rivetColor = '#b87333';
    const hardwareFill = '#c0c0c0';
    const patchColor = '#8b4513';

    // Shared wide leg paths for BOTH versions
    const legLPath = "M60 40 L40 120 L30 520 L95 520 L110 130 L110 40 Z";
    const legRPath = "M240 40 L260 120 L270 520 L205 520 L190 130 L190 40 Z";
    const pocketPath = "M70 110 L130 110 L125 180 L100 195 L75 180 Z";

    const frontPath = currentView === 'front' ? 'block' : 'none';
    const backPath = currentView === 'back' ? 'block' : 'none';

    return (
      <svg viewBox="0 0 300 550" className="w-full h-full drop-shadow-xl">
        <defs>
          <pattern id="denim" patternUnits="userSpaceOnUse" width="4" height="4">
             <path d="M0,4 l4,-4 M-1,1 l2,-2 M3,5 l2,-2" stroke="#202a3b" strokeWidth="1" opacity="0.3"/>
          </pattern>
          <rect id="denimLight" width="100%" height="100%" fill="#364156" opacity="0.9" />
        </defs>

        {/* --- FRONT VIEW --- */}
        <g style={{ display: frontPath }} fill="#364156" stroke="#1a1a1a" strokeWidth="1.5">
          <path d={legLPath} fill={denimFill}/>
          <path d={legRPath} fill={denimFill}/>
          <path d="M60 40 Q150 45 240 40 L240 65 Q150 70 60 65 Z" fill="#3e4a61" /> {/* Waistband */}
          
          <g stroke={stitchingColor} strokeWidth="1" strokeDasharray="3,1" fill="none">
            <path d="M62 62 Q150 67 238 62" />
            <path d="M62 43 Q150 48 238 43" />
            <path d="M150 65 L150 180" />
            <path d="M150 180 Q120 170 150 200" />
            <path d="M40 120 Q60 140 110 130" />
            <path d="M260 120 Q240 140 190 130" />
            <path d="M210 75 L210 100 L250 100 L250 75 Z" />
          </g>

          <g fill={rivetColor} stroke="#5c3a1a" strokeWidth="0.5">
             <circle cx="45" cy="122" r="2" />
             <circle cx="110" cy="130" r="2" />
             <circle cx="255" cy="122" r="2" />
             <circle cx="190" cy="130" r="2" />
             <circle cx="210" cy="75" r="2" />
             <circle cx="250" cy="75" r="2" />
             {/* Crotch Rivet on both since 2025 is a repro of 1933 */}
             <circle cx="150" cy="200" r="2.5" fill={rivetColor} stroke="#5c3a1a" strokeWidth="0.5" />
          </g>

          {/* Suspender Buttons on BOTH (Repro feature) */}
          <g fill={hardwareFill} stroke="#666" strokeWidth="0.5">
            <circle cx="80" cy="52" r="3.5" />
            <circle cx="110" cy="52" r="3.5" />
            <circle cx="190" cy="52" r="3.5" />
            <circle cx="220" cy="52" r="3.5" />
          </g>

          <g fill={hardwareFill} stroke="#888" strokeWidth="1">
            <circle cx="150" cy="52" r="4" fill={hardwareFill} />
            <text x="148" y="55" fontSize="4" fill="#666">O</text>
            <circle cx="145" cy="90" r="3" fill={hardwareFill} opacity="0.7"/>
            <circle cx="145" cy="120" r="3" fill={hardwareFill} opacity="0.7"/>
            <circle cx="145" cy="150" r="3" fill={hardwareFill} opacity="0.7"/>
          </g>

          <rect x="70" y="40" width="8" height="25" fill="#364156" stroke={stitchingColor} strokeWidth="0.5"/>
          <rect x="222" y="40" width="8" height="25" fill="#364156" stroke={stitchingColor} strokeWidth="0.5"/>
          <rect x="30" y="490" width="65" height="30" fill="#e0e0e0" stroke="#1a1a1a"/>
          <rect x="205" y="490" width="65" height="30" fill="#e0e0e0" stroke="#1a1a1a"/>
          <path d="M92 490 L92 520" stroke="red" strokeWidth="2" />
          <path d="M267 490 L267 520" stroke="red" strokeWidth="2" />
        </g>

        {/* --- BACK VIEW --- */}
        <g style={{ display: backPath }} fill="#364156" stroke="#1a1a1a" strokeWidth="1.5">
           {/* Legs - Wide Fit for BOTH */}
           <path d="M60 40 L40 120 L30 520 L95 520 L110 160 L150 200 L190 160 L205 520 L270 520 L260 120 L240 40 Z" fill={denimFill}/>
           
           <path d="M60 65 L150 100 L240 65 L240 40 Q150 45 60 40 Z" fill="#3e4a61" />

           <path d={pocketPath} fill="url(#denimLight)" stroke={stitchingColor} strokeWidth="1"/>
           <path d={pocketPath.replace(/70|130|125|100|75/g, (m) => parseInt(m) + 100)} fill="url(#denimLight)" stroke={stitchingColor} strokeWidth="1"/>

           <path d="M75 130 Q90 120 100 145 Q110 120 125 130" stroke={stitchingColor} strokeWidth="1.5" fill="none" />
           <path d="M175 130 Q190 120 200 145 Q210 120 225 130" stroke={stitchingColor} strokeWidth="1.5" fill="none" />

           {/* Cinch Back on BOTH (Repro feature) */}
           <g>
             <path d="M100 55 L200 55 L200 65 L100 65 Z" fill="#2a3b55" />
             <rect x="140" y="52" width="20" height="16" fill={hardwareFill} stroke="#666" rx="2" />
             <line x1="150" y1="52" x2="150" y2="68" stroke="#666" strokeWidth="2" />
           </g>

           {/* Leather Patch */}
           <rect x="195" y="42" width="40" height="25" fill={patchColor} stroke="#5c3a1a" />
           <text x="200" y="55" fontSize="4" fill="#f0d0b0" fontFamily="serif">LEVI STRAUSS</text>
           
           {/* THE WHITE TAB ISSUE (Only on 2025) */}
           {year === '2025' && (
              <rect x="210" y="67" width="10" height="4" fill="#f8f8f8" stroke="#ccc" />
           )}

           {/* Red Tab - Only on 1933, Missing on 2025 Repro */}
           {year === '1933' && (
             <g>
               <rect x="228" y="125" width="4" height="10" fill="#cc0000" stroke="none" />
               <text x="229" y="132" fontSize="3" fill="white" writingMode="tb" className="rotate-90">LEVI</text>
             </g>
           )}

           {/* Suspender Buttons Back on BOTH */}
           <g fill={hardwareFill} stroke="#666">
             <circle cx="130" cy="52" r="3.5" />
             <circle cx="170" cy="52" r="3.5" />
           </g>

           {/* Rivets on BOTH */}
           <g fill={rivetColor}>
             <circle cx="70" cy="110" r="1.5" />
             <circle cx="130" cy="110" r="1.5" />
             <circle cx="170" cy="110" r="1.5" />
             <circle cx="230" cy="110" r="1.5" />
           </g>
        </g>

        {hotspots[year][currentView].map((spot) => (
          <g key={spot.id} 
              onClick={() => setActiveHotspot(activeHotspot === spot.id ? null : spot.id)}
              className="cursor-pointer hover:opacity-100 transition-opacity"
              style={{ opacity: activeHotspot === spot.id ? 1 : 0.7 }}>
            <line x1={spot.x + "%"} y1={spot.y + "%"} x2={spot.x > 50 ? "90%" : "10%"} y2={spot.y + "%"} stroke="#8b3a1a" strokeWidth="1" strokeDasharray="2,2" />
            <circle cx={spot.x + "%"} cy={spot.y + "%"} r="8" fill="rgba(255,0,0,0.1)" stroke="#8b3a1a" strokeWidth="1" className="animate-pulse" />
            <circle cx={spot.x + "%"} cy={spot.y + "%"} r="2" fill="#8b3a1a" />
          </g>
        ))}
      </svg>
    );
  };

  return (
    <div className="min-h-screen bg-[#e8dec0] text-[#2c241b] font-mono flex flex-col items-center p-4 md:p-8 relative overflow-hidden select-none">
      <div className="fixed inset-0 pointer-events-none opacity-20 z-0" 
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}>
      </div>

      <header className="w-full max-w-4xl z-10 border-b-2 border-[#2c241b] pb-4 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-xl md:text-3xl font-bold tracking-tighter" style={{ fontFamily: '"Playfair Display", serif' }}>Inside the 1930’s Levi’s 501: American Design Heritage</h1>
          <h2 className={`text-md md:text-xl italic mt-1 ${modelYear === '1933' ? 'text-[#8b3a1a]' : 'text-[#2a3b55]'} transition-colors duration-300`}>
             <span className="font-bold">{modelYear}</span> <span className="text-xs uppercase tracking-widest">{modelYear === '1933' ? 'Original Spec' : '2025 Reproduction'}</span>
          </h2>
        </div>
        <div className="flex flex-col items-end">
             <div className="hidden md:block text-right text-xs leading-tight opacity-70">
              <p>ARCHIVAL PLATE NO. 33-B</p>
              <p>RAW LOOMSTATE DENIM</p>
             </div>
             <button
                 onClick={() => {
                     setModelYear(modelYear === '1933' ? '2025' : '1933');
                     setActiveHotspot(null);
                     setSummary(null);
                     setSummarySources([]);
                 }}
                 className={`mt-2 px-3 py-1 text-xs md:text-sm font-bold border rounded-lg flex items-center gap-2 transition-all duration-300 
                   ${modelYear === '1933' ? 'bg-[#8b3a1a] text-white hover:bg-[#a04e28]' : 'bg-[#2a3b55] text-white hover:bg-[#3d506b]'}`}
             >
                 <ArrowLeftRight size={14} />
                 Switch to {modelYear === '1933' ? '2025 REPRODUCTION' : '1933 ORIGINAL'}
             </button>
        </div>
      </header>

      <main className="w-full max-w-4xl z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 flex-grow">
        <div className="lg:col-span-2 relative bg-[#f4f1e1] border border-[#d1c7a8] shadow-[2px_2px_10px_rgba(0,0,0,0.1)] p-6 min-h-[500px] flex items-center justify-center overflow-hidden">
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none opacity-10" 
                  style={{ backgroundImage: 'linear-gradient(#2c241b 1px, transparent 1px), linear-gradient(90deg, #2c241b 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            </div>
          )}
          <div className="absolute top-10 right-10 w-32 h-32 bg-[#dcb] rounded-full blur-3xl opacity-40"></div>
          <div className="absolute top-4 left-4 flex gap-2">
             <button onClick={() => {setView('front'); setActiveHotspot(null);}} className={`px-4 py-2 text-xs font-bold border transition-colors ${view === 'front' ? 'bg-[#2c241b] text-[#f4f1e1]' : 'border-[#2c241b] hover:bg-[#e6dcc5]'}`}>FRONT VIEW</button>
             <button onClick={() => {setView('back'); setActiveHotspot(null);}} className={`px-4 py-2 text-xs font-bold border transition-colors ${view === 'back' ? 'bg-[#2c241b] text-[#f4f1e1]' : 'border-[#2c241b] hover:bg-[#e6dcc5]'}`}>BACK VIEW</button>
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
             <button onClick={() => setShowGrid(!showGrid)} className="p-2 border border-[#2c241b] hover:bg-[#e6dcc5]" title="Toggle Grid"><ZoomIn size={16}/></button>
          </div>
          <div className="relative w-full max-w-md h-full transition-all duration-500 ease-in-out">
            {renderJeansSVG(modelYear, view)}
          </div>
          <div className="absolute bottom-4 left-4 text-xs font-mono text-gray-500">
             FIG 1.0 - {view.toUpperCase()} ELEVATION ({modelYear})
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-[#fdfbf7] p-4 border-l-4 border-[#8b3a1a] shadow-sm relative">
            <h3 className="font-bold text-md mb-2 flex items-center gap-2">
              <Info size={16} className="text-[#8b3a1a]" />
              Historical Thesis
            </h3>
            <p className="text-xs leading-relaxed text-justify opacity-90">
              {thesis.content}
            </p>
          </div>

          <div className="flex-grow bg-[#2c241b] text-[#f4f1e1] p-4 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Shield size={100} />
             </div>
             
             <h3 className="text-[10px] uppercase tracking-[0.2em] mb-4 text-[#d4af37] border-b border-[#d4af37]/30 pb-1">
               Technical Specifications - {modelYear}
             </h3>
             
             {activeHotspot ? (
               <div className="animate-in fade-in duration-300">
                 {hotspots[modelYear][view].map(h => h.id === activeHotspot && (
                   <div key={h.id}>
                     <h4 className="text-xl font-serif mb-1 text-[#e6dcc5]">{h.label}</h4>
                     <p className="text-xs leading-relaxed opacity-80 border-l-2 border-[#d4af37] pl-3">{h.text}</p>
                     
                     <div className="mt-4 bg-white/5 p-3 rounded border border-white/10 text-center">
                       <div className="text-[10px] uppercase opacity-50 mb-1">Component Visualization</div>
                       <div className="h-20 w-full flex items-center justify-center">
                          {h.id.includes('tab') && (modelYear === '1933' ? 
                              <div className="w-4 h-12 bg-red-700 relative"><span className="absolute -right-4 top-4 text-[8px] text-white -rotate-90">LEVI</span></div> : 
                              <div className="text-xs text-gray-400 border border-gray-600 p-2">MISSING ON 2025 REPRO</div>
                          )}
                          {h.id === 'whitetab_25' && (
                              <div className="flex flex-col items-center">
                                 <div className="w-12 h-6 bg-[#a07a50] border border-[#5c3a1a]">PATCH</div>
                                 <div className="w-12 h-2 bg-white border border-gray-400 mt-0.5">WHITE TAB</div>
                              </div>
                          )}
                          {h.id.includes('cinch') && ( 
                              <div className="w-20 h-8 border-4 border-gray-400 rounded-lg bg-gray-600"></div>
                          )}
                          {h.id.includes('rivet') && ( 
                              <div className="w-8 h-8 rounded-full bg-[#b87333] border-2 border-[#5c3a1a] shadow-lg">EXPOSED</div>
                          )}
                          {h.id.includes('suspender') && ( 
                              <div className="w-8 h-8 rounded-full bg-gray-300 border border-gray-500 flex items-center justify-center text-xs">BUTTON</div>
                          )}
                          {!['tab','cinch','rivet','suspender','crotchRivet','whitetab_25','missing_tab'].includes(h.id) && <Search className="opacity-50"/>}
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center opacity-40 text-center">
                 <Search size={40} className="mb-3" />
                 <p className="text-xs">Select a highlighted point on the technical drawing to inspect construction details.</p>
               </div>
             )}
          </div>
           {/* Summary Generator Box */}
          <div className="bg-[#fdfbf7] p-4 border-t-4 border-[#2a3b55] shadow-sm relative">
            <h3 className="font-bold text-md mb-3 flex items-center gap-2">
              Generate Archival Summary (LLM)
            </h3>
            <p className="text-xs leading-relaxed mb-3 opacity-80">
                Instantly generate a concise, shareable summary of the **{modelYear}** model's history.
            </p>
            
            <button
                onClick={generateSummary}
                disabled={isGenerating}
                className={`w-full px-3 py-1.5 text-xs font-bold border rounded-lg flex items-center justify-center gap-2 transition-all duration-300 
                  ${isGenerating ? 'bg-gray-400 text-gray-700' : 'bg-[#2a3b55] text-white hover:bg-[#3d506b]'}`}
            >
                {isGenerating ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        Generating Summary...
                    </>
                ) : (
                    'Generate Shareable Summary'
                )}
            </button>

            {(summary || summaryError) && (
                <div className="mt-3 p-2 border border-gray-300 bg-white shadow-inner">
                    <div className="flex justify-between items-center mb-1 border-b pb-0.5">
                        <h4 className="text-[10px] uppercase tracking-wider font-bold text-[#8b3a1a]">LLM Output</h4>
                         <button onClick={() => copyToClipboard(summary)} className="text-[10px] text-[#2a3b55] hover:underline flex items-center gap-1 disabled:opacity-50" disabled={!summary}>
                            <Clipboard size={10}/> Copy Text
                         </button>
                    </div>
                    {summary ? (
                        <>
                            <p className="text-xs italic leading-snug">{summary}</p>
                            {summarySources.length > 0 && (
                                <div className="mt-1 pt-1 border-t border-gray-100">
                                    <h5 className="text-[9px] font-bold uppercase text-gray-500 mb-0.5">Sources Cited:</h5>
                                    <ul className="list-disc list-inside space-y-0.5">
                                        {summarySources.map((s, index) => (
                                            <li key={index} className="text-[9px] text-gray-600 truncate" title={s.title}>
                                                <a href={s.uri} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.title || s.uri}</a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-xs text-red-600 font-bold">{summaryError}</p>
                    )}
                </div>
            )}
          </div>
        </div>
      </main>
      <footer className="w-full max-w-4xl mt-6 text-[10px] opacity-60 flex justify-between uppercase tracking-widest">
        <div>Proprietary & Confidential</div>
        <div>Scale 1:10 • Ref {modelYear}-501</div>
      </footer>
    </div>
  );
};

export default LevisArchive;
