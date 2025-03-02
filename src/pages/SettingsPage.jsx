import React, { useState, useEffect } from "react";
import { 
  Mic, 
  Database, 
  ArrowDownToLine,
  ArrowUpFromLine,
  Wifi,
  WifiOff,
  RefreshCw,
  Info,
  AlertCircle,
  Server,
  Trash2
} from "lucide-react";
import { vocabularyDB } from "../services/db";
import { ENDPOINTS } from "../services/api";

export default function SettingsPage({ status, offlineMode }) {
  const [settings, setSettings] = useState({
    useHoldToSpeak: true,
    showWaveform: true,
    sensitivity: 1.5,
    hskFocus: [1, 2, 3],
    preferOfflinePractice: false,
    preInitializeAudio: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHSKSelect, setShowHSKSelect] = useState(false);
  const [appVersion, setAppVersion] = useState('1.2.0');
  const [storageUsage, setStorageUsage] = useState(null);
  const [dataStats, setDataStats] = useState({
    wordCount: 0,
    sentenceCount: 0
  });
  
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
  
  // Load app statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        // Get word count
        const words = await vocabularyDB.getAll();
        
        // Count sentences
        let sentenceCount = 0;
        words.forEach(word => {
          try {
            const examples = JSON.parse(word.examples || '[]');
            if (Array.isArray(examples)) {
              sentenceCount += examples.length;
            }
          } catch (error) {
            // Ignore parsing errors
          }
        });
        
        setDataStats({
          wordCount: words.length,
          sentenceCount: sentenceCount
        });
        
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
        
      } catch (error) {
        console.error("Error loading stats:", error);
      }
    };
    
    loadStats();
  }, []);
  
  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        
        // Try to load from localStorage first (for settings that need to be quickly accessible)
        const appSettings = localStorage.getItem('appSettings');
        if (appSettings) {
          const parsedSettings = JSON.parse(appSettings);
          setSettings(prev => ({
            ...prev,
            ...parsedSettings
          }));
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading settings:", error);
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);
  
  // Save a setting
  const saveSetting = async (key, value) => {
    try {
      setSaving(true);
      
      // Update local state
      setSettings(prev => ({
        ...prev,
        [key]: value
      }));
      
      // Save to localStorage for quick access
      try {
        const appSettings = JSON.parse(localStorage.getItem('appSettings') || '{}');
        appSettings[key] = value;
        localStorage.setItem('appSettings', JSON.stringify(appSettings));
      } catch (error) {
        console.error("Error saving to localStorage:", error);
      }
      
      setSaving(false);
    } catch (error) {
      console.error(`Error saving setting ${key}:`, error);
      setSaving(false);
    }
  };
  
  // Toggle boolean setting
  const toggleSetting = (key) => {
    console.log(key)
    saveSetting(key, !settings[key]);
  };

  const SettingsToggle = ({ label, description, checked, onChange, disabled }) => {
    return (
      <div className="p-4 flex justify-between items-center">
        <div>
          <div className="font-medium text-neutral-800">{label}</div>
          <div className="text-sm text-neutral-500">{description}</div>
        </div>
        <button 
          onClick={onChange}
          disabled={disabled}
          className="relative inline-flex items-center cursor-pointer"
        >
          <span className={`w-11 h-6 block rounded-full transition-colors duration-200 ease-in-out ${checked ? 'bg-red-500' : 'bg-neutral-200'}`}>
            <span 
              className={`absolute top-[2px] left-[2px] inline-block w-5 h-5 rounded-full bg-white border border-neutral-300 transform transition-transform duration-200 ease-in-out ${
                checked ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </span>
        </button>
      </div>
    );
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

  // Reset all progress
  const resetAllProgress = async () => {
    if (window.confirm("Are you sure you want to reset all learning progress? This will set all words back to beginning level.")) {
      try {
        setSaving(true);
        
        // Reset progress in local database
        const count = await vocabularyDB.resetAllProgress();
        
        alert(`Successfully reset ${count} words to initial learning status.`);
      } catch (error) {
        console.error("Error resetting progress:", error);
        alert(`Failed to reset progress: ${error.message}`);
      } finally {
        setSaving(false);
      }
    }
  };
  
  // Export SRS progress
  const exportSRSProgress = async () => {
    try {
      setSaving(true);
      
      // Get progress data
      const progressData = await vocabularyDB.exportProgress();
      
      // Create a download link
      const dataStr = JSON.stringify(progressData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      // Create a link and click it to download
      const a = document.createElement('a');
      a.href = url;
      a.download = `hsk-progress-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      setSaving(false);
    } catch (error) {
      console.error("Error exporting progress:", error);
      alert(`Failed to export progress: ${error.message}`);
      setSaving(false);
    }
  };
  
  // Import SRS progress from a file
  const importSRSProgress = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setSaving(true);
      
      // Read the file
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const progressData = JSON.parse(e.target.result);
          
          // Validate format
          if (!progressData || !progressData.progressData || !Array.isArray(progressData.progressData)) {
            throw new Error("Invalid progress data format");
          }
          
          // Import the progress
          const count = await vocabularyDB.importProgress(progressData);
          
          alert(`Successfully imported progress for ${count} words.`);
          setSaving(false);
        } catch (error) {
          console.error("Error parsing progress file:", error);
          alert(`Failed to import progress: ${error.message}`);
          setSaving(false);
        }
      };
      
      reader.onerror = () => {
        alert("Error reading file");
        setSaving(false);
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error("Error importing progress:", error);
      alert(`Failed to import progress: ${error.message}`);
      setSaving(false);
    }
  };
  
  // Import full database from server
  const importFullDatabase = async () => {
    if (window.confirm("This will download the entire vocabulary database from the server and replace your local copy. Your learning progress will be reset. Continue?")) {
      try {
        setSaving(true);
        
        // Fetch vocabulary from server
        const vocabResponse = await fetch(ENDPOINTS.vocabulary, {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        });
        
        if (!vocabResponse.ok) {
          throw new Error(`Server returned ${vocabResponse.status}: ${vocabResponse.statusText}`);
        }
        
        const vocabulary = await vocabResponse.json();
        
        if (!Array.isArray(vocabulary) || vocabulary.length === 0) {
          throw new Error("Server returned empty or invalid vocabulary data");
        }
        
        // Import vocabulary
        const wordCount = await vocabularyDB.importFromServer(vocabulary);
        
        // Update stats
        setDataStats({
          wordCount
        });
        
        // Save import timestamp
        localStorage.setItem('lastDatabaseImport', new Date().toISOString());
        
        alert(`Successfully imported ${wordCount} words.`);
      } catch (error) {
        console.error("Error importing database:", error);
        alert(`Failed to import database: ${error.message}`);
      } finally {
        setSaving(false);
      }
    }
  };
  
  // Save server URLs
  const saveServerUrls = () => {
    // Save both URLs
    const baseUrl = serverBaseUrl.trim();
    localStorage.setItem('serverUrl', `https://${baseUrl}`);
    localStorage.setItem('wsUrl', `wss://${baseUrl}/ws/api`);
    
    // Show instruction modal or alert
    if (baseUrl.includes('ngrok-free.app')) {
      // Check if this is an ngrok URL
      const confirmMessage = 
        "Important: You're using an ngrok URL.\n\n" +
        "1. Please open this URL in a new tab first: https://" + baseUrl + "\n" +
        "2. Click 'Visit Site' on the ngrok warning page\n" +
        "3. Then come back and click OK to reload the app\n\n" +
        "This step is necessary for the app to work correctly.";
      
      if (window.confirm(confirmMessage)) {
        // Reload the page to apply changes
        window.location.reload();
      }
    } else {
      // Not an ngrok URL, proceed normally
      alert('Server URLs updated. The app will now reload to apply changes.');
      window.location.reload();
    }
  };

  return (
    <div className="p-4 space-y-5 pb-20">
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
        </div>
      ) : (
        <>
          {/* Connection Status */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100 mb-5">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center">
                {offlineMode ? (
                  <WifiOff size={20} className="text-amber-500 mr-2" />
                ) : (
                  <Wifi size={20} className="text-green-500 mr-2" />
                )}
                <span className="text-neutral-800 font-medium">
                  {offlineMode ? "Offline Mode" : "Connected"}
                </span>
              </div>
              <span className="text-sm text-neutral-500">
                {offlineMode ? "Some features limited" : `Status: ${status}`}
              </span>
            </div>
          </div>
          
          {/* Server Configuration */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100 mb-5">
            <div className="p-4 border-b border-neutral-100">
              <div className="flex items-center">
                <Server size={18} className="text-red-500 mr-2" />
                <h2 className="text-lg font-medium text-neutral-900">Server Connection</h2>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Current Connection Status */}
              <div className="mb-4 p-2 bg-neutral-50 rounded-md border border-neutral-100">
                <div className="flex items-center">
                  <div 
                    className={`w-3 h-3 rounded-full mr-2 ${
                      status === "connected" ? "bg-green-500" : 
                      status === "connecting" ? "bg-amber-500" :
                      "bg-red-500"
                    }`}
                  ></div>
                  <span className="text-sm text-neutral-600">
                    Status: {status}
                  </span>
                </div>
              </div>
              
              {/* Server Base URL */}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Server URL
                </label>
                <div className="flex items-center">
                  <span className="bg-neutral-50 px-3 py-2 rounded-l-md border border-r-0 border-neutral-200 text-neutral-500">
                    https://
                  </span>
                  <input
                    type="text"
                    value={serverBaseUrl}
                    onChange={(e) => setServerBaseUrl(e.target.value)}
                    placeholder="your-ngrok-url.ngrok.io"
                    className="flex-1 p-2 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <span className="bg-neutral-50 px-3 py-2 rounded-r-md border border-l-0 border-neutral-200 text-neutral-500">
                    /
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  Example: abcd1234.ngrok.io
                </p>
              </div>
              
              {/* Preview of URLs that will be used */}
              <div className="text-xs text-neutral-600 space-y-1 bg-neutral-50 p-2 rounded border border-neutral-100">
                <div><strong>API URL:</strong> https://{serverBaseUrl}</div>
                <div><strong>WebSocket URL:</strong> wss://{serverBaseUrl}/ws/api</div>
              </div>
              
              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={saveServerUrls}
                  className="px-4 py-2 bg-red-500 text-white rounded-md font-medium"
                  disabled={saving}
                >
                  Save and Reload
                </button>
              </div>
            </div>
          </div>
        
          {/* Audio Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100">
            <div className="p-4 border-b border-neutral-100">
              <div className="flex items-center">
                <Mic size={18} className="text-red-500 mr-2" />
                <h2 className="text-lg font-medium text-neutral-900">Audio Settings</h2>
              </div>
            </div>
            
            <div className="divide-y divide-neutral-100">
              {/* Hold to Speak Toggle */}
              <SettingsToggle
                label="Hold to Speak"
                description="Hold space bar or button to record"
                checked={settings.useHoldToSpeak}
                onChange={() => toggleSetting('useHoldToSpeak')}
                disabled={saving}
              />
              
              {/* Show Waveform Toggle */}
              <SettingsToggle
                label="Audio Waveform"
                description="Show audio visualization"
                checked={settings.showWaveform}
                onChange={() => toggleSetting('showWaveform')}
                disabled={saving}
              />
              
              {/* Pre-initialize Audio Toggle */}
              <SettingsToggle
                label="Pre-initialize Audio"
                description="Reduces recording startup delay"
                checked={settings.preInitializeAudio}
                onChange={() => toggleSetting('preInitializeAudio')}
                disabled={saving}
              />
              
              {/* Microphone Sensitivity */}
              <div className="p-4">
                <div className="mb-2">
                  <div className="font-medium text-neutral-800">Microphone Sensitivity</div>
                  <div className="text-sm text-neutral-500">Adjust input level</div>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-neutral-500 mr-2">Low</span>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="3" 
                    step="0.1"
                    value={settings.sensitivity}
                    onChange={(e) => saveSetting('sensitivity', parseFloat(e.target.value))}
                    className="w-full h-2 bg-neutral-100 rounded-lg appearance-none cursor-pointer accent-red-500"
                    disabled={saving}
                  />
                  <span className="text-sm text-neutral-500 ml-2">High</span>
                </div>
              </div>
              
              {/* Prefer Offline Practice Toggle */}
              <SettingsToggle
                label="Offline Practice Mode"
                description="Focus on character recognition"
                checked={settings.preferOfflinePractice}
                onChange={() => toggleSetting('preferOfflinePractice')}
                disabled={saving}
              />
            </div>
          </div>
          
          {/* Learning Settings */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100">
            <div className="p-4 border-b border-neutral-100">
              <div className="flex items-center">
                <Database size={18} className="text-red-500 mr-2" />
                <h2 className="text-lg font-medium text-neutral-900">Learning Settings</h2>
              </div>
            </div>
            
            <div className="divide-y divide-neutral-100">
              {/* HSK Level Focus */}
              <div 
                className="p-4 flex justify-between items-center cursor-pointer"
                onClick={() => setShowHSKSelect(!showHSKSelect)}
              >
                <div>
                  <div className="font-medium text-neutral-800">HSK Level Focus</div>
                  <div className="text-sm text-neutral-500">Choose which levels to practice</div>
                </div>
                <div className="flex items-center">
                  <span className="text-sm text-neutral-600 mr-2">{formatHSKFocus()}</span>
                  <RefreshCw size={18} className="text-neutral-400" />
                </div>
              </div>
              
              {/* HSK Selection Dropdown */}
              {showHSKSelect && (
                <div className="p-4 bg-neutral-50">
                  <div className="text-sm font-medium mb-2 text-neutral-700">Select HSK Levels:</div>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5, 6].map(level => (
                      <button
                        key={level}
                        onClick={() => toggleHSKLevel(level)}
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          settings.hskFocus.includes(level)
                            ? "bg-red-100 text-red-800"
                            : "bg-neutral-100 text-neutral-600"
                        }`}
                      >
                        HSK {level}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Data Management */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100">
            <div className="p-4 border-b border-neutral-100">
              <div className="flex items-center">
                <Database size={18} className="text-red-500 mr-2" />
                <h2 className="text-lg font-medium text-neutral-900">Data Management</h2>
              </div>
            </div>
            
            <div className="divide-y divide-neutral-100">
              {/* Storage Usage */}
              {storageUsage && (
                <div className="p-4">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium text-neutral-700">Storage Usage</span>
                    <span className="text-sm text-neutral-500">
                      {storageUsage.usage} MB / {storageUsage.quota} MB
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2.5">
                    <div 
                      className="bg-red-500 h-2.5 rounded-full" 
                      style={{ width: `${storageUsage.percent}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              {/* Database Stats */}
              <div className="p-4">
                <div className="text-sm font-medium mb-2 text-neutral-700">Database Statistics</div>
                <div className="flex flex-col space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Vocabulary words:</span>
                    <span className="text-sm font-medium text-neutral-800">{dataStats.wordCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Example sentences:</span>
                    <span className="text-sm font-medium text-neutral-800">{dataStats.sentenceCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-neutral-600">Last import:</span>
                    <span className="text-sm font-medium text-neutral-800">
                      {localStorage.getItem('lastDatabaseImport') 
                        ? new Date(localStorage.getItem('lastDatabaseImport')).toLocaleString() 
                        : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Import Database from Server */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="font-medium text-neutral-800">Import Database</div>
                    <div className="text-sm text-neutral-500">Get data from server</div>
                  </div>
                  <button 
                    onClick={importFullDatabase}
                    disabled={saving || offlineMode}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      saving || offlineMode
                        ? "bg-neutral-200 text-neutral-500" 
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                    }`}
                  >
                    <ArrowDownToLine size={16} className="inline-block mr-1" />
                    Import
                  </button>
                </div>
                
                <div className="text-xs text-neutral-500 bg-neutral-50 p-2 rounded border border-neutral-100">
                  <AlertCircle size={14} className="inline-block mr-1 text-amber-500" />
                  This will replace your local database and reset progress
                </div>
              </div>
              
              {/* Export/Import Progress */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="font-medium text-neutral-800">Export Progress</div>
                    <div className="text-sm text-neutral-500">Save learning data</div>
                  </div>
                  <button 
                    onClick={exportSRSProgress}
                    disabled={saving || dataStats.wordCount === 0}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      saving || dataStats.wordCount === 0
                        ? "bg-neutral-200 text-neutral-500" 
                        : "bg-neutral-100 text-neutral-800 hover:bg-neutral-200"
                    }`}
                  >
                    <ArrowUpFromLine size={16} className="inline-block mr-1" />
                    Export
                  </button>
                </div>
                
                <div className="mt-3">
                  <div className="font-medium text-neutral-800 mb-1">Import Progress</div>
                  <div className="text-sm text-neutral-500 mb-2">Restore from backup</div>
                  
                  <label className="flex items-center justify-center w-full px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg hover:bg-neutral-200 cursor-pointer">
                    <ArrowDownToLine size={18} className="mr-2" />
                    <span>Select Progress File</span>
                    <input 
                      type="file" 
                      accept=".json" 
                      className="hidden" 
                      onChange={importSRSProgress}
                      disabled={saving}
                    />
                  </label>
                </div>
              </div>
              
              {/* Reset Progress */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <div className="font-medium text-neutral-800">Reset Progress</div>
                    <div className="text-sm text-neutral-500">Clear learning data</div>
                  </div>
                  <button 
                    onClick={resetAllProgress}
                    disabled={saving || dataStats.wordCount === 0}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                      saving || dataStats.wordCount === 0
                        ? "bg-neutral-200 text-neutral-500" 
                        : "bg-red-100 text-red-800 hover:bg-red-200"
                    }`}
                  >
                    <Trash2 size={16} className="inline-block mr-1" />
                    Reset
                  </button>
                </div>
                
                <div className="text-xs text-neutral-500 bg-neutral-50 p-2 rounded border border-neutral-100">
                  <AlertCircle size={14} className="inline-block mr-1 text-red-500" />
                  This will reset all words to initial learning status
                </div>
              </div>
              
              {/* Clear Cache */}
              <div className="p-4 flex justify-between items-center">
                <div>
                  <div className="font-medium text-neutral-800">Clear Cache</div>
                  <div className="text-sm text-neutral-500">Free up storage space</div>
                </div>
                <button 
                  className="px-3 py-1.5 bg-neutral-100 text-neutral-800 rounded-lg text-sm font-medium"
                  onClick={clearCache}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          
          {/* About */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100">
            <div className="p-4 border-b border-neutral-100">
              <div className="flex items-center">
                <Info size={18} className="text-red-500 mr-2" />
                <h2 className="text-lg font-medium text-neutral-900">About</h2>
              </div>
            </div>
            
            <div className="p-4">
              <div className="text-center mb-4">
                <h3 className="text-xl font-bold text-red-500">HSK Master</h3>
                <p className="text-sm text-neutral-500">Version {appVersion}</p>
              </div>
              
              <p className="text-sm text-neutral-700 mb-3">
                HSK Master helps you practice Chinese characters through spaced repetition
                and pronunciation. Works offline for character recognition.
              </p>
              
              <div className="text-center text-xs text-neutral-500">
                &copy; {new Date().getFullYear()} HSK Master
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}