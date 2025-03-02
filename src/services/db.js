// src/services/db.js
// Enhanced version with better sentence handling and SRS functionality

// Calculate next review date based on SRS level
const calculateNextReview = (srsLevel, wasCorrect) => {
  // SRS intervals in days (exponentially increasing)
  const intervals = [1, 3, 7, 14, 30, 60, 120, 240];
  
  let nextLevel;
  if (wasCorrect) {
    // Move to next level (max at highest interval)
    nextLevel = Math.min(srsLevel + 1, intervals.length - 1);
  } else {
    // Reset or step back
    nextLevel = Math.max(0, srsLevel - 2);
  }
  
  const daysUntilNextReview = intervals[nextLevel];
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + daysUntilNextReview);
  
  return {
    srsLevel: nextLevel,
    nextReview: nextReviewDate.toISOString().split('T')[0] // YYYY-MM-DD format
  };
};

// Open the database
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('hsk-master-db', 3); // Increased version for schema changes
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Vocabulary store - main store for all words
      if (!db.objectStoreNames.contains('vocabulary')) {
        const vocabStore = db.createObjectStore('vocabulary', { keyPath: 'id' });
        vocabStore.createIndex('by-level', 'level');
        vocabStore.createIndex('by-next-review', 'nextReview');
        vocabStore.createIndex('by-simplified', 'simplified');
      }
      
      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    
    request.onsuccess = (event) => {
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
};

