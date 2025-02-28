import React, { useState, useEffect } from "react";
import { vocabularyDB, practiceHistoryDB } from "../services/db";
import { CheckCircleIcon, TrendingUpIcon, ClockIcon, AwardIcon } from "lucide-react";

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWords: 0,
    masteredWords: 0,
    masteredByLevel: [],
    streak: 0,
    todayStats: {
      totalSessions: 0,
      uniqueWords: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: 0
    },
    activityHistory: []
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
        
        // Get streak information from localStorage
        let streak = 0;
        const streakData = localStorage.getItem('streak');
        if (streakData) {
          const parsed = JSON.parse(streakData);
          streak = parsed.count || 0;
        }
        
        // Get today's practice statistics
        const todayStats = await practiceHistoryDB.getTodayStats();
        
        // Get practice history for the last 7 days
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          last7Days.push(date.toISOString().split('T')[0]);
        }
        
        // Get practice records
        const practiceRecords = await practiceHistoryDB.getPracticeHistory(7);
        
        // Group records by date
        const recordsByDate = {};
        last7Days.forEach(date => {
          recordsByDate[date] = {
            date,
            count: 0,
            words: new Set(),
            correct: 0,
            incorrect: 0
          };
        });
        
        // Count activities by date
        practiceRecords.forEach(record => {
          const date = record.date;
          if (recordsByDate[date]) {
            recordsByDate[date].count++;
            
            record.results.forEach(result => {
              if (result.wordId) {
                recordsByDate[date].words.add(result.wordId);
              }
              
              if (result.wasCorrect) {
                recordsByDate[date].correct++;
              } else {
                recordsByDate[date].incorrect++;
              }
            });
          }
        });
        
        // Convert to array for display
        const activityHistory = Object.values(recordsByDate).map(item => ({
          date: item.date,
          count: item.count,
          uniqueWords: item.words.size,
          correct: item.correct,
          incorrect: item.incorrect,
          // Format date for display (e.g., "Mon 15")
          displayDate: new Date(item.date).toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric'
          })
        }));
        
        setStats({
          totalWords: allWords.length,
          masteredWords: mastered.length,
          masteredByLevel,
          streak,
          todayStats,
          activityHistory
        });
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading statistics:", error);
        setLoading(false);
      }
    }
    
    loadStats();
  }, []);
  
  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  return (
    <div className="p-4 space-y-6">
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 rounded-xl">
              <div className="flex items-center mb-1">
                <CheckCircleIcon size={18} className="mr-1" />
                <h3 className="text-sm font-medium">Mastered</h3>
              </div>
              <p className="text-2xl font-bold">{stats.masteredWords} <span className="text-sm opacity-75">/ {stats.totalWords}</span></p>
              <p className="text-xs opacity-75 mt-1">
                {Math.round((stats.masteredWords / stats.totalWords) * 100)}% complete
              </p>
            </div>
            
            <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white p-4 rounded-xl">
              <div className="flex items-center mb-1">
                <TrendingUpIcon size={18} className="mr-1" />
                <h3 className="text-sm font-medium">Streak</h3>
              </div>
              <p className="text-2xl font-bold">{stats.streak} <span className="text-sm opacity-75">days</span></p>
              <p className="text-xs opacity-75 mt-1">
                Keep practicing daily!
              </p>
            </div>
          </div>
          
          {/* Today's Progress */}
          <div className="card bg-white rounded-xl shadow-md p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-medium">Today's Progress</h2>
              <ClockIcon size={18} className="text-gray-400" />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-sm">Practice Sessions</p>
                <p className="text-xl font-medium">{stats.todayStats.totalSessions}</p>
              </div>
              
              <div>
                <p className="text-gray-500 text-sm">Words Practiced</p>
                <p className="text-xl font-medium">{stats.todayStats.uniqueWords}</p>
              </div>
              
              <div>
                <p className="text-gray-500 text-sm">Correct Answers</p>
                <p className="text-xl font-medium">{stats.todayStats.correctCount}</p>
              </div>
              
              <div>
                <p className="text-gray-500 text-sm">Accuracy</p>
                <p className="text-xl font-medium">{stats.todayStats.accuracy}%</p>
              </div>
            </div>
          </div>
          
          {/* HSK Level Progress */}
          <div className="card bg-white rounded-xl shadow-md p-4">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-lg font-medium">HSK Level Progress</h2>
              <AwardIcon size={18} className="text-gray-400" />
            </div>
            
            <div className="space-y-3">
              {stats.masteredByLevel.map(level => (
                <div key={level.level} className="mb-3">
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">HSK {level.level}</span>
                    <span className="text-sm text-gray-500">
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
          
          {/* Recent Activity */}
          <div className="card bg-white rounded-xl shadow-md p-4">
            <h2 className="text-lg font-medium mb-3">Recent Activity</h2>
            
            <div className="space-y-2">
              {stats.activityHistory.map((day, index) => (
                <div 
                  key={day.date} 
                  className={`flex items-center p-3 rounded-lg ${
                    day.count > 0 ? 'bg-blue-50' : 'bg-gray-50'
                  }`}
                >
                  <div className="w-16 text-sm font-medium">
                    {day.displayDate}
                  </div>
                  
                  <div className="flex-grow mx-3">
                    <div className="h-3 bg-gray-200 rounded-full">
                      <div 
                        className={`h-3 rounded-full ${
                          day.count > 0 ? 'bg-blue-500' : 'bg-gray-300'
                        }`}
                        style={{ 
                          width: `${Math.min(100, (day.uniqueWords / 20) * 100)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="text-sm font-medium">
                    {day.uniqueWords > 0 ? (
                      <>{day.uniqueWords} words</>
                    ) : (
                      <span className="text-gray-400">No activity</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}