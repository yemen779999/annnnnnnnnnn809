"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Globe,
  Code2,
  Download,
  ShieldCheck,
  Zap,
  Play,
  Smartphone,
  Tablet,
  Monitor,
  Columns,
  Palette,
  Type,
  ImageIcon,
  Check,
  Copy,
  FolderOpen,
  MessageSquare,
  Send,
  User,
  LogOut,
  ExternalLink,
  Lock,
  Activity,
  CheckCircle2,
  XCircle,
  X
} from "lucide-react";
import { translations, Language } from "@/lib/translations";
import { ExtractedSiteData, REFERENCE_PRESETS } from "@/lib/extractor";

function cleanCodeToHtml(code: string): string {
  if (!code) return "<div class='p-12 text-center text-neutral-500'>No component loaded.</div>";

  // Extract JSX body from functional component
  const returnMatch = code.match(/return\s*\(\s*([\s\S]*?)\s*\);?\s*\}/);
  let jsx = returnMatch ? returnMatch[1] : code;

  // Simple JSX to HTML conversions for sandbox preview
  jsx = jsx
    .replace(/className=/g, "class=")
    .replace(/{\/\*[\s\S]*?\*\/}/g, "") // remove comments
    .replace(/<([A-Z][a-zA-Z0-9]+)\s+className="([^"]*)"\s*\/>/g, '<i data-lucide="$1" class="$2"></i>')
    .replace(/<([A-Z][a-zA-Z0-9]+)\s*\/>/g, '<i data-lucide="$1"></i>')
    .replace(/style=\{\{\s*backgroundColor:\s*['"]([^'"]+)['"]\s*\}\}/g, 'style="background-color: $1;"')
    .replace(/{\`([^`]+)\`}/g, "$1")
    .replace(/\$\{[^}]+\}/g, "");

  return jsx;
}

export default function Home() {
  const [lang, setLang] = useState<Language>("en");
  const t = translations[lang];

  // Auth & Session
  const [user, setUser] = useState<{ id: string; email: string; name: string; role: "admin" | "user" } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // App Creation Mode
  const [creationMode, setCreationMode] = useState<"url" | "prompt">("url");
  const [targetUrl, setTargetUrl] = useState(REFERENCE_PRESETS.linear.url);
  const [promptText, setPromptText] = useState("A modern dark-themed SaaS landing page for an AI code assistant with feature comparison cards and pricing tiers");
  const [promptStyle, setPromptStyle] = useState("modern");

  // State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusMessage, setStatusMessage] = useState(t.statusReady);
  const [extractedData, setExtractedData] = useState<ExtractedSiteData | null>(REFERENCE_PRESETS.linear);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"preview" | "split" | "editor" | "tokens" | "projects">("preview");
  const [viewportMode, setViewportMode] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // AI Copilot Chat Drawer
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: "user" | "ai"; text: string; time: string }[]>([
    { sender: "ai", text: "Hello! I can modify your website code, adjust styles, add sections, or fix layout issues. What would you like to update?", time: "Just now" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatWorking, setIsChatWorking] = useState(false);

  // Projects
  const [savedProjects, setSavedProjects] = useState<any[]>([]);
  const [currentProjectTitle, setCurrentProjectTitle] = useState(REFERENCE_PRESETS.linear.title);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Modals
  const [qualityModalOpen, setQualityModalOpen] = useState(false);
  const [qualityData, setQualityData] = useState<any>(null);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminMetrics, setAdminMetrics] = useState<any>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // Sandbox iframe reference
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const updateSandbox = (codeToRun: string) => {
    if (!iframeRef.current) return;

    const htmlBody = cleanCodeToHtml(codeToRun);
    // Transform React component into a runnable sandboxed HTML document
    const sandboxHtml = `<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"/>
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 3px; }
  </style>
</head>
<body class="bg-neutral-950 text-neutral-100 min-h-full">
  <div id="root">
    ${htmlBody}
  </div>
  <script>
    if (window.lucide) {
      lucide.createIcons();
    }
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('button, a');
      if (btn && btn.tagName === 'A' && btn.getAttribute('href') === '#') {
        e.preventDefault();
      }
    });
  </script>
</body>
</html>`;

    iframeRef.current.srcdoc = sandboxHtml;
  };

  const handleRebuildFromData = async (dataToRebuild: ExtractedSiteData) => {
    setIsGenerating(true);
    setStatusMessage(t.btnGenerating);

    try {
      const res = await fetch("/api/clone/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "clone", siteData: dataToRebuild }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation error");

      setGeneratedCode(json.code);
      setQualityData(json.quality);
      setStatusMessage(t.statusRebuilt);
    } catch (err: any) {
      alert(`Synthesis error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadPreset = async (presetKey: string) => {
    setIsAnalyzing(true);
    setStatusMessage(t.btnAnalyzing);

    try {
      const res = await fetch("/api/clone/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: presetKey }),
      });
      const json = await res.json();
      if (json.success) {
        setExtractedData(json.data);
        setTargetUrl(json.data.url);
        setCurrentProjectTitle(json.data.title);
        await handleRebuildFromData(json.data);
      }
    } catch (err: any) {
      console.warn("Preset error:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const loadUserProjects = async () => {
    try {
      const pRes = await fetch("/api/clone/projects");
      if (pRes.ok) {
        const pData = await pRes.json();
        setSavedProjects(pData.projects || []);
      }
    } catch (err) {
      console.warn("Failed to load projects:", err);
    }
  };

  // Fetch session on load
  useEffect(() => {
    let mounted = true;
    async function loadInitialData() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (mounted && data.authenticated && data.user) {
          setUser(data.user);
          loadUserProjects();
        }
      } catch (err) {
        console.warn("Session check failed:", err);
      }
    }
    loadInitialData();
    return () => {
      mounted = false;
    };
  }, []);

  // Update sandbox preview whenever generatedCode changes
  useEffect(() => {
    if (generatedCode) {
      updateSandbox(generatedCode);
    }
  }, [generatedCode]);
  // 1. Analyze Website URL
  const handleAnalyzeUrl = async () => {
    if (!targetUrl.trim()) return;
    setIsAnalyzing(true);
    setStatusMessage(t.btnAnalyzing);

    try {
      const res = await fetch("/api/clone/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: targetUrl.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to analyze website.");
      }

      setExtractedData(json.data);
      setCurrentProjectTitle(json.data.title || "Cloned Website");
      setStatusMessage(t.statusExtracted);

      // Automatically synthesize component
      await handleRebuildFromData(json.data);
    } catch (err: any) {
      alert(`Analysis failed: ${err.message}`);
      setStatusMessage("Error analyzing target website.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 3. Generate from Text Prompt
  const handleGenerateFromPrompt = async () => {
    if (!promptText.trim()) return;
    setIsGenerating(true);
    setStatusMessage(t.btnGenerating);

    try {
      const res = await fetch("/api/clone/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "prompt",
          prompt: promptText.trim(),
          style: promptStyle,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Prompt generation error");

      setGeneratedCode(json.code);
      setCurrentProjectTitle(`Site: ${promptText.slice(0, 30)}`);
      setQualityData(json.quality);
      setStatusMessage(t.statusRebuilt);
    } catch (err: any) {
      alert(`Generation error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 4. Copilot Chat modification
  const handleSendCopilotChat = async () => {
    if (!chatInput.trim() || !generatedCode) return;
    const userPrompt = chatInput.trim();
    setChatInput("");

    const newMsgs = [
      ...chatMessages,
      { sender: "user" as const, text: userPrompt, time: "Just now" },
    ];
    setChatMessages(newMsgs);
    setIsChatWorking(true);

    try {
      const res = await fetch("/api/clone/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCode: generatedCode,
          userInstruction: userPrompt,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Copilot failed to modify code.");

      setGeneratedCode(json.updatedCode);
      setChatMessages([
        ...newMsgs,
        {
          sender: "ai",
          text: json.explanation || "Successfully updated component code.",
          time: "Just now",
        },
      ]);
    } catch (err: any) {
      setChatMessages([
        ...newMsgs,
        {
          sender: "ai",
          text: `Error applying modification: ${err.message}`,
          time: "Just now",
        },
      ]);
    } finally {
      setIsChatWorking(false);
    }
  };

  // 5. Save Project
  const handleSaveProject = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!generatedCode) return;

    try {
      const res = await fetch("/api/clone/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentProjectId || undefined,
          title: currentProjectTitle,
          sourceUrl: targetUrl,
          type: creationMode,
          designTokens: extractedData?.designTokens || {},
          assets: extractedData?.assets || {},
          code: generatedCode,
          qualityScore: qualityData?.overallScore || 85,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setCurrentProjectId(json.project.id);
      alert("Project saved successfully!");
      loadUserProjects();
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  // 6. Download ZIP
  const handleExportZip = async () => {
    if (!generatedCode) return;

    try {
      const res = await fetch("/api/clone/export-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: currentProjectTitle,
          code: generatedCode,
        }),
      });

      if (!res.ok) throw new Error("ZIP packaging failed.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentProjectTitle.replace(/[^a-zA-Z0-9-_]/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // 7. Quality Audit Modal
  const handleOpenQualityModal = async () => {
    if (!generatedCode) return;
    try {
      const res = await fetch("/api/clone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteData: extractedData,
          code: generatedCode,
        }),
      });
      const json = await res.json();
      if (json.quality) {
        setQualityData(json.quality);
      }
    } catch (err) {
      console.warn("Quality check error:", err);
    }
    setQualityModalOpen(true);
  };

  // 8. Admin Console Modal
  const handleOpenAdminModal = async () => {
    try {
      const res = await fetch("/api/admin/metrics");
      const json = await res.json();
      if (res.ok) {
        setAdminMetrics(json);
        setAdminModalOpen(true);
      } else {
        alert(json.error || "Admin access denied.");
      }
    } catch (err: any) {
      alert("Failed to load admin metrics.");
    }
  };

  // 9. Run Automated Test Suite
  const handleRunTestSuite = async () => {
    setIsRunningTests(true);
    setTestModalOpen(true);
    try {
      const res = await fetch("/api/test/suite");
      const json = await res.json();
      setTestResults(json);
    } catch (err: any) {
      setTestResults({ success: false, summary: "Failed to connect to test suite endpoint." });
    } finally {
      setIsRunningTests(false);
    }
  };

  // Auth Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: authEmail,
          password: authPassword,
          name: authName,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Authentication failed.");

      setUser(json.user);
      setAuthModalOpen(false);
      setAuthPassword("");
      loadUserProjects();
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setSavedProjects([]);
  };

  const copyToClipboard = (text: string, type: "hex" | "code") => {
    navigator.clipboard.writeText(text);
    if (type === "hex") {
      setCopiedHex(text);
      setTimeout(() => setCopiedHex(null), 1500);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1500);
    }
  };

  return (
    <div
      dir={lang === "ar" ? "rtl" : "ltr"}
      className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-600 selection:text-white"
    >
      {/* ==================== 1. TOP BAR ==================== */}
      <header className="border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md sticky top-0 z-40 px-6 py-3">
        <div className="max-w-[1700px] mx-auto flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">{t.appTitle}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">v2.0 PRO</span>
              </div>
              <p className="text-xs text-neutral-400 hidden sm:block">{t.tagline}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2.5">
            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-neutral-300"
              title="Toggle Language"
            >
              <Globe className="w-3.5 h-3.5 text-neutral-400" />
              <span>{lang === "en" ? "العربية" : "English"}</span>
            </button>

            {/* Test Suite Runner Button */}
            <button
              onClick={handleRunTestSuite}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden md:inline">{t.testsRunner}</span>
            </button>

            {/* Quality Score Trigger */}
            {qualityData && (
              <button
                onClick={handleOpenQualityModal}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Score: {qualityData.overallScore}%</span>
              </button>
            )}

            {/* ZIP Download */}
            <button
              onClick={handleExportZip}
              disabled={!generatedCode}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.btnExportZip}</span>
            </button>

            {/* Save Project */}
            <button
              onClick={handleSaveProject}
              disabled={!generatedCode}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-40"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.btnSave}</span>
            </button>

            {/* Admin Console Trigger (Only visible if user role is admin) */}
            {user?.role === "admin" && (
              <button
                onClick={handleOpenAdminModal}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-500 text-white shadow-sm flex items-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t.btnAdmin}</span>
              </button>
            )}

            {/* User Session Profile Button */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
                <div className="text-right hidden lg:block">
                  <div className="text-xs font-bold text-white flex items-center gap-1">
                    <span>{user.name}</span>
                    {user.role === "admin" && (
                      <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                        ADMIN
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-neutral-400">{user.email}</div>
                </div>
                <button
                  onClick={handleLogout}
                  title={t.btnSignOut}
                  className="p-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-white transition-colors flex items-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-neutral-400" />
                <span>{t.btnAuth}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ==================== 2. CREATION CONTROL HERO ==================== */}
      <section className="border-b border-neutral-800/80 bg-neutral-900/40 px-6 py-5">
        <div className="max-w-[1700px] mx-auto space-y-4">
          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreationMode("url")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                creationMode === "url"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>{t.modeUrl}</span>
            </button>

            <button
              onClick={() => setCreationMode("prompt")}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                creationMode === "prompt"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{t.modePrompt}</span>
            </button>
          </div>

          {/* Creation Inputs */}
          {creationMode === "url" ? (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <div className="relative flex-1 w-full">
                  <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder={t.urlPlaceholder}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <button
                  onClick={handleAnalyzeUrl}
                  disabled={isAnalyzing || isGenerating}
                  className="w-full sm:w-auto px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all whitespace-nowrap"
                >
                  <Zap className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`} />
                  <span>{isAnalyzing ? t.btnAnalyzing : t.btnAnalyze}</span>
                </button>
              </div>

              {/* Benchmarks Presets Bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 pt-1">
                <span className="font-medium text-neutral-500">{t.presetTitle}</span>
                {Object.keys(REFERENCE_PRESETS).map((key) => (
                  <button
                    key={key}
                    onClick={() => handleLoadPreset(key)}
                    className="px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 font-medium transition-colors border border-neutral-700/50"
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch gap-2.5">
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder={t.promptPlaceholder}
                  rows={2}
                  className="flex-1 p-3 text-sm bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500 resize-none"
                />

                <div className="flex sm:flex-col justify-between gap-2">
                  <select
                    value={promptStyle}
                    onChange={(e) => setPromptStyle(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold bg-neutral-950 border border-neutral-800 rounded-xl text-neutral-300 focus:outline-none"
                  >
                    <option value="modern">Modern SaaS</option>
                    <option value="dark">Dark High-Tech</option>
                    <option value="minimal">Minimalist Luxury</option>
                    <option value="vibrant">Vibrant Neo-Pop</option>
                  </select>

                  <button
                    onClick={handleGenerateFromPrompt}
                    disabled={isGenerating}
                    className="px-6 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    <Sparkles className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
                    <span>{isGenerating ? t.btnGenerating : t.btnGeneratePrompt}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ==================== 3. MAIN WORKSPACE ==================== */}
      <main className="flex-1 flex flex-col max-w-[1700px] w-full mx-auto px-6 py-4 space-y-4">
        {/* Workspace Subheader & Viewport Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/60 pb-3">
          {/* View Mode Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-neutral-900 rounded-xl border border-neutral-800">
            <button
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "preview" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>{t.tabPreview}</span>
            </button>

            <button
              onClick={() => setActiveTab("split")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "split" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>{t.tabSplit}</span>
            </button>

            <button
              onClick={() => setActiveTab("editor")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "editor" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{t.tabEditor}</span>
            </button>

            <button
              onClick={() => setActiveTab("tokens")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "tokens" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{t.tabTokens}</span>
            </button>

            <button
              onClick={() => setActiveTab("projects")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "projects" ? "bg-neutral-800 text-white shadow-sm" : "text-neutral-400 hover:text-white"
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{t.tabProjects} ({savedProjects.length})</span>
            </button>
          </div>

          {/* Right Toolbar: Device Frames + Copilot Button */}
          <div className="flex items-center gap-3">
            {/* Responsive Viewport Switcher */}
            {(activeTab === "preview" || activeTab === "split") && (
              <div className="flex items-center gap-1 p-1 bg-neutral-900 rounded-lg border border-neutral-800">
                <button
                  onClick={() => setViewportMode("desktop")}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    viewportMode === "desktop" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                  title={t.deviceDesktop}
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewportMode("tablet")}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    viewportMode === "tablet" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                  title={t.deviceTablet}
                >
                  <Tablet className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewportMode("mobile")}
                  className={`p-1.5 rounded text-xs transition-colors ${
                    viewportMode === "mobile" ? "bg-neutral-800 text-white" : "text-neutral-400 hover:text-white"
                  }`}
                  title={t.deviceMobile}
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* AI Copilot Toggle Button */}
            <button
              onClick={() => setCopilotOpen(!copilotOpen)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 border ${
                copilotOpen
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30"
                  : "bg-neutral-900 text-neutral-300 border-neutral-800 hover:bg-neutral-800"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.btnCopilot}</span>
            </button>
          </div>
        </div>

        {/* View Content Panels */}
        <div className="flex-1 min-h-[600px] flex gap-4">
          {/* Main Display Area */}
          <div className="flex-1 flex flex-col bg-neutral-900/30 border border-neutral-800 rounded-2xl overflow-hidden relative">
            {/* VIEW A: LIVE PREVIEW */}
            {activeTab === "preview" && (
              <div className="flex-1 flex flex-col items-center justify-start p-4 bg-neutral-950 overflow-auto">
                <div
                  className={`transition-all duration-300 bg-neutral-950 border border-neutral-800 rounded-xl overflow-hidden shadow-2xl flex flex-col ${
                    viewportMode === "desktop"
                      ? "w-full max-w-[1440px] h-[780px]"
                      : viewportMode === "tablet"
                      ? "w-[768px] h-[780px]"
                      : "w-[375px] h-[720px]"
                  }`}
                >
                  {/* Browser Frame Header */}
                  <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
                      <span className="font-mono text-[11px] ml-2 text-neutral-400">{currentProjectTitle}</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-500">{viewportMode.toUpperCase()} SANDBOX</span>
                  </div>

                  {/* Sandboxed Iframe (Secured with sandbox="allow-scripts", zero access to host cookies/storage) */}
                  <iframe
                    ref={iframeRef}
                    sandbox="allow-scripts"
                    className="w-full flex-1 border-0 bg-neutral-950"
                    title="Live Sandboxed Preview"
                  />
                </div>
              </div>
            )}

            {/* VIEW B: SPLIT COMPARISON */}
            {activeTab === "split" && (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 bg-neutral-950 overflow-auto">
                {/* Left: Original Target Site Data Overview */}
                <div className="flex flex-col border border-neutral-800 rounded-xl bg-neutral-900/40 p-5 space-y-4 overflow-y-auto max-h-[750px]">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-indigo-400" />
                      <span>Original Website Specification</span>
                    </h3>
                    {extractedData?.url && (
                      <a href={extractedData.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 flex items-center gap-1 hover:underline">
                        <span>Open Live URL</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {extractedData ? (
                    <div className="space-y-4 text-xs">
                      <div>
                        <span className="text-neutral-500 uppercase font-bold text-[10px]">Title & Description:</span>
                        <h4 className="text-sm font-bold text-neutral-200 mt-1">{extractedData.title}</h4>
                        <p className="text-neutral-400 mt-1 leading-relaxed">{extractedData.description || "No meta description extracted."}</p>
                      </div>

                      <div>
                        <span className="text-neutral-500 uppercase font-bold text-[10px]">Primary Color Tokens:</span>
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {extractedData.designTokens.primaryColors.map((hex, i) => (
                            <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900 border border-neutral-800">
                              <span className="w-3 h-3 rounded" style={{ backgroundColor: hex }}></span>
                              <span className="font-mono text-neutral-300">{hex}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-neutral-500 uppercase font-bold text-[10px]">Detected Hierarchy:</span>
                        <ul className="space-y-1.5 mt-2">
                          {extractedData.sections.map((sec, i) => (
                            <li key={i} className="p-2 rounded bg-neutral-900/60 border border-neutral-800 flex items-center justify-between">
                              <span className="font-semibold text-neutral-200">{sec.name}</span>
                              <span className="font-mono text-[10px] text-neutral-500">&lt;{sec.tag}&gt;</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <p className="text-neutral-500 text-xs">No website data loaded. Inspect a URL above to compare.</p>
                  )}
                </div>

                {/* Right: Reconstructed Cloned Sandbox */}
                <div className="flex flex-col border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950 max-h-[750px]">
                  <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
                    <span className="font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Reconstructed Component Preview</span>
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">NEXT.JS 16 REACT</span>
                  </div>
                  <iframe
                    ref={iframeRef}
                    sandbox="allow-scripts"
                    className="w-full flex-1 border-0 bg-neutral-950 min-h-[600px]"
                    title="Split Comparison Reconstructed"
                  />
                </div>
              </div>
            )}

            {/* VIEW C: CODE EDITOR */}
            {activeTab === "editor" && (
              <div className="flex-1 flex flex-col p-4 bg-neutral-950 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                  <div className="flex items-center gap-2 text-xs text-neutral-400">
                    <Code2 className="w-4 h-4 text-indigo-400" />
                    <span className="font-mono text-neutral-200">src/app/page.tsx</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400">TypeScript React</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(generatedCode, "code")}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 transition-colors flex items-center gap-1.5 border border-neutral-800"
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? "Copied" : "Copy Code"}</span>
                    </button>

                    <button
                      onClick={() => updateSandbox(generatedCode)}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>{t.btnRunCode}</span>
                    </button>
                  </div>
                </div>

                <div className="flex-1 relative">
                  <textarea
                    value={generatedCode}
                    onChange={(e) => setGeneratedCode(e.target.value)}
                    spellCheck={false}
                    className="w-full h-full min-h-[550px] p-4 text-xs font-mono bg-neutral-900/70 border border-neutral-800 rounded-xl text-neutral-200 focus:outline-none focus:border-indigo-500 leading-relaxed resize-none selection:bg-indigo-600 selection:text-white"
                  />
                </div>
              </div>
            )}

            {/* VIEW D: DESIGN TOKENS & ASSETS */}
            {activeTab === "tokens" && (
              <div className="flex-1 p-6 bg-neutral-950 overflow-y-auto space-y-6">
                {extractedData ? (
                  <>
                    {/* Colors */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Palette className="w-4 h-4 text-indigo-400" />
                        <span>{t.colorTokens}</span>
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                        {extractedData.designTokens.primaryColors.map((hex, i) => (
                          <div
                            key={i}
                            onClick={() => copyToClipboard(hex, "hex")}
                            className="p-3 rounded-xl border border-neutral-800 bg-neutral-900 cursor-pointer hover:border-neutral-700 transition-all space-y-2 group"
                          >
                            <div className="w-full h-12 rounded-lg shadow-inner" style={{ backgroundColor: hex }}></div>
                            <div className="flex items-center justify-between text-xs font-mono">
                              <span className="text-neutral-300 font-bold">{hex}</span>
                              {copiedHex === hex ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-500 opacity-0 group-hover:opacity-100" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Fonts */}
                    <div className="space-y-3 pt-4 border-t border-neutral-800">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Type className="w-4 h-4 text-indigo-400" />
                        <span>{t.fontTokens}</span>
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {extractedData.designTokens.fonts.map((f, i) => (
                          <div key={i} className="p-4 rounded-xl border border-neutral-800 bg-neutral-900 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-neutral-500">Font Family</span>
                            <h4 className="text-base font-bold text-white" style={{ fontFamily: f }}>{f}</h4>
                            <p className="text-xs text-neutral-400" style={{ fontFamily: f }}>The quick brown fox jumps over the lazy dog.</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Extracted Images */}
                    <div className="space-y-3 pt-4 border-t border-neutral-800">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-400" />
                        <span>{t.assetVault} ({extractedData.assets.images.length} images)</span>
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {extractedData.assets.images.map((img, i) => (
                          <div key={i} className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900 group">
                            <div className="h-28 bg-neutral-950 flex items-center justify-center overflow-hidden">
                              <img src={img.src} alt={img.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            </div>
                            <div className="p-2 text-[10px] text-neutral-400 truncate flex items-center justify-between">
                              <span className="truncate">{img.alt}</span>
                              <button onClick={() => copyToClipboard(img.src, "hex")} className="text-indigo-400 hover:underline">Copy URL</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-neutral-500 text-xs">No tokens extracted yet. Enter a URL above.</p>
                )}
              </div>
            )}

            {/* VIEW E: SAVED PROJECTS */}
            {activeTab === "projects" && (
              <div className="flex-1 p-6 bg-neutral-950 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-indigo-400" />
                    <span>My Saved Projects ({savedProjects.length})</span>
                  </h3>
                  {!user && (
                    <span className="text-xs text-amber-400">Log in to sync projects across devices</span>
                  )}
                </div>

                {savedProjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedProjects.map((p) => (
                      <div key={p.id} className="p-4 rounded-xl border border-neutral-800 bg-neutral-900 space-y-3 flex flex-col justify-between">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white truncate">{p.title}</h4>
                          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                            <span className="capitalize">{p.type}</span>
                            <span>·</span>
                            <span>Score: {p.qualityScore}%</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                          <button
                            onClick={() => {
                              setCurrentProjectId(p.id);
                              setCurrentProjectTitle(p.title);
                              setGeneratedCode(p.code);
                              setActiveTab("preview");
                            }}
                            className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                          >
                            Open in Studio
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 space-y-2 text-neutral-500 text-xs">
                    <FolderOpen className="w-8 h-8 mx-auto text-neutral-600" />
                    <p>No projects saved yet. Click &quot;Save Project&quot; in the header to store your builds.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Collapsible AI Copilot Drawer */}
          {copilotOpen && (
            <div className="w-80 lg:w-96 flex flex-col border border-neutral-800 bg-neutral-900/95 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">
              {/* Copilot Header */}
              <div className="p-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">{t.btnCopilot}</h4>
                    <span className="text-[10px] text-emerald-400 font-mono">GEMINI 3.8 FLASH</span>
                  </div>
                </div>
                <button onClick={() => setCopilotOpen(false)} className="text-neutral-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Message History */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 text-xs">
                {chatMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col space-y-1 ${
                      msg.sender === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`p-3 rounded-xl max-w-[90%] leading-relaxed ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-neutral-800 text-neutral-200 rounded-bl-none border border-neutral-700/50"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-neutral-500 px-1">{msg.time}</span>
                  </div>
                ))}

                {isChatWorking && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 font-mono p-2">
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing AST & refactoring code...</span>
                  </div>
                )}
              </div>

              {/* Quick Suggestion Chips */}
              <div className="p-2 border-t border-neutral-800 bg-neutral-950/60 flex flex-wrap gap-1.5 text-[10px]">
                <button
                  onClick={() => setChatInput("Add a 3-tier pricing table section with monthly toggle")}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  + Pricing Table
                </button>
                <button
                  onClick={() => setChatInput("Change brand accent colors to dark indigo and violet")}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  Change Theme Colors
                </button>
                <button
                  onClick={() => setChatInput("Add customer testimonials with avatar stars")}
                  className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                >
                  + Testimonials
                </button>
              </div>

              {/* Copilot Input */}
              <div className="p-3 border-t border-neutral-800 bg-neutral-900 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendCopilotChat()}
                  placeholder={t.copilotPlaceholder}
                  className="flex-1 px-3 py-2 text-xs bg-neutral-950 border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSendCopilotChat}
                  disabled={isChatWorking || !chatInput.trim()}
                  className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ==================== 4. FOOTER ==================== */}
      <footer className="border-t border-neutral-800/80 px-6 py-4 mt-auto">
        <div className="max-w-[1700px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{statusMessage}</span>
          </div>
          <p>{t.footerText}</p>
        </div>
      </footer>

      {/* ==================== 5. AUTH MODAL ==================== */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">
                {authMode === "login" ? t.authTitleLogin : t.authTitleRegister}
              </h3>
              <p className="text-xs text-neutral-400">
                Secure multi-user session management with bcrypt hashing.
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
                {authError}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3 text-xs">
              {authMode === "register" && (
                <div className="space-y-1">
                  <label className="text-neutral-400 font-medium">{t.authName}</label>
                  <input
                    type="text"
                    required
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">{t.authEmail}</label>
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-neutral-400 font-medium">{t.authPassword}</label>
                <input
                  type="password"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 mt-2"
              >
                {authLoading ? "Authenticating..." : authMode === "login" ? t.authSubmitLogin : t.authSubmitRegister}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-neutral-800">
              <button
                onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
                className="text-xs text-indigo-400 hover:underline"
              >
                {authMode === "login" ? t.authSwitchToRegister : t.authSwitchToLogin}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 6. QUALITY AUDIT MODAL ==================== */}
      {qualityModalOpen && qualityData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-2xl relative">
            <button onClick={() => setQualityModalOpen(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xl">
                {qualityData.overallScore}%
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t.qualityTitle}</h3>
                <p className="text-xs text-neutral-400">Algorithmic fidelity scoring against target tokens and DOM specifications.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-400">Color Parity</span>
                  <span className="text-emerald-400 font-bold">{qualityData.metrics.colorParity}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${qualityData.metrics.colorParity}%` }}></div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-400">Structural Tags</span>
                  <span className="text-indigo-400 font-bold">{qualityData.metrics.structuralCoverage}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${qualityData.metrics.structuralCoverage}%` }}></div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-400">Typography Scale</span>
                  <span className="text-purple-400 font-bold">{qualityData.metrics.typographyScore}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="h-full bg-purple-500" style={{ width: `${qualityData.metrics.typographyScore}%` }}></div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <div className="flex justify-between font-medium">
                  <span className="text-neutral-400">Mobile Responsiveness</span>
                  <span className="text-amber-400 font-bold">{qualityData.metrics.responsiveReadiness}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                  <div className="h-full bg-amber-500" style={{ width: `${qualityData.metrics.responsiveReadiness}%` }}></div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Detailed Verification Findings:</h4>
              <ul className="space-y-1 text-xs text-neutral-400">
                {qualityData.details.map((d: string, i: number) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 7. ADMIN DASHBOARD MODAL ==================== */}
      {adminModalOpen && adminMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto relative">
            <button onClick={() => setAdminModalOpen(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{t.adminTitle}</h3>
                <p className="text-xs text-neutral-400">Restricted administrative telemetry, user directories, and model status.</p>
              </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-neutral-500 uppercase font-bold text-[10px]">Total Users</span>
                <div className="text-2xl font-black text-white">{adminMetrics.metrics.totalUsers}</div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-neutral-500 uppercase font-bold text-[10px]">Total Projects</span>
                <div className="text-2xl font-black text-indigo-400">{adminMetrics.metrics.totalProjects}</div>
              </div>

              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <span className="text-neutral-500 uppercase font-bold text-[10px]">Database Architecture</span>
                <div className="text-xs font-bold text-emerald-400 truncate mt-2">{adminMetrics.metrics.databaseMode}</div>
              </div>
            </div>

            {/* AI Model Status */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-neutral-300">Google Gemini Engine</span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${adminMetrics.metrics.gemini.verified ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"}`}>
                  {adminMetrics.metrics.gemini.verified ? "VERIFIED ONLINE" : "OFFLINE / FALLBACK"}
                </span>
              </div>
              <p className="text-neutral-400 text-xs">{adminMetrics.metrics.gemini.statusMessage}</p>
            </div>

            {/* User Directory */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-neutral-300">Registered Accounts ({adminMetrics.users?.length || 0})</h4>
              <div className="border border-neutral-800 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-neutral-950 text-[10px] text-neutral-500 uppercase font-bold">
                    <tr>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800 text-neutral-300">
                    {adminMetrics.users?.map((u: any) => (
                      <tr key={u.id} className="hover:bg-neutral-800/40">
                        <td className="p-2.5 font-bold">{u.name}</td>
                        <td className="p-2.5 font-mono text-neutral-400">{u.email}</td>
                        <td className="p-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${u.role === "admin" ? "bg-purple-500/20 text-purple-300" : "bg-neutral-800 text-neutral-400"}`}>
                            {u.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2.5 text-neutral-500 text-[11px]">{new Date(u.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 8. AUTOMATED TEST SUITE MODAL ==================== */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <button onClick={() => setTestModalOpen(false)} className="absolute top-4 right-4 text-neutral-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Automated Technical Verification Suite</h3>
                <p className="text-xs text-neutral-400">Verifying live endpoints: Auth, bcrypt, SSRF shield, project isolation, and ZIP exporter.</p>
              </div>
            </div>

            {isRunningTests ? (
              <div className="py-12 text-center space-y-3">
                <Activity className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                <p className="text-sm font-semibold text-neutral-300">{t.runningTests}</p>
              </div>
            ) : testResults ? (
              <div className="space-y-4">
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${testResults.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                  <span>{testResults.summary}</span>
                  <span className="font-mono text-[10px]">{new Date(testResults.timestamp).toLocaleTimeString()}</span>
                </div>

                <div className="space-y-2.5">
                  {testResults.results?.map((r: any, i: number) => (
                    <div key={i} className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start gap-3">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-white">{r.test}</h4>
                          <span className="font-mono text-[10px] text-neutral-500">{r.durationMs}ms</span>
                        </div>
                        <p className="text-xs text-neutral-400">{r.details}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleRunTestSuite}
                  className="w-full py-2.5 text-xs font-bold rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                >
                  Rerun Test Suite
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