// Vocabulary database operations
export const vocabularyDB = {
  // Get all words
  async getAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('vocabulary', 'readonly');
      const store = transaction.objectStore('vocabulary');
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  // Get words by HSK level
  async getByLevel(level) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('vocabulary', 'readonly');
      const store = transaction.objectStore('vocabulary');
      const index = store.index('by-level');
      const request = index.getAll(level);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  
  // Get words due for review
  async getDueForReview(count = 20, level = null) {
    const db = await openDB();
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('vocabulary', 'readonly');
      const store = transaction.objectStore('vocabulary');
      const index = store.index('by-next-review');
      const request = index.openCursor(IDBKeyRange.upperBound(today));
      
      const results = [];
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          // Add words at the specified level, or all levels if level is null
          if (level === null || cursor.value.level === level) {
            // Only include words that have examples
            if (cursor.value.examples && 
                Array.isArray(JSON.parse(cursor.value.examples || '[]')) && 
                JSON.parse(cursor.value.examples || '[]').length > 0) {
              results.push(cursor.value);
            }
          }
          
          if (results.length < count) {
            cursor.continue();
          } else {
            resolve(results);
          }
        } else {
          // If we don't have enough words due for review, we'll need to supplement
          if (results.length < count) {
            // First try to get more words at the right level that aren't due yet
            this.getRandomWords(count - results.length, level, results.map(w => w.id))
              .then(additionalWords => {
                resolve([...results, ...additionalWords]);
              })
              .catch(reject);
          } else {
            resolve(results);
          }
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  },
  
  // Get random words for practice
  async getRandomWords(count = 20, level = null, excludeIds = []) {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('vocabulary', 'readonly');
      const store = transaction.objectStore('vocabulary');
      
      // Get all words
      const request = store.getAll();
      
      request.onsuccess = () => {
        let words = request.result.filter(word => {
          // Only include words with examples
          try {
            const examples = JSON.parse(word.examples || '[]');
            return Array.isArray(examples) && examples.length > 0;
          } catch (e) {
            return false;
          }
        });
        
        // Filter by level if specified
        if (level !== null) {
          words = words.filter(word => word.level === level);
        }
        
        // Exclude words we already have
        if (excludeIds.length > 0) {
          words = words.filter(word => !excludeIds.includes(word.id));
        }
        
        // Shuffle and limit to count
        const shuffled = words.sort(() => 0.5 - Math.random());
        resolve(shuffled.slice(0, count));
      };
      
      request.onerror = () => reject(request.error);
    });
  },
  
  // Get a word by its simplified form
  async getBySimplified(simplified) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('vocabulary', 'readonly');
      const store = transaction.objectStore('vocabulary');
      const index = store.index('by-simplified');
      const request = index.get(simplified);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },
  
  // Update a word's SRS information after practice
  async updateWordAfterPractice(id, wasCorrect) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('vocabulary', 'readwrite');
      const store = transaction.objectStore('vocabulary');
      const request = store.get(id);
      
      request.onsuccess = () => {
        const word = request.result;
        if (!word) {
          reject(new Error(`Word with id ${id} not found`));
          return;
        }
        
        // Update SRS level and next review date
        const { srsLevel, nextReview } = calculateNextReview(
          word.srsLevel || 0, 
          wasCorrect
        );
        
        word.srsLevel = srsLevel;
        word.nextReview = nextReview;
        
        // Update correct/incorrect counts
        if (wasCorrect) {
          word.correctCount = (word.correctCount || 0) + 1;
        } else {
          word.incorrectCount = (word.incorrectCount || 0) + 1;
        }
        
        // Update last practiced date
        word.lastPracticed = new Date().toISOString();
        
        // Save updated word
        const updateRequest = store.put(word);
        
        updateRequest.onsuccess = () => resolve(word);
        updateRequest.onerror = () => reject(updateRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  },
  
  // Import full database from server
  async importFromServer(words) {
    console.log(`Starting to import ${words.length} words to IndexedDB`);
  
    try {
      // Process words in batches to avoid transaction timeouts
      const BATCH_SIZE = 100;
      const batches = [];
      
      // Create batches
      for (let i = 0; i < words.length; i += BATCH_SIZE) {
        batches.push(words.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`Processing ${batches.length} batches of up to ${BATCH_SIZE} words each`);
      
      // Process each batch with a new transaction
      let totalProcessed = 0;
      
      // Clear the store first
      const db = await openDB();
      const clearTransaction = db.transaction('vocabulary', 'readwrite');
      const store = clearTransaction.objectStore('vocabulary');
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () => reject(clearRequest.error);
      });
      
      // Import new words
      for (const batch of batches) {
        await this._processBatch(batch);
        totalProcessed += batch.length;
        console.log(`Processed ${totalProcessed}/${words.length} words`);
      }
      
      console.log(`Vocabulary import complete: ${totalProcessed} words processed`);
      
      // Update import timestamp
      localStorage.setItem('lastDatabaseImport', new Date().toISOString());
      
      return totalProcessed;
    } catch (error) {
      console.error("Error importing vocabulary:", error);
      throw error;
    }
  },
  
  // Helper method to process a batch of words
  async _processBatch(wordBatch) {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('vocabulary', 'readwrite');
      const store = transaction.objectStore('vocabulary');
      
      let completed = 0;
      let total = wordBatch.length;
      
      // Handle transaction errors
      transaction.onerror = (event) => {
        reject(new Error(`Transaction error: ${event.target.error}`));
      };
      
      // Complete the promise when the transaction is done
      transaction.oncomplete = () => {
        resolve(completed);
      };
      
      // Process each word in the batch
      wordBatch.forEach(word => {
        try {
          // Make sure word has all required fields
          if (!word.srsLevel) word.srsLevel = 0;
          if (!word.nextReview) {
            const today = new Date();
            word.nextReview = today.toISOString().split('T')[0];
          }
          if (!word.correctCount) word.correctCount = 0;
          if (!word.incorrectCount) word.incorrectCount = 0;
          if (word.isFavorite === undefined) word.isFavorite = false;
          
          // Store the word
          const request = store.put(word);
          
          request.onsuccess = () => {
            completed++;
          };
          
          request.onerror = (e) => {
            console.error(`Error storing word ${word.id}:`, e.target.error);
            // Continue with other words even if one fails
          };
        } catch (e) {
          console.error(`Error processing word ${word.id}:`, e);
          // Continue with other words even if one fails
        }
      });
      
      // Handle empty batch case
      if (total === 0) {
        resolve(0);
      }
    });
  },
  
  // Get a random example sentence from a word
  async getRandomSentenceForWord(word) {
    try {
      // Parse examples
      let examples = [];
      if (word.examples) {
        try {
          examples = JSON.parse(word.examples);
          if (!Array.isArray(examples)) {
            examples = [];
          }
        } catch (e) {
          console.error("Error parsing examples:", e);
        }
      }
      
      if (examples.length === 0) {
        return null;
      }
      
      // Pick a random example
      const randomIndex = Math.floor(Math.random() * examples.length);
      return examples[randomIndex];
    } catch (error) {
      console.error("Error getting random sentence:", error);
      return null;
    }
  },
  
  // Export SRS progress data for backup
  async exportProgress() {
    try {
      const words = await this.getAll();
      
      // Extract only the progress-related data
      const progressData = words.map(word => ({
        id: word.id,
        simplified: word.simplified,
        srsLevel: word.srsLevel || 0,
        nextReview: word.nextReview,
        correctCount: word.correctCount || 0,
        incorrectCount: word.incorrectCount || 0,
        lastPracticed: word.lastPracticed,
        isFavorite: word.isFavorite || false
      }));
      
      return {
        exportDate: new Date().toISOString(),
        progressData
      };
    } catch (error) {
      console.error("Error exporting progress:", error);
      throw error;
    }
  },
  
  // Import SRS progress data from backup
  async importProgress(progressData) {
    try {
      if (!progressData || !progressData.progressData || !Array.isArray(progressData.progressData)) {
        throw new Error("Invalid progress data format");
      }
      
      const db = await openDB();
      
      // Process in batches
      const BATCH_SIZE = 100;
      let processed = 0;
      
      for (let i = 0; i < progressData.progressData.length; i += BATCH_SIZE) {
        const batch = progressData.progressData.slice(i, i + BATCH_SIZE);
        
        await new Promise((resolve, reject) => {
          const transaction = db.transaction('vocabulary', 'readwrite');
          const store = transaction.objectStore('vocabulary');
          
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          
          batch.forEach(progressItem => {
            // Get the existing word
            const getRequest = store.get(progressItem.id);
            
            getRequest.onsuccess = () => {
              const word = getRequest.result;
              if (word) {
                // Update progress data
                word.srsLevel = progressItem.srsLevel;
                word.nextReview = progressItem.nextReview;
                word.correctCount = progressItem.correctCount;
                word.incorrectCount = progressItem.incorrectCount;
                word.lastPracticed = progressItem.lastPracticed;
                word.isFavorite = progressItem.isFavorite;
                
                // Save updated word
                store.put(word);
              }
            };
          });
        });
        
        processed += batch.length;
        console.log(`Imported progress for ${processed}/${progressData.progressData.length} words`);
      }
      
      return processed;
    } catch (error) {
      console.error("Error importing progress:", error);
      throw error;
    }
  },
  
  // Toggle favorite status of a word
  async toggleFavorite(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('vocabulary', 'readwrite');
      const store = transaction.objectStore('vocabulary');
      const request = store.get(id);
      
      request.onsuccess = () => {
        const word = request.result;
        if (!word) {
          reject(new Error(`Word with id ${id} not found`));
          return;
        }
        
        // Toggle favorite status
        word.isFavorite = !word.isFavorite;
        
        // Save updated word
        const updateRequest = store.put(word);
        
        updateRequest.onsuccess = () => resolve(word);
        updateRequest.onerror = () => reject(updateRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  },
  
  // Get all favorite words
  async getFavorites() {
    const words = await this.getAll();
    return words.filter(word => word.isFavorite);
  },
  
  // Reset all learning progress
  async resetAllProgress() {
    const db = await openDB();
    
    try {
      const words = await this.getAll();
      
      // Process in batches
      const BATCH_SIZE = 100;
      let processed = 0;
      
      for (let i = 0; i < words.length; i += BATCH_SIZE) {
        const batch = words.slice(i, i + BATCH_SIZE);
        
        await new Promise((resolve, reject) => {
          const transaction = db.transaction('vocabulary', 'readwrite');
          const store = transaction.objectStore('vocabulary');
          
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
          
          batch.forEach(word => {
            // Reset learning data
            word.srsLevel = 0;
            word.nextReview = new Date().toISOString().split('T')[0]; // Due today
            word.correctCount = 0;
            word.incorrectCount = 0;
            word.lastPracticed = null;
            
            // Keep favorite status as is
            
            // Save updated word
            store.put(word);
          });
        });
        
        processed += batch.length;
        console.log(`Reset progress for ${processed}/${words.length} words`);
      }
      
      return processed;
    } catch (error) {
      console.error("Error resetting progress:", error);
      throw error;
    }
  },
  
  // Check if database is empty and needs initialization
  async isDatabaseEmpty() {
    try {
      const words = await this.getAll();
      return words.length === 0;
    } catch (error) {
      console.error("Error checking if database is empty:", error);
      return true; // Assume empty if there's an error
    }
  }
};

// Settings database operations
export const settingsDB = {
  // Get a setting value
  async getSetting(key, defaultValue = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);
      
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value);
        } else {
          resolve(defaultValue);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  },
  
  // Save a setting
  async saveSetting(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });
      
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  },
  
  // Get all settings
  async getAllSettings() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('settings', 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.getAll();
      
      request.onsuccess = () => {
        const settings = {};
        request.result.forEach(item => {
          settings[item.key] = item.value;
        });
        resolve(settings);
      };
      
      request.onerror = () => reject(request.error);
    });
  }
};