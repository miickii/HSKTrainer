import React, { useState, useEffect, useRef } from "react";
import { Search, X, Filter, Heart, BookOpen, Volume2 } from "lucide-react";
import { vocabularyDB } from "../services/db";

export default function VocabularyPage() {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [filter, setFilter] = useState("all"); // all, mastered, learning, favorite
  const [showDetailId, setShowDetailId] = useState(null);
  const searchInputRef = useRef(null);

  // Load vocabulary words from local database
  useEffect(() => {
    async function loadVocabulary() {
      try {
        setLoading(true);
        
        // Load from IndexedDB
        let data = await vocabularyDB.getAll();
        
        if (data.length === 0) {
          console.log("No words found in local database");
          setLoading(false);
          return;
        }
        
        // Sort words by level and then by simplified character
        data.sort((a, b) => {
          if (a.level !== b.level) {
            return a.level - b.level;
          }
          return a.simplified.localeCompare(b.simplified, 'zh-CN');
        });
        
        setWords(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading vocabulary:", error);
        setLoading(false);
      }
    }
    
    loadVocabulary();
  }, []);
  
  // Filter and search words
  const filteredWords = words.filter(word => {
    let matches = true;
    
    // Apply HSK level filter
    if (selectedLevel !== null) {
      matches = matches && word.level === selectedLevel;
    }
    
    // Apply mastery filter
    if (filter === "mastered") {
      matches = matches && (word.correctCount > 0);
    } else if (filter === "learning") {
      matches = matches && (word.correctCount === 0);
    } else if (filter === "favorite") {
      matches = matches && word.isFavorite;
    }
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      matches = matches && (
        word.simplified.includes(searchTerm) ||
        word.pinyin?.toLowerCase().includes(searchLower) ||
        word.meanings?.toLowerCase().includes(searchLower)
      );
    }
    
    return matches;
  });
  
  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };
  
  // Toggle favorite status
  const toggleFavorite = async (id, e) => {
    e.stopPropagation(); // Prevent opening details
    
    try {
      const updatedWord = await vocabularyDB.toggleFavorite(id);
      
      // Update the word in the local state
      setWords(prevWords => 
        prevWords.map(word => 
          word.id === id ? updatedWord : word
        )
      );
    } catch (error) {
      console.error("Error toggling favorite status:", error);
    }
  };
  
  // Toggle word details
  const toggleDetails = (id) => {
    setShowDetailId(showDetailId === id ? null : id);
  };

  // Format the next review date
  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set';
    
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    if (dateStr === today) return 'Today';
    if (dateStr === tomorrowStr) return 'Tomorrow';
    
    return new Date(dateStr).toLocaleDateString();
  };

  // Get example data if available
  const getWordExamples = (word) => {
    if (!word.examples) return [];
    
    try {
      const examples = JSON.parse(word.examples);
      return Array.isArray(examples) ? examples : [];
    } catch (error) {
      console.error(`Error parsing examples for word ${word.id}:`, error);
      return [];
    }
  };

  return (
    <div className="p-4 pb-16">
      {/* Search Bar */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search vocabulary..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X size={18} className="text-gray-400" />
          </button>
        )}
      </div>
      
      {/* Filter Options */}
      <div className="mb-4 space-y-3">
        {/* HSK Level Filter */}
        <div className="flex overflow-x-auto space-x-2 py-1 -mx-4 px-4">
          <button
            onClick={() => setSelectedLevel(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
              selectedLevel === null
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            All Levels
          </button>
          
          {[1, 2, 3, 4, 5, 6].map(level => (
            <button
              key={level}
              onClick={() => setSelectedLevel(level)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
                selectedLevel === level
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              HSK {level}
            </button>
          ))}
        </div>
        
        {/* Mastery Filter */}
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center ${
              filter === "all"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <Filter size={16} className="mr-1" />
            All
          </button>
          
          <button
            onClick={() => setFilter("mastered")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center ${
              filter === "mastered"
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <BookOpen size={16} className="mr-1" />
            Mastered
          </button>
          
          <button
            onClick={() => setFilter("learning")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center ${
              filter === "learning"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <BookOpen size={16} className="mr-1" />
            Learning
          </button>
          
          <button
            onClick={() => setFilter("favorite")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center ${
              filter === "favorite"
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            <Heart size={16} className="mr-1" />
            Favorites
          </button>
        </div>
      </div>
      
      {/* Results Count */}
      <div className="mb-4 text-sm text-gray-500">
        {filteredWords.length} {filteredWords.length === 1 ? 'word' : 'words'} found
      </div>
      
      {/* Word List */}
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-gray-400 mb-2">No words found</div>
          <div className="text-sm text-gray-500">Try adjusting your filters</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWords.map(word => (
            <div 
              key={word.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Word Header */}
              <div 
                className="p-4 cursor-pointer"
                onClick={() => toggleDetails(word.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center">
                      <span className="text-xl font-bold">{word.simplified}</span>
                    </div>
                    <div className="text-sm text-gray-500">{word.pinyin}</div>
                  </div>
                  
                  <div className="flex items-center">
                    {/* HSK Level Badge */}
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium mr-2">
                      HSK {word.level}
                    </span>
                    
                    {/* Mastery Indicator */}
                    {word.correctCount > 0 ? (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium mr-2">
                        Mastered
                      </span>
                    ) : (
                      <span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded font-medium mr-2">
                        Learning
                      </span>
                    )}
                    
                    {/* Favorite Button */}
                    <button 
                      onClick={(e) => toggleFavorite(word.id, e)}
                      className={`p-1 rounded-full ${
                        word.isFavorite
                          ? 'text-red-500 hover:text-red-700'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      <Heart 
                        size={18} 
                        fill={word.isFavorite ? 'currentColor' : 'none'} 
                      />
                    </button>
                  </div>
                </div>
                
                {/* Meaning */}
                <div className="mt-1 text-sm">
                  {word.meanings}
                </div>
                
                {/* SRS Level Indicator if available */}
                {word.srsLevel > 0 && (
                  <div className="mt-2 flex items-center">
                    <div className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                      SRS Level {word.srsLevel}
                    </div>
                    {word.nextReview && (
                      <div className="text-xs text-gray-500 ml-2">
                        Next review: {formatDate(word.nextReview)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Word Details */}
              {showDetailId === word.id && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50">
                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Correct</div>
                      <div className="font-medium">{word.correctCount || 0}</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Incorrect</div>
                      <div className="font-medium">{word.incorrectCount || 0}</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-gray-500">SRS Level</div>
                      <div className="font-medium">{word.srsLevel || 0}</div>
                    </div>
                  </div>
                  
                  {/* Additional Info */}
                  {word.traditional && word.traditional !== word.simplified && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 mr-1">Traditional:</span>
                      <span>{word.traditional}</span>
                    </div>
                  )}
                  
                  {word.radical && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 mr-1">Radical:</span>
                      <span>{word.radical}</span>
                    </div>
                  )}
                  
                  {/* Next Review Date */}
                  {word.nextReview && (
                    <div className="text-xs text-gray-500">
                      Next review: {formatDate(word.nextReview)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}