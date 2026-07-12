import { supabase } from './supabase';
import { Plot, FloorPlan, CostEstimateItem, AdvisorMessage } from './types';

// Helper to generate IDs when using localStorage fallback
const generateId = () => {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + '-' + Math.random().toString(36).substring(2, 15);
};

// Local storage key helpers
const KEYS = {
  PLOTS: 'plinth_plots',
  FLOOR_PLANS: 'plinth_floor_plans',
  COST_ESTIMATES: 'plinth_cost_estimates',
  ADVISOR_MESSAGES: 'plinth_advisor_messages',
};

// Generic local storage helpers
const getLocal = <T>(key: string): T[] => {
  if (typeof window === 'undefined') return [];
  const val = localStorage.getItem(key);
  return val ? JSON.parse(val) : [];
};

const setLocal = <T>(key: string, data: T[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
};

export const db = {
  // --- PLOT METHODS ---
  async savePlot(plotInput: Omit<Plot, 'id' | 'created_at'>): Promise<Plot> {
    if (supabase) {
      const { data, error } = await supabase
        .from('plots')
        .insert([plotInput])
        .select()
        .single();
      if (!error && data) return data as Plot;
      console.error('Supabase savePlot error:', error);
    }

    // Local fallback
    const plots = getLocal<Plot>(KEYS.PLOTS);
    const newPlot: Plot = {
      ...plotInput,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    plots.push(newPlot);
    setLocal(KEYS.PLOTS, plots);
    return newPlot;
  },

  async getPlot(id: string): Promise<Plot | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('plots')
        .select()
        .eq('id', id)
        .single();
      if (!error && data) return data as Plot;
      console.error('Supabase getPlot error:', error);
    }

    const plots = getLocal<Plot>(KEYS.PLOTS);
    return plots.find(p => p.id === id) || null;
  },

  // --- FLOOR PLAN METHODS ---
  async saveFloorPlans(floorPlans: Omit<FloorPlan, 'id' | 'created_at'>[]): Promise<FloorPlan[]> {
    if (supabase) {
      // Delete existing plans for this plot first to avoid duplicates
      if (floorPlans.length > 0) {
        await supabase.from('floor_plans').delete().eq('plot_id', floorPlans[0].plot_id);
      }
      
      const { data, error } = await supabase
        .from('floor_plans')
        .insert(floorPlans)
        .select();
      if (!error && data) return data as FloorPlan[];
      console.error('Supabase saveFloorPlans error:', error);
    }

    // Local fallback
    const localPlans = getLocal<FloorPlan>(KEYS.FLOOR_PLANS);
    const plotId = floorPlans[0]?.plot_id;
    const filtered = localPlans.filter(p => p.plot_id !== plotId);
    
    const newPlans: FloorPlan[] = floorPlans.map(plan => ({
      ...plan,
      id: generateId(),
      created_at: new Date().toISOString(),
    }));
    
    setLocal(KEYS.FLOOR_PLANS, [...filtered, ...newPlans]);
    return newPlans;
  },

  async getFloorPlans(plotId: string): Promise<FloorPlan[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('floor_plans')
        .select()
        .eq('plot_id', plotId)
        .order('floor_number', { ascending: true });
      if (!error && data) return data as FloorPlan[];
      console.error('Supabase getFloorPlans error:', error);
    }

    const localPlans = getLocal<FloorPlan>(KEYS.FLOOR_PLANS);
    return localPlans
      .filter(p => p.plot_id === plotId)
      .sort((a, b) => a.floor_number - b.floor_number);
  },

  // --- COST ESTIMATE METHODS ---
  async saveCostEstimates(plotId: string, estimates: Omit<CostEstimateItem, 'id'>[]): Promise<CostEstimateItem[]> {
    const formatted = estimates.map(e => ({ ...e, plot_id: plotId }));
    
    if (supabase) {
      // Clear existing estimates
      await supabase.from('cost_estimates').delete().eq('plot_id', plotId);
      
      const { data, error } = await supabase
        .from('cost_estimates')
        .insert(formatted)
        .select();
      if (!error && data) return data as CostEstimateItem[];
      console.error('Supabase saveCostEstimates error:', error);
    }

    // Local fallback
    const localEstimates = getLocal<CostEstimateItem>(KEYS.COST_ESTIMATES);
    const filtered = localEstimates.filter(e => e.plot_id !== plotId);
    
    const newEstimates = formatted.map(item => ({
      ...item,
      id: generateId()
    }));
    
    setLocal(KEYS.COST_ESTIMATES, [...filtered, ...newEstimates]);
    return newEstimates;
  },

  async getCostEstimates(plotId: string): Promise<CostEstimateItem[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('cost_estimates')
        .select()
        .eq('plot_id', plotId);
      if (!error && data) return data as CostEstimateItem[];
      console.error('Supabase getCostEstimates error:', error);
    }

    const localEstimates = getLocal<CostEstimateItem>(KEYS.COST_ESTIMATES);
    return localEstimates.filter(e => e.plot_id === plotId);
  },

  // --- ADVISOR MESSAGES METHODS ---
  async getAdvisorMessages(plotId: string): Promise<AdvisorMessage[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('advisor_messages')
        .select()
        .eq('plot_id', plotId)
        .order('created_at', { ascending: true });
      if (!error && data) return data as AdvisorMessage[];
      console.error('Supabase getAdvisorMessages error:', error);
    }

    const localMessages = getLocal<AdvisorMessage>(KEYS.ADVISOR_MESSAGES);
    return localMessages
      .filter(m => m.plot_id === plotId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },

  async saveAdvisorMessage(plotId: string, role: 'user' | 'assistant', content: string): Promise<AdvisorMessage> {
    const messageInput = { plot_id: plotId, role, content };
    
    if (supabase) {
      const { data, error } = await supabase
        .from('advisor_messages')
        .insert([messageInput])
        .select()
        .single();
      if (!error && data) return data as AdvisorMessage;
      console.error('Supabase saveAdvisorMessage error:', error);
    }

    // Local fallback
    const localMessages = getLocal<AdvisorMessage>(KEYS.ADVISOR_MESSAGES);
    const newMessage: AdvisorMessage = {
      ...messageInput,
      id: generateId(),
      created_at: new Date().toISOString()
    };
    localMessages.push(newMessage);
    setLocal(KEYS.ADVISOR_MESSAGES, localMessages);
    return newMessage;
  },

  async clearAdvisorMessages(plotId: string): Promise<void> {
    if (supabase) {
      const { error } = await supabase
        .from('advisor_messages')
        .delete()
        .eq('plot_id', plotId);
      if (error) console.error('Supabase clearAdvisorMessages error:', error);
    }

    const localMessages = getLocal<AdvisorMessage>(KEYS.ADVISOR_MESSAGES);
    const filtered = localMessages.filter(m => m.plot_id !== plotId);
    setLocal(KEYS.ADVISOR_MESSAGES, filtered);
  }
};
