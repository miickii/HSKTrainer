import React, { useState, useEffect, useRef } from "react";
import { Search, X, Filter, Heart, BookOpen, Volume2 } from "lucide-react";
import { vocabularyDB } from "../services/db";
import { v4 as uuidv4 } from 'uuid';

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

        data.forEach(word => {
          word.examples = JSON.parse(word.examples);
          console.log(word.examples)
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
          <Search size={18} className="text-neutral-400" />
        </div>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search vocabulary..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-10 py-2 border border-neutral-200 rounded-lg focus:ring-red-500 focus:border-red-500 bg-white"
        />
        {searchTerm && (
          <button
            onClick={clearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X size={18} className="text-neutral-400" />
          </button>
        )}
      </div>
      
      {/* Filter Options */}
      <div className="mb-5 space-y-3">
        {/* HSK Level Filter */}
        <div className="flex overflow-x-auto space-x-2 py-1 -mx-4 px-4">
          <button
            onClick={() => setSelectedLevel(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
              selectedLevel === null
                ? "bg-red-100 text-red-800"
                : "bg-neutral-100 text-neutral-600"
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
                  ? "bg-red-100 text-red-800"
                  : "bg-neutral-100 text-neutral-600"
              }`}
            >
              HSK {level}
            </button>
          ))}
        </div>
        
        {/* Mastery Filter */}
        <div className="flex space-x-2 overflow-x-auto -mx-4 px-4 py-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 ${
              filter === "all"
                ? "bg-red-100 text-red-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <Filter size={16} className="mr-1" />
            All
          </button>
          
          <button
            onClick={() => setFilter("mastered")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 ${
              filter === "mastered"
                ? "bg-green-100 text-green-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <BookOpen size={16} className="mr-1" />
            Mastered
          </button>
          
          <button
            onClick={() => setFilter("learning")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 ${
              filter === "learning"
                ? "bg-amber-100 text-amber-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <BookOpen size={16} className="mr-1" />
            Learning
          </button>
          
          <button
            onClick={() => setFilter("favorite")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 ${
              filter === "favorite"
                ? "bg-red-100 text-red-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <Heart size={16} className="mr-1" />
            Favorites
          </button>
        </div>
      </div>
      
      {/* Results Count */}
      <div className="mb-4 text-sm text-neutral-500">
        {filteredWords.length} {filteredWords.length === 1 ? 'word' : 'words'} found
      </div>
      
      {/* Word List */}
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-neutral-400 mb-2">No words found</div>
          <div className="text-sm text-neutral-500">Try adjusting your filters</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWords.map(word => (
            <div 
              key={word.id}
              className="bg-white rounded-xl shadow-sm border border-neutral-100 overflow-hidden"
            >
              {/* Word Header */}
              <div 
                className="p-4 cursor-pointer"
                onClick={() => toggleDetails(word.id)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center">
                      <span className="text-xl font-bold text-neutral-900">{word.simplified}</span>
                    </div>
                    <div className="text-sm text-red-500">{word.pinyin}</div>
                  </div>
                  
                  <div className="flex items-center">
                    {/* HSK Level Badge */}
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium mr-2">
                      HSK {word.level}
                    </span>
                    
                    {/* Mastery Indicator */}
                    {word.correctCount > 0 ? (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium mr-2">
                        Mastered
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium mr-2">
                        Learning
                      </span>
                    )}
                    
                    {/* Favorite Button */}
                    <button 
                      onClick={(e) => toggleFavorite(word.id, e)}
                      className={`p-1 rounded-full ${
                        word.isFavorite
                          ? 'text-red-500 hover:text-red-700'
                          : 'text-neutral-400 hover:text-neutral-600'
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
                <div className="mt-1 text-sm text-neutral-700">
                  {word.meanings}
                </div>
                
                {/* SRS Level Indicator if available */}
                {word.srsLevel > 0 && (
                  <div className="mt-2 flex items-center">
                    <div className="bg-neutral-50 text-neutral-700 text-xs px-2 py-0.5 rounded-full border border-neutral-200">
                      SRS Level {word.srsLevel}
                    </div>
                    {word.nextReview && (
                      <div className="text-xs text-neutral-500 ml-2">
                        Next review: {formatDate(word.nextReview)}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Word Details */}
              {showDetailId === word.id && (
                <div className="px-4 pb-4 pt-2 border-t border-neutral-100 bg-neutral-50">
                  {/* Statistics */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <div className="text-xs text-neutral-500">Correct</div>
                      <div className="font-medium text-neutral-800">{word.correctCount || 0}</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-neutral-500">Incorrect</div>
                      <div className="font-medium text-neutral-800">{word.incorrectCount || 0}</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-neutral-500">SRS Level</div>
                      <div className="font-medium text-neutral-800">{word.srsLevel || 0}</div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  {word.traditional && word.traditional !== word.simplified && (
                    <div className="mb-2">
                      <span className="text-xs text-neutral-500 mr-1">Traditional:</span>
                      <span className="text-neutral-800">{word.traditional}</span>
                    </div>
                  )}
                  
                  {word.radical && (
                    <div className="mb-2">
                      <span className="text-xs text-neutral-500 mr-1">Radical:</span>
                      <span className="text-neutral-800">{word.radical}</span>
                    </div>
                  )}
                  
                  {/* Next Review Date */}
                  {word.nextReview && (
                    <div className="text-xs text-neutral-500 mb-4">
                      Next review: {formatDate(word.nextReview)}
                    </div>
                  )}

                  <h2 className="text-lg text-red-600 font-bold mb-2">Examples:</h2>

                  {word.examples.map((example, index) => (
                    <div 
                      key={uuidv4()}
                      className="mb-2 border-b"
                    >
                      <div className="mb-2">
                        <span className="">{example.simplified}</span>
                      </div>
                      <div className="mb-2">
                        <span className="text-neutral-800">{example.pinyin}</span>
                      </div>
                      <div className="mb-2">
                        <span className="text-neutral-800">{example.english}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}