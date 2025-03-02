// src/services/sentence-db.js
// This service handles sentences stored with words in the vocabulary DB

/**
 * Helper function to extract sentences from words
 * @param {Array} words - Array of vocabulary words
 * @returns {Array} - Unique sentences extracted from all words
 */
const extractSentencesFromWords = (words) => {
    const sentencesMap = new Map();
    
    // Extract all sentences from all words
    words.forEach(word => {
      if (word.sentences && Array.isArray(word.sentences)) {
        word.sentences.forEach(sentence => {
          if (sentence.id && !sentencesMap.has(sentence.id)) {
            sentencesMap.set(sentence.id, sentence);
          }
        });
      }
    });
    
    // Convert map to array
    return Array.from(sentencesMap.values());
  };
  
  // Sentences database operations
  export const sentenceDB = {
    // Get all sentences
    async getAllSentences() {
      // Import the vocabularyDB without causing circular dependencies
      const { vocabularyDB } = await import('./db');
      
      try {
        // Get all words first
        const words = await vocabularyDB.getAll();
        
        // Extract sentences from words
        return extractSentencesFromWords(words);
      } catch (error) {
        console.error("Error getting all sentences:", error);
        throw error;
      }
    },
    
    // Get random sentence from a word
    async getRandomSentenceFromWord(word) {
      if (!word || !word.sentences || word.sentences.length === 0) {
        return null;
      }
      
      // Pick a random sentence from the word
      const randomIndex = Math.floor(Math.random() * word.sentences.length);
      return word.sentences[randomIndex];
    },
    
    // Get random sentence (legacy method - prefer using words first)
    async getRandomSentence(levelFilter = null) {
      // Import the vocabularyDB without causing circular dependencies
      const { vocabularyDB } = await import('./db');
      
      try {
        // Get words that match the level filter, or all words if no filter
        let words;
        if (levelFilter !== null) {
          words = await vocabularyDB.getByLevel(levelFilter);
        } else {
          words = await vocabularyDB.getAll();
        }
        
        // Filter words that have sentences
        const wordsWithSentences = words.filter(
          word => word.sentences && word.sentences.length > 0
        );
        
        if (wordsWithSentences.length === 0) {
          return null;
        }
        
        // Pick a random word with sentences
        const randomWordIndex = Math.floor(Math.random() * wordsWithSentences.length);
        const randomWord = wordsWithSentences[randomWordIndex];
        
        return this.getRandomSentenceFromWord(randomWord);
      } catch (error) {
        console.error("Error getting random sentence:", error);
        throw error;
      }
    },
    
    // Import sentences (for backward compatibility)
    async importSentences(sentences) {
      console.log(`Received ${sentences.length} sentences to import`);
      // In the new structure, sentences are imported along with words
      // This method exists for backward compatibility
      return sentences.length;
    }
  };
  
  export default sentenceDB;