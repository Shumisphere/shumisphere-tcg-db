import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Palette, Layout, Type, Save, RotateCcw, ImageIcon, Monitor, Box, Sparkles } from 'lucide-react';

export const DesignEngine: React.FC = () => {
  const { config, updateConfig, resetToDefault } = useTheme();
  const [localTheme, setLocalTheme] = useState(config.theme);
  const [localLayout, setLocalLayout] = useState(config.layout);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'presets' | 'colors' | 'typography' | 'tokens'>('presets');

  const handleSave = async () => {
    setIsSaving(true);
    await updateConfig({ theme: localTheme, layout: localLayout });
    setIsSaving(false);
  };

  const fonts = [
    "Outfit", "JetBrains Mono", "Inter", "Space Grotesk", "Orbitron", "Roboto Mono", "Syncopate"
  ];

  const presets = [
    {
      name: "Cyber Intelligence (Default)",
      theme: {
        primaryColor: "#6366f1",
        backgroundColor: "#0a0a0b",
        headerColor: "#0e0e0f",
        sidebarColor: "#0c0c0d",
        borderColor: "#2a2a2c",
        accentColor: "#6366f1",
        successColor: "#00ff9d",
        fontSans: "Outfit",
        fontMono: "JetBrains Mono",
        cardRadius: "0.75rem",
        glowIntensity: "0.5"
      }
    },
    {
      name: "Monochrome Pro",
      theme: {
        primaryColor: "#ffffff",
        backgroundColor: "#050505",
        headerColor: "#000000",
        sidebarColor: "#000000",
        borderColor: "#1a1a1a",
        accentColor: "#ffffff",
        successColor: "#ffffff",
        fontSans: "Inter",
        fontMono: "JetBrains Mono",
        cardRadius: "0px",
        glowIntensity: "0"
      }
    },
    {
      name: "Neon Nights",
      theme: {
        primaryColor: "#ff00ff",
        backgroundColor: "#050005",
        headerColor: "#100010",
        sidebarColor: "#080008",
        borderColor: "#300030",
        accentColor: "#00ffff",
        successColor: "#ffff00",
        fontSans: "Space Grotesk",
        fontMono: "Orbitron",
        cardRadius: "1rem",
        glowIntensity: "0.8"
      }
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Action Bar */}
      <div className="flex items-center justify-between bg-brand-header border border-brand-border p-4 rounded-xl sticky top-20 z-40 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-brand-accent/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-brand-accent" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Platform Design Engine</h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase">V1.0.0 / System Properties</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={resetToDefault}
            className="px-4 py-2 text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-widest flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="px-6 py-2 bg-brand-accent hover:opacity-90 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-brand-accent/20 flex items-center gap-2"
          >
            {isSaving ? "Saving..." : <Save className="w-3.5 h-3.5" />}
            Commit Design
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        {/* Controls */}
        <div className="xl:col-span-8 space-y-6">
          <div className="flex items-center gap-2 bg-[#0e0e11] p-2 rounded-xl border border-brand-border overflow-x-auto no-scrollbar">
            {[
              { id: 'presets', label: 'Presets', icon: Sparkles },
              { id: 'colors', label: 'Chroma Engine', icon: Palette },
              { id: 'typography', label: 'Typography', icon: Type },
              { id: 'tokens', label: 'Tokens', icon: Box },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                  ? 'bg-brand-accent text-white shadow-lg' 
                  : 'text-gray-500 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Presets */}
          {activeTab === 'presets' && (
          <section className="bg-brand-header border border-brand-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-4 border-b border-brand-border bg-white/[0.02] flex items-center gap-2 font-bold text-[10px] uppercase text-gray-400">
              <Sparkles className="w-3.5 h-3.5" />
              Intelligence Presets
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {presets.map(p => (
                <button
                  key={p.name}
                  onClick={() => setLocalTheme(p.theme)}
                  className="p-4 rounded-xl bg-black border border-brand-border hover:border-brand-accent transition-all text-left"
                >
                  <div className="text-[10px] font-bold text-white mb-2">{p.name}</div>
                  <div className="flex gap-1.5">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.theme.backgroundColor }} />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.theme.primaryColor }} />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.theme.accentColor }} />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.theme.successColor }} />
                  </div>
                </button>
              ))}
            </div>
          </section>
          )}

          {/* Color Palette */}
          {activeTab === 'colors' && (
          <section className="bg-brand-header border border-brand-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-4 border-b border-brand-border bg-white/[0.02] flex items-center gap-2 font-bold text-[10px] uppercase text-gray-400">
              <Palette className="w-3.5 h-3.5" />
              Chroma Engine
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: "Background", key: "backgroundColor" },
                { label: "Header", key: "headerColor" },
                { label: "Sidebar", key: "sidebarColor" },
                { label: "Border", key: "borderColor" },
                { label: "Accent", key: "accentColor" },
                { label: "Primary", key: "primaryColor" },
                { label: "Success", key: "successColor" },
              ].map(color => (
                <div key={color.key} className="space-y-2">
                  <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">{color.label}</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={localTheme[color.key as keyof typeof localTheme]} 
                      onChange={e => setLocalTheme({...localTheme, [color.key]: e.target.value})}
                      className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                    />
                    <input 
                      type="text" 
                      value={localTheme[color.key as keyof typeof localTheme]} 
                      onChange={e => setLocalTheme({...localTheme, [color.key]: e.target.value})}
                      className="bg-black border border-brand-border rounded px-2 py-1 text-[10px] font-mono text-gray-400 w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          )}

          {/* Typography */}
          {activeTab === 'typography' && (
          <section className="bg-brand-header border border-brand-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-4 border-b border-brand-border bg-white/[0.02] flex items-center gap-2 font-bold text-[10px] uppercase text-gray-400">
              <Type className="w-3.5 h-3.5" />
              Typography Engine
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Main Interface Font</label>
                <div className="grid grid-cols-2 gap-2">
                  {fonts.map(f => (
                    <button
                      key={f}
                      onClick={() => setLocalTheme({...localTheme, fontSans: f})}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                        localTheme.fontSans === f 
                        ? "bg-brand-accent border-brand-accent text-white" 
                        : "bg-black border-brand-border text-gray-500 hover:text-gray-300"
                      }`}
                      style={{ fontFamily: f }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Technical/Mono Font</label>
                <div className="grid grid-cols-2 gap-2">
                  {fonts.map(f => (
                    <button
                      key={f}
                      onClick={() => setLocalTheme({...localTheme, fontMono: f})}
                      className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                        localTheme.fontMono === f 
                        ? "bg-brand-accent border-brand-accent text-white" 
                        : "bg-black border-brand-border text-gray-500 hover:text-gray-300"
                      }`}
                      style={{ fontFamily: f }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>
          )}

          {/* Components */}
          {activeTab === 'tokens' && (
          <section className="bg-brand-header border border-brand-border rounded-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-4 border-b border-brand-border bg-white/[0.02] flex items-center gap-2 font-bold text-[10px] uppercase text-gray-400">
              <Box className="w-3.5 h-3.5" />
              Component Tokens
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Universal Border Radius</label>
                <input 
                  type="range" min="0" max="2" step="0.1" 
                  value={parseFloat(localTheme.cardRadius?.replace('rem', '') || "0.75")}
                  onChange={e => setLocalTheme({...localTheme, cardRadius: `${e.target.value}rem`})}
                  className="w-full h-1.5 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-accent"
                />
                <div className="text-[10px] font-mono text-gray-500 text-right">{localTheme.cardRadius}</div>
              </div>
              <div className="space-y-4">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Glow / Neon Intensity</label>
                <input 
                  type="range" min="0" max="1" step="0.05"
                  value={parseFloat(localTheme.glowIntensity || "0.5")}
                  onChange={e => setLocalTheme({...localTheme, glowIntensity: e.target.value})}
                  className="w-full h-1.5 bg-brand-border rounded-lg appearance-none cursor-pointer accent-brand-accent"
                />
                <div className="text-[10px] font-mono text-gray-500 text-right">{localTheme.glowIntensity} ALPHA</div>
              </div>
              <div className="space-y-4 md:col-span-2">
                <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Style Guide Background Image (URL)</label>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="https://example.com/style-guide-bg.jpg"
                    value={localTheme.backgroundImage || ""} 
                    onChange={e => setLocalTheme({...localTheme, backgroundImage: e.target.value})}
                    className="bg-black border border-brand-border rounded px-3 py-2 text-[10px] font-mono text-gray-400 w-full focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              </div>
            </div>
          </section>
          )}
        </div>

        {/* Live Preview */}
        <div className="xl:col-span-4 space-y-8">
          <div className="bg-brand-header border border-brand-border rounded-xl overflow-hidden sticky top-24 shadow-2xl">
            <div className="p-4 border-b border-brand-border bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-[10px] uppercase text-gray-400">
                <Monitor className="w-3.5 h-3.5" />
                Live Preview
              </div>
              <span className="text-[8px] bg-brand-accent/20 text-brand-accent px-1.5 py-0.5 rounded font-bold uppercase">Real-Time</span>
            </div>
            <div className="p-8 space-y-6" style={{ 
              backgroundColor: localTheme.backgroundColor, 
              fontFamily: localTheme.fontSans,
              color: '#e0e0e0' 
            }}>
              {/* Preview Header */}
              <div className="p-3 border rounded-lg" style={{ backgroundColor: localTheme.headerColor, borderColor: localTheme.borderColor }}>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: `linear-gradient(135deg, ${localTheme.primaryColor}, ${localTheme.accentColor})` }} />
                  <div className="text-[10px] font-bold uppercase tracking-tight" style={{ color: 'white' }}>Lottery <span style={{ color: localTheme.accentColor }}>Intelligence</span></div>
                </div>
              </div>

              {/* Preview Card */}
              <div className="p-4 bg-black border rounded-xl space-y-3" style={{ borderColor: localTheme.borderColor, borderRadius: localTheme.cardRadius }}>
                <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest opacity-60" style={{ color: localTheme.accentColor }}>
                  <ImageIcon className="w-2.5 h-2.5" />
                  <span>PREVIEW_STATION</span>
                </div>
                <h3 className="font-bold text-white uppercase text-xs leading-none">Intelligence Engine V1</h3>
                <div className="h-2 w-full bg-black/40 rounded-full" style={{ overflow: 'hidden' }}>
                    <div className="h-full w-2/3" style={{ backgroundColor: localTheme.successColor }} />
                </div>
                <button className="w-full py-2 rounded text-[9px] font-bold uppercase tracking-widest text-white transition-all" style={{ backgroundColor: localTheme.primaryColor, borderRadius: localTheme.cardRadius }}>
                  Commit Action
                </button>
              </div>

              {/* Preview List */}
              <div className="space-y-2">
                {[1,2].map(i => (
                  <div key={i} className="flex items-center justify-between p-3 bg-black/40 border border-brand-border rounded" style={{ borderColor: localTheme.borderColor, borderRadius: localTheme.cardRadius }}>
                    <div className="w-1/2 h-2 rounded bg-gray-800" />
                    <div className="w-8 h-8 rounded bg-gray-800" />
                  </div>
                ))}
              </div>

              <div className="text-[8px] font-mono opacity-50 uppercase tracking-widest text-center">
                Sync_Node: {localTheme.fontMono}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
