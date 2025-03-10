import React, { useRef } from "react";
import { Search, X, Filter, Heart, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { vocabularyDB } from "../services/db";
import { useApp } from "../context/AppContext";
import WordDetailView from "../components/WordDetailView";

export default function VocabularyPage() {
  // Get values from context
  const { 
    filteredVocabulary, 
    loading, 
    isFiltering, 
    searchTerm, 
    setSearchTerm,
    selectedLevel, 
    setSelectedLevel,
    filterType, 
    setFilterType,
    selectedWordId,
    toggleWordExpanded,
    openWordDetail,
    detailViewActive,
    updateWord,
    detailViewWord
  } = useApp();
  
  const searchInputRef = useRef(null);

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };
  
  // Format date for display
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

  const toggleFavorite = async (id, e) => {
    e.stopPropagation(); // Prevent opening details
    
    try {
      const updatedWord = await vocabularyDB.toggleFavorite(id);
      
      // Use the provided update function
      updateWord(id, updatedWord);
    } catch (error) {
      console.error("Error toggling favorite status:", error);
    }
  };

  // If detail view is active, show the word detail component
  if (detailViewActive && detailViewWord) {
    return <WordDetailView mode="fullscreen" sourceScreen="vocabulary" />;
  }

  // Render the vocabulary list
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
          
          {[1, 2, 3, 4, 5, 6, 7].map(level => (
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
          <button
            onClick={() => setSelectedLevel(-1)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0 ${
              selectedLevel === -1
                ? "bg-blue-100 text-blue-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            Chengyu
          </button>
        </div>
        
        {/* Mastery Filter */}
        <div className="flex space-x-2 overflow-x-auto -mx-4 px-4 py-1">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 ${
              filterType === "all"
                ? "bg-red-100 text-red-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <Filter size={16} className="mr-1" />
            All
          </button>
          
          <button
            onClick={() => setFilterType("mastered")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 ${
              filterType === "mastered"
                ? "bg-green-100 text-green-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <BookOpen size={16} className="mr-1" />
            Mastered
          </button>
          
          <button
            onClick={() => setFilterType("learning")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 ${
              filterType === "learning"
                ? "bg-amber-100 text-amber-800"
                : "bg-neutral-100 text-neutral-600"
            }`}
          >
            <BookOpen size={16} className="mr-1" />
            Learning
          </button>
          
          <button
            onClick={() => setFilterType("favorite")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center whitespace-nowrap flex-shrink-0 ${
              filterType === "favorite"
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
      {!loading && !isFiltering && (
        <div className="mb-4 text-sm text-neutral-500">
          {filteredVocabulary.length} {filteredVocabulary.length === 1 ? 'word' : 'words'} found
        </div>
      )}
      
      {/* Word List */}
      {loading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
          <span className="ml-3">Loading vocabulary...</span>
        </div>
      ) : isFiltering ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-red-500"></div>
          <span className="ml-3">Filtering words...</span>
        </div>
      ) : filteredVocabulary.length === 0 ? (
        <div className="text-center py-10">
          <div className="text-neutral-400 mb-2">No words found</div>
          <div className="text-sm text-neutral-500">Try adjusting your filters</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVocabulary.map(word => (
            <div 
              key={word.id}
              className="bg-white rounded-xl shadow-sm border border-neutral-100 overflow-hidden"
            >
              {/* Word Header - Clickable area */}
              <div className="p-4 cursor-pointer" onClick={() => toggleWordExpanded(word.id)}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center">
                      <span className="text-xl font-bold text-neutral-900">{word.simplified}</span>
                    </div>
                    <div className="text-sm text-red-500">{word.pinyin}</div>
                  </div>
                  
                  <div className="flex items-center">
                    {word.level === -1 ? (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium mr-2">
                        Chengyu
                      </span>
                    ) : (
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium mr-2">
                        HSK {word.level}
                      </span>
                    )}
                    
                    {/* Mastery Indicator - Only show for regular words, not chengyu */}
                    {word.level !== -1 && (
                      word.correctCount > 0 ? (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium mr-2">
                          Mastered
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium mr-2">
                          Learning
                        </span>
                      )
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
                    
                    {/* Expand indicator */}
                    <button className="text-neutral-400">
                      {selectedWordId === word.id ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </button>
                  </div>
                </div>
                
                {/* Meaning */}
                <div className="mt-1 text-sm text-neutral-700">
                  {word.level === -1 ? (
                      <div>
                        {word.meanings && word.meanings.includes('----') ? (
                            <p>{word.meanings.split('----')[0]}</p>
                        ) : (
                          <p>{word.meanings}</p>
                        )}
                      </div>
                    ) : (
                      <div>{word.meanings || word.english}</div>
                    )
                  }
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
              
              {/* Word Details - Expanded view */}
              {selectedWordId === word.id && (
                <div className="px-4 pb-2 pt-2 border-t border-neutral-100 bg-neutral-50">
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

                  {/* Examples Preview */}
                  {word.examples && word.examples.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-neutral-700 mb-2">Example:</div>
                      <div className="bg-white p-3 rounded-lg border border-neutral-100">
                        <div className="text-base">
                          {word.examples[0].simplified}
                        </div>
                        <div className="text-xs text-red-500 mt-1">{word.examples[0].pinyin}</div>
                        {word.examples.length > 1 && (
                          <div className="text-xs text-neutral-500 mt-2">
                            +{word.examples.length - 1} more examples
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-center space-x-4 mt-2">
                    <button
                      onClick={() => openWordDetail(word, 'vocabulary')}
                      className="px-2 py-1 bg-red-500 text-white rounded-lg text-sm font-medium"
                    >
                      MORE
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}