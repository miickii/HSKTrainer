import React, { useState, useEffect } from "react";
import { CheckCircleIcon } from "lucide-react";
import { vocabularyDB } from "../services/db";

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWords: 0,
    masteredWords: 0,
    masteredByLevel: []
  });
  
  // Load statistics
  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        
        // Get all words
        const allWords = await vocabularyDB.getAll();
        
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
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading statistics:", error);
        setLoading(false);
      }
    }
    
    loadStats();
  }, []);

  return (
    <div className="p-4 pb-16">
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Overall Progress Card */}
          <div className="card bg-white rounded-xl shadow-md p-4 mb-6">
            <div className="flex items-center mb-3">
              <CheckCircleIcon size={18} className="text-blue-500 mr-2" />
              <h2 className="text-lg font-medium">Overall Progress</h2>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600">Total Words Mastered:</span>
              <span className="font-bold">{stats.masteredWords} / {stats.totalWords}</span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ 
                  width: `${stats.totalWords > 0 ? (stats.masteredWords / stats.totalWords) * 100 : 0}%` 
                }}
              ></div>
            </div>
            
            <div className="text-right text-sm text-gray-500">
              {stats.totalWords > 0 
                ? Math.round((stats.masteredWords / stats.totalWords) * 100) 
                : 0}% complete
            </div>
          </div>
          
          {/* HSK Level Progress */}
          <div className="card bg-white rounded-xl shadow-md p-4">
            <h2 className="text-lg font-medium mb-4">HSK Level Progress</h2>
            
            <div className="space-y-4">
              {stats.masteredByLevel.map(level => (
                <div key={level.level} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">HSK {level.level}</span>
                    <span className="text-gray-600">
                      {level.mastered} / {level.total} ({level.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${level.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Sync Status */}
          <div className="mt-6 p-4 bg-white rounded-xl shadow-md">
            <div className="text-center">
              <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg"
              >
                Refresh Progress Data
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}