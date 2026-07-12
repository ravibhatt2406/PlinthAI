'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plot, FloorPlan, AdvisorMessage } from '../lib/types';
import { CostSummary } from '../lib/costEstimator';
import { db } from '../lib/db';
import { Send, User, Bot, Trash2, Loader2 } from 'lucide-react';

interface ConstructionAdvisorProps {
  plot: Plot;
  floorPlans: FloorPlan[];
  costSummary: CostSummary;
}

const CHIPS = [
  "Is my kitchen in the correct Vastu location?",
  "Show me the concrete materials breakdown (Cement/Steel).",
  "Explain the architectural flow of the layouts.",
  "How are the labor man-days calculated?"
];

export default function ConstructionAdvisor({ plot, floorPlans, costSummary }: ConstructionAdvisorProps) {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chat history from DB
  useEffect(() => {
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const history = await db.getAdvisorMessages(plot.id);
        if (history.length === 0) {
          // Inital greeting
          const welcome = await db.saveAdvisorMessage(
            plot.id,
            'assistant',
            `Namaste! I am your grounded **PLINTH AI Construction Advisor**. 

I have fully ingested your plot parameters, the **${floorPlans.length}-floor blueprint**, and the **₹${costSummary.grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}** CPWD-based construction cost estimate.

I will answer any questions about room dimensions, Vastu compliance alignment, material quantities, or suggestions for layout adjustments. Ask me anything!`
          );
          setMessages([welcome]);
        } else {
          setMessages(history);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadHistory();
  }, [plot.id, floorPlans.length, costSummary.grandTotal]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    setLoading(true);

    try {
      // 1. Save user message to database & update state
      const userMsg = await db.saveAdvisorMessage(plot.id, 'user', text);
      setMessages(prev => [...prev, userMsg]);

      // 2. Query Gemini chat gateway
      const res = await fetch('/api/advisor-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          plot,
          floorPlans,
          costSummary
        })
      });

      if (!res.ok) {
        throw new Error('Chat API error');
      }

      const data = await res.json();
      
      // 3. Save assistant reply to database & update state
      const assistantMsg = await db.saveAdvisorMessage(plot.id, 'assistant', data.content);
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errMsg: AdvisorMessage = {
        id: 'error-msg',
        plot_id: plot.id,
        role: 'assistant',
        content: '⚠️ I apologize, but I encountered an error communicating with the core LLM node. Please check your network or try again.',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (confirm('Are you sure you want to delete all messages for this session?')) {
      await db.clearAdvisorMessages(plot.id);
      const greeting = await db.saveAdvisorMessage(
        plot.id,
        'assistant',
        "History cleared. I have reloaded the initial project blueprint variables. Ask me any design or material estimation question!"
      );
      setMessages([greeting]);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[520px] overflow-hidden">
      {/* Chat Header */}
      <div className="bg-[#0F1D36] text-white px-6 py-4 flex justify-between items-center border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-terracotta animate-pulse-soft" />
          <div>
            <h3 className="font-bold text-sm tracking-wider font-architectural">AI CONSTRUCTION ADVISOR</h3>
            <p className="text-[10px] text-slate-400">Strictly Grounded in CPWD Dataset & Plan Metrics</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          className="text-slate-400 hover:text-red-400 p-1.5 hover:bg-white/5 rounded-lg transition cursor-pointer"
          title="Clear Chat History"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Window */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
        {loadingHistory ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-terracotta" />
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${
                  isUser ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-blueprint/10 border-blueprint/20 text-blueprint'
                }`}>
                  {isUser ? <User className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5 text-terracotta" />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  isUser 
                    ? 'bg-blueprint text-white rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm shadow-slate-100'
                }`}>
                  <p className="whitespace-pre-line prose prose-sm max-w-none">
                    {m.content}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {loading && (
          <div className="flex gap-3 max-w-[85%] mr-auto">
            <div className="w-8 h-8 rounded-full bg-blueprint/10 border border-blueprint/20 flex items-center justify-center shrink-0">
              <Bot className="w-4.5 h-4.5 text-terracotta animate-pulse" />
            </div>
            <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Suggested Prompt Chips */}
      <div className="px-6 py-2 border-t border-slate-100 bg-slate-50 flex gap-2 overflow-x-auto scrollbar-none py-3">
        {CHIPS.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(chip)}
            disabled={loading}
            className="text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 hover:border-slate-300 hover:text-slate-700 rounded-full px-3 py-1 shrink-0 transition cursor-pointer select-none disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input panel */}
      <div className="px-6 py-4 border-t border-slate-100 bg-white flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
          placeholder="Ask about materials list, BHK alterations, Vastu placement..."
          disabled={loading}
          className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:border-terracotta focus:ring-1 focus:ring-terracotta text-sm bg-slate-50/50"
        />
        <button
          onClick={() => handleSend(input)}
          disabled={loading || !input.trim()}
          className="p-2.5 bg-terracotta hover:bg-terracotta-hover text-white rounded-xl shadow transition cursor-pointer flex items-center justify-center disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
