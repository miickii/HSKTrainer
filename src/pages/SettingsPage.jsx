import React, { useState, useEffect } from "react";
import { 
  Mic, 
  Database, 
  Sun, 
  Moon,
  ChevronRight,
  Download,
  CloudOff,
  BookOpen,
  Wifi,
  Info,
  Check,
  AlertCircle,
  Server
} from "lucide-react";
import { settingsDB } from "../services/db";
import { SyncService } from "../services/sync-service";

export default function SettingsPage({ status, offlineMode, onSyncRequest, syncing, syncStatus }) {
  const [settings, setSettings] = useState({
    useHoldToSpeak: true,
    showWaveform: true,
    sensitivity: 1.5,
    autoSendDelay: 1000,
    hskFocus: [1, 2, 3],
    theme: 'light',
    dailyGoal: 10,
    notifications: true,
    darkMode: false
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHSKSelect, setShowHSKSelect] = useState(false);
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [storageUsage, setStorageUsage] = useState(null);
  
  // Server connection settings
  const [serverBaseUrl, setServerBaseUrl] = useState(() => {
    // Extract from localStorage if available, otherwise default
    const storedUrl = localStorage.getItem('serverUrl');
    if (storedUrl) {
      // Remove http:// or https:// to get just the base URL
      return storedUrl.replace(/^https?:\/\//, '');
    }
    return 'localhost:8000'; // Default value
  });
  
  // Handle sync if onSyncRequest is not provided
  const handleSyncRequest = () => {
    if (onSyncRequest) {
      onSyncRequest();
    } else {
      // Fallback implementation if onSyncRequest prop was not provided
      syncData();
    }
  };
  
  // Fallback sync implementation
  const syncData = async () => {
    if (offlineMode) return;
    
    try {
      setSaving(true);
      await SyncService.synchronizeVocabulary();
      alert("Vocabulary data synchronized successfully");
    } catch (error) {
      console.error("Error syncing vocabulary:", error);
      alert(`Failed to sync: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  // Save server URLs
  const saveServerUrls = () => {
    // Save both URLs
    localStorage.setItem('serverUrl', `https://${serverBaseUrl}`);
    localStorage.setItem('wsUrl', `wss://${serverBaseUrl}`);
    
    // Set flag to trigger sync after reload
    localStorage.setItem('needsSync', 'true');
    
    // Notify user
    alert('Server URLs updated. The app will now reload to apply changes.');
    
    // Reload the page to apply changes
    window.location.reload();
  };
  
  // Load settings
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        
        // Get all settings
        const savedSettings = await settingsDB.getAllSettings();
        
        // Merge with default settings
        setSettings(prev => ({
          ...prev,
          ...savedSettings
        }));
        
        // Estimate storage usage
        if (navigator.storage && navigator.storage.estimate) {
          const estimate = await navigator.storage.estimate();
          const usageInMB = Math.round(estimate.usage / (1024 * 1024) * 10) / 10;
          const quotaInMB = Math.round(estimate.quota / (1024 * 1024));
          const percentUsed = Math.round((estimate.usage / estimate.quota) * 100);
          
          setStorageUsage({
            usage: usageInMB,
            quota: quotaInMB,
            percent: percentUsed
          });
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading settings:", error);
        setLoading(false);
      }
    }
    
    loadSettings();
  }, []);
  
  // Save a setting
  const saveSetting = async (key, value) => {
    try {
      setSaving(true);
      
      // Save to IndexedDB
      await settingsDB.saveSetting(key, value);
      
      // Update local state
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));
      
      setSaving(false);
    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      setSaving(false);
    }
  };
  
  // Toggle boolean setting
  const toggleSetting = (key) => {
    saveSetting(key, !settings[key]);
  };
  
  // Toggle HSK level in focus array
  const toggleHSKLevel = (level) => {
    const hskFocus = [...settings.hskFocus];
    
    if (hskFocus.includes(level)) {
      // Remove level if already selected
      const newFocus = hskFocus.filter(l => l !== level);
      
      // Don't allow empty selection
      if (newFocus.length === 0) return;
      
      saveSetting('hskFocus', newFocus);
    } else {
      // Add level if not selected
      saveSetting('hskFocus', [...hskFocus, level].sort());
    }
  };
  
  // Format HSK focus for display
  const formatHSKFocus = () => {
    if (!settings.hskFocus || settings.hskFocus.length === 0) return "HSK 1";
    
    if (settings.hskFocus.length === 6) return "All Levels";
    
    return `HSK ${settings.hskFocus.join(", ")}`;
  };
  
  // Clear cache
  const clearCache = async () => {
    if (window.confirm("Are you sure you want to clear cached data? This won't affect your progress.")) {
      try {
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(
            cacheNames.map(name => caches.delete(name))
          );
          alert("Cache cleared successfully");
        }
      } catch (error) {
        console.error("Error clearing cache:", error);
        alert("Failed to clear cache");
      }
    }
  };

  const resetAllWords = async () => {
    if (window.confirm("Are you sure you want to reset all words? This will clear all learning progress and set all words back to 'Learning' status.")) {
      try {
        // Show loading state
        setSaving(true);
        
        // Get the current server URL
        const apiUrl = localStorage.getItem('serverUrl') || import.meta.env.VITE_API_URL || 'http://localhost:8000';
        
        // Call the reset API
        const response = await fetch(`${apiUrl}/api/reset-all-words`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Show success message
        alert(`Successfully reset ${data.count} words to Learning status.`);
        
        // Clear local IndexedDB cache to sync with server
        if (window.confirm("Would you like to sync your local database with the server to apply the reset?")) {
          // This will trigger a sync on the next app reload
          localStorage.setItem('needsSync', 'true');
          alert("Changes will be applied after syncing with the server. The app will now reload.");
          window.location.reload();
        }
        
      } catch (error) {
        console.error("Error resetting words:", error);
        alert(`Failed to reset words: ${error.message}`);
      } finally {
        setSaving(false);
      }
    }
  };

  return (
    <div className="p-4 space-y-6 pb-20">
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Connection Status */}
          <div className="bg-white rounded-xl shadow-md mb-6">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                {offlineMode ? (
                  <CloudOff size={20} className="text-orange-500 mr-2" />
                ) : (
                  <Wifi size={20} className="text-green-500 mr-2" />
                )}
                <span className="text-gray-700 font-medium">
                  {offlineMode ? "Offline Mode" : "Connected"}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {offlineMode ? "Some features limited" : `Status: ${status}`}
              </span>
            </div>
          </div>
          
          {/* Server Configuration */}
          <div className="bg-white rounded-xl shadow-md mb-6">
            <div className="p-4 border-b">
              <div className="flex items-center">
                <Server size={18} className="text-blue-500 mr-2" />
                <h2 className="text-lg font-medium">Server Connection</h2>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Current Connection Status */}
              <div className="mb-4 p-2 bg-gray-50 rounded-md">
                <div className="flex items-center">
                  <div 
                    className={`w-3 h-3 rounded-full mr-2 ${
                      status === "connected" ? "bg-green-500" : 
                      status === "connecting" ? "bg-yellow-500" :
                      "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm">
                    Status: {status}
                  </span>
                </div>
              </div>
              
              {/* Server Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Server URL
                </label>
                <div className="flex items-center">
                  <span className="bg-gray-100 px-3 py-2 rounded-l-md border border-r-0 border-gray-300 text-gray-500">
                    https://
                  </span>
                  <input
                    type="text"
                    value={serverBaseUrl}
                    onChange={(e) => setServerBaseUrl(e.target.value)}
                    placeholder="your-ngrok-url.ngrok.io"
                    className="flex-1 p-2 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="bg-gray-100 px-3 py-2 rounded-r-md border border-l-0 border-gray-300 text-gray-500">
                    /
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Example: abcd1234.ngrok.io
                </p>
              </div>
              
              {/* Preview of URLs that will be used */}
              <div className="text-xs text-gray-600 space-y-1 bg-gray-50 p-2 rounded">
                <div><strong>API URL:</strong> https://{serverBaseUrl}</div>
                <div><strong>WebSocket URL:</strong> wss://{serverBaseUrl}</div>
              </div>
              
              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={saveServerUrls}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md"
                  disabled={saving}
                >
                  Save and Reload
                </button>
              </div>
            </div>
          </div>
        
          {/* Audio Settings */}
          <div className="bg-white rounded-xl shadow-md">
            <div className="p-4 border-b">
              <div className="flex items-center">
                <Mic size={18} className="text-blue-500 mr-2" />
                <h2 className="text-lg font-medium">Audio Settings</h2>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {/* Hold to Speak Toggle */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">Hold to Speak</div>
                  <div className="text-sm text-gray-500">Hold space bar or button to record</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.useHoldToSpeak}
                    onChange={() => toggleSetting('useHoldToSpeak')}
                    disabled={saving}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              {/* Show Waveform Toggle */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">Audio Waveform</div>
                  <div className="text-sm text-gray-500">Show audio visualization</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.showWaveform}
                    onChange={() => toggleSetting('showWaveform')}
                    disabled={saving}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              {/* Microphone Sensitivity */}
              <div className="p-4">
                <div className="mb-2">
                  <div className="font-medium">Microphone Sensitivity</div>
                  <div className="text-sm text-gray-500">Adjust input level</div>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">Low</span>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="3" 
                    step="0.1"
                    value={settings.sensitivity}
                    onChange={(e) => saveSetting('sensitivity', parseFloat(e.target.value))}
                    className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-500 ml-2">High</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Learning Settings */}
          <div className="bg-white rounded-xl shadow-md">
            <div className="p-4 border-b">
              <div className="flex items-center">
                <BookOpen size={18} className="text-blue-500 mr-2" />
                <h2 className="text-lg font-medium">Learning Settings</h2>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {/* HSK Level Focus */}
              <div 
                className="p-4 flex justify-between items-center cursor-pointer"
                onClick={() => setShowHSKSelect(!showHSKSelect)}
              >
                <div>
                  <div className="font-medium">HSK Level Focus</div>
                  <div className="text-sm text-gray-500">Choose which levels to practice</div>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">{formatHSKFocus()}</span>
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
              </div>
              
              {/* HSK Selection Dropdown */}
              {showHSKSelect && (
                <div className="p-4 bg-gray-50">
                  <div className="text-sm font-medium mb-2">Select HSK Levels:</div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6].map(level => (
                      <button
                        key={level}
                        onClick={() => toggleHSKLevel(level)}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          settings.hskFocus.includes(level)
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        HSK {level}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Daily Goal */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">Daily Goal</div>
                  <div className="text-sm text-gray-500">Words to learn each day</div>
                </div>
                <div className="flex items-center">
                  <select
                    value={settings.dailyGoal}
                    onChange={(e) => saveSetting('dailyGoal', parseInt(e.target.value))}
                    className="bg-gray-100 border border-gray-300 text-gray-700 rounded-lg px-2 py-1 focus:ring-blue-500 focus:border-blue-500"
                    disabled={saving}
                  >
                    <option value="5">5 words</option>
                    <option value="10">10 words</option>
                    <option value="15">15 words</option>
                    <option value="20">20 words</option>
                    <option value="30">30 words</option>
                  </select>
                </div>
              </div>
              
              {/* Notifications */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">Notifications</div>
                  <div className="text-sm text-gray-500">Remind me to practice</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={settings.notifications}
                    onChange={() => toggleSetting('notifications')}
                    disabled={saving}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              
              {/* Dark Mode */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">Dark Mode</div>
                  <div className="text-sm text-gray-500">Enable dark theme</div>
                </div>
                <div className="flex items-center">
                  <span className="mr-2">
                    {settings.darkMode ? (
                      <Moon size={18} className="text-gray-500" />
                    ) : (
                      <Sun size={18} className="text-gray-500" />
                    )}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={settings.darkMode}
                      onChange={() => toggleSetting('darkMode')}
                      disabled={saving}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          {/* Data Management */}
          <div className="bg-white rounded-xl shadow-md">
            <div className="p-4 border-b">
              <div className="flex items-center">
                <Database size={18} className="text-blue-500 mr-2" />
                <h2 className="text-lg font-medium">Data Management</h2>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {/* Storage Usage */}
              {storageUsage && (
                <div className="p-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">Storage Usage</span>
                    <span className="text-sm text-gray-500">
                      {storageUsage.usage} MB / {storageUsage.quota} MB
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${storageUsage.percent}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Sync Data */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">Sync Vocabulary Data</div>
                  <div className="text-sm text-gray-500">Update from server</div>
                  
                  {/* Show sync status if available */}
                  {syncStatus && (
                    <div className={`mt-2 text-sm flex items-center ${
                      syncStatus.success ? "text-green-600" : "text-red-600"
                    }`}>
                      {syncStatus.success ? 
                        <Check size={14} className="mr-1" /> : 
                        <AlertCircle size={14} className="mr-1" />
                      }
                      {syncStatus.message}
                    </div>
                  )}
                  
                  {/* Show last sync time */}
                  <div className="mt-1 text-xs text-gray-500">
                    Last sync: {localStorage.getItem('lastSync') ? 
                      new Date(localStorage.getItem('lastSync')).toLocaleString() : 
                      'Never'}
                  </div>
                </div>
                <button 
                  onClick={handleSyncRequest}
                  disabled={syncing || offlineMode}
                  className={`flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                    syncing ? 
                      "bg-gray-200 text-gray-500" : 
                      offlineMode ?
                        "bg-gray-200 text-gray-500" :
                        "bg-blue-100 text-blue-800 hover:bg-blue-200"
                  }`}
                >
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              </div>
              
              {/* Clear Cache */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium">Clear Cache</div>
                  <div className="text-sm text-gray-500">Free up storage space</div>
                </div>
                <button 
                  className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium"
                  onClick={clearCache}
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="p-4 flex justify-between items-center">
              <div>
                <div className="font-medium">Reset Learning Progress</div>
                <div className="text-sm text-gray-500">Reset all words to "Learning" status</div>
              </div>
              <button 
                className="px-3 py-1.5 bg-red-100 text-red-800 rounded-lg text-sm font-medium"
                onClick={resetAllWords}
                disabled={saving || offlineMode}
              >
                Reset
              </button>
            </div>
          </div>
          
          {/* About */}
          <div className="bg-white rounded-xl shadow-md">
            <div className="p-4 border-b">
              <div className="flex items-center">
                <Info size={18} className="text-blue-500 mr-2" />
                <h2 className="text-lg font-medium">About</h2>
              </div>
            </div>
            
            <div className="p-4">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-blue-600">HSK Master</h3>
                <p className="text-sm text-gray-500">Version {appVersion}</p>
              </div>
              
              <p className="text-sm text-gray-700 mb-3">
                HSK Master helps you master Chinese characters through context-based 
                learning and spaced repetition.
              </p>
              
              <div className="text-center text-xs text-gray-500">
                &copy; {new Date().getFullYear()} HSK Master. All Rights Reserved.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}