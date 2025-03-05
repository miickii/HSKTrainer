import React, { useState, useEffect } from "react";
import { CheckCircle, RefreshCw } from "lucide-react";

export default function ProgressPage({ words, loading: propLoading }) {
  // Use local loading state for processing the data
  const [localLoading, setLocalLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWords: 0,
    masteredWords: 0,
    masteredByLevel: []
  });
  
  // Calculate statistics based on prop words
  useEffect(() => {
    async function calculateStats() {
      try {
        setLocalLoading(true);
        
        // Use the words passed from props
        const allWords = words || [];
        
        // Calculate mastered words (correct at least once)
        const mastered = allWords.filter(word => word.correctCount > 0);
        
        // Calculate words mastered by HSK level
        const levelCounts = {};
        const masteredByLevel = [];
        
        allWords.forEach(word => {
          const level = word.level || 1;
          
          if (!levelCounts[level]) {
            levelCounts[level] = { total: 0, mastered: 0 };
          }
          
          levelCounts[level].total++;
          
          if (word.correctCount > 0) {
            levelCounts[level].mastered++;
          }
        });
        
        // Convert to array for display
        for (let level = 1; level <= 6; level++) {
          const data = levelCounts[level] || { total: 0, mastered: 0 };
          const percentage = data.total > 0 
            ? Math.round((data.mastered / data.total) * 100) 
            : 0;
            
          masteredByLevel.push({
            level,
            total: data.total,
            mastered: data.mastered,
            percentage
          });
        }
        
        setStats({
          totalWords: allWords.length,
          masteredWords: mastered.length,
          masteredByLevel
        });
        
        setLocalLoading(false);
      } catch (error) {
        console.error("Error calculating statistics:", error);
        setLocalLoading(false);
      }
    }
    
    // Only calculate stats when words are available and not loading
    if (!propLoading && words && words.length > 0) {
      calculateStats();
    }
  }, [words, propLoading]);

  // Determine if we should show loading state
  const isLoading = propLoading || localLoading;

  return (
    <div className="p-4 pb-16">
      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
        </div>
      ) : (
        <>
          {/* Overall Progress Card */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-4 mb-5">
            <div className="flex items-center mb-3">
              <CheckCircle size={18} className="text-red-500 mr-2" />
              <h2 className="text-lg font-medium text-neutral-900">Overall Progress</h2>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-neutral-600">Words Mastered:</span>
              <span className="font-bold text-neutral-800">{stats.masteredWords} / {stats.totalWords}</span>
            </div>
            
            <div className="w-full bg-neutral-100 rounded-full h-2.5 mb-1">
              <div 
                className="bg-red-500 h-2.5 rounded-full" 
                style={{ 
                  width: `${stats.totalWords > 0 ? (stats.masteredWords / stats.totalWords) * 100 : 0}%` 
                }}
              ></div>
            </div>
            
            <div className="text-right text-sm text-neutral-500">
              {stats.totalWords > 0 
                ? Math.round((stats.masteredWords / stats.totalWords) * 100) 
                : 0}% complete
            </div>
          </div>
          
          {/* Rest of your component remains the same */}
          
          {/* HSK Level Progress */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-4 mb-5">
            <h2 className="text-lg font-medium mb-4 text-neutral-900">HSK Level Progress</h2>
            
            <div className="space-y-4">
              {stats.masteredByLevel.map(level => (
                <div key={level.level} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-neutral-800">HSK {level.level}</span>
                    <span className="text-neutral-600">
                      {level.mastered} / {level.total} ({level.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2.5">
                    <div 
                      className="bg-red-500 h-2.5 rounded-full" 
                      style={{ width: `${level.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Learning Streak */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-100 p-4 mb-5">
            <h2 className="text-lg font-medium mb-3 text-neutral-900">Learning Activity</h2>
            
            <div className="flex justify-between items-center">
              <div className="text-center px-3 py-2">
                <div className="text-2xl font-bold text-neutral-900">
                  {stats.masteredWords}
                </div>
                <div className="text-xs text-neutral-500">
                  Words Mastered
                </div>
              </div>
              
              <div className="text-center px-3 py-2">
                <div className="text-2xl font-bold text-neutral-900">
                  {stats.totalWords - stats.masteredWords}
                </div>
                <div className="text-xs text-neutral-500">
                  Still Learning
                </div>
              </div>
              
              <div className="text-center px-3 py-2">
                <div className="text-2xl font-bold text-neutral-900">
                  {stats.totalWords}
                </div>
                <div className="text-xs text-neutral-500">
                  Total Words
                </div>
              </div>
            </div>
          </div>
          
          {/* Replace reload with optional refresh method if needed */}
          <div className="mt-6 text-center">
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-neutral-100 text-neutral-700 rounded-lg font-medium"
            >
              <RefreshCw size={16} className="inline-block mr-2" />
              Refresh Progress Data
            </button>
          </div>
        </>
      )}
    </div>
  );
}