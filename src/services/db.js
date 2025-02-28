// src/services/db.js
// This service handles all interactions with IndexedDB for offline storage

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
      const request = indexedDB.open('hsk-master-db', 1);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Vocabulary store
        if (!db.objectStoreNames.contains('vocabulary')) {
          const vocabStore = db.createObjectStore('vocabulary', { keyPath: 'id' });
          vocabStore.createIndex('by-level', 'level');
          vocabStore.createIndex('by-next-review', 'nextReview');
          vocabStore.createIndex('by-simplified', 'simplified');
        }
        
        // Practice history store
        if (!db.objectStoreNames.contains('practice-history')) {
          const historyStore = db.createObjectStore('practice-history', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          historyStore.createIndex('by-date', 'date');
        }
        
        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        
        // Sentences store
        if (!db.objectStoreNames.contains('sentences')) {
          const sentenceStore = db.createObjectStore('sentences', { 
            keyPath: 'id',
            autoIncrement: true
          });
          sentenceStore.createIndex('by-words', 'words', { multiEntry: true });
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
              results.push(cursor.value);
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
        const request = store.getAll();
        
        request.onsuccess = () => {
          let words = request.result;
          
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
    
    // Sync words from server - UPDATED WITH BATCH PROCESSING
    async syncFromServer(words) {
      console.log(`Starting to sync ${words.length} words to IndexedDB`);
    
      try {
        // Process words in batches to avoid transaction timeouts
        const BATCH_SIZE = 100;
        const batches = [];
        
        // Create batches
        for (let i = 0; i < words.length; i += BATCH_SIZE) {
          batches.push(words.slice(i, i + BATCH_SIZE));
        }
        
        console.log(`Processing ${batches.length} batches of up to ${BATCH_SIZE} words each`);
        
        // Get existing words first to use for reference
        const existingWords = await this.getAll();
        const existingMap = new Map();
        existingWords.forEach(word => {
          existingMap.set(word.id, word);
        });
        
        // Process each batch with a new transaction
        let totalProcessed = 0;
        
        for (const batch of batches) {
          await this._processBatch(batch, existingMap);
          totalProcessed += batch.length;
          console.log(`Processed ${totalProcessed}/${words.length} words`);
        }
        
        console.log(`Vocabulary sync complete: ${totalProcessed} words processed`);
        return totalProcessed;
      } catch (error) {
        console.error("Error syncing vocabulary:", error);
        throw error;
      }
    },
    
    // Helper method to process a batch of words
    async _processBatch(wordBatch, existingMap) {
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
        wordBatch.forEach(serverWord => {
          try {
            // If we already have this word, preserve SRS data
            if (existingMap.has(serverWord.id)) {
              const existingWord = existingMap.get(serverWord.id);
              // Preserve user progress data
              serverWord.srsLevel = existingWord.srsLevel || 0;
              serverWord.nextReview = existingWord.nextReview || new Date().toISOString().split('T')[0];
              serverWord.correctCount = existingWord.correctCount || 0;
              serverWord.incorrectCount = existingWord.incorrectCount || 0;
              serverWord.lastPracticed = existingWord.lastPracticed;
              serverWord.isFavorite = existingWord.isFavorite || false;
            } else {
              // Set default values for new words
              serverWord.srsLevel = 0;
              serverWord.nextReview = new Date().toISOString().split('T')[0]; // Due today
              serverWord.correctCount = 0;
              serverWord.incorrectCount = 0;
              serverWord.isFavorite = false;
            }
            
            // Store the word
            const request = store.put(serverWord);
            
            request.onsuccess = () => {
              completed++;
            };
            
            request.onerror = (e) => {
              console.error(`Error storing word ${serverWord.id}:`, e.target.error);
              // Continue with other words even if one fails
            };
          } catch (e) {
            console.error(`Error processing word ${serverWord.id}:`, e);
            // Continue with other words even if one fails
          }
        });
        
        // Handle empty batch case
        if (total === 0) {
          resolve(0);
        }
      });
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
    }
  };
  
  // Practice history database operations
  export const practiceHistoryDB = {
    // Add a practice session record
    async addPracticeRecord(record) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('practice-history', 'readwrite');
        const store = transaction.objectStore('practice-history');
        
        // Add timestamp if not provided
        if (!record.date) {
          record.date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        }
        
        const request = store.add(record);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    
    // Get practice history for a date range
    async getPracticeHistory(days = 7) {
      const db = await openDB();
      
      // Calculate the start date
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('practice-history', 'readonly');
        const store = transaction.objectStore('practice-history');
        const index = store.index('by-date');
        const request = index.getAll(IDBKeyRange.lowerBound(startDateStr));
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    
    // Get today's practice statistics
    async getTodayStats() {
      const today = new Date().toISOString().split('T')[0];
      const records = await this.getPracticeHistory(0); // Get only today
      
      const todayRecords = records.filter(r => r.date === today);
      
      // Calculate statistics
      const wordsReviewed = new Set();
      let correctCount = 0;
      let incorrectCount = 0;
      
      todayRecords.forEach(record => {
        record.results.forEach(result => {
          wordsReviewed.add(result.wordId);
          if (result.wasCorrect) {
            correctCount++;
          } else {
            incorrectCount++;
          }
        });
      });
      
      return {
        totalSessions: todayRecords.length,
        uniqueWords: wordsReviewed.size,
        correctCount,
        incorrectCount,
        accuracy: correctCount + incorrectCount === 0 
          ? 0 
          : (correctCount / (correctCount + incorrectCount) * 100).toFixed(1)
      };
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
  
  // Sentence database operations for offline practice
  export const sentenceDB = {
    // Save a practice sentence
    async saveSentence(sentence) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('sentences', 'readwrite');
        const store = transaction.objectStore('sentences');
        
        // Extract words for indexing
        if (sentence.simplified) {
          sentence.words = sentence.simplified.split('').filter(char => /\p{Script=Han}/u.test(char));
        }
        
        const request = store.add(sentence);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    },
    
    // Get sentences containing specific words
    async getSentencesWithWords(words) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('sentences', 'readonly');
        const store = transaction.objectStore('sentences');
        const index = store.index('by-words');
        
        const results = [];
        const promises = words.map(word => {
          return new Promise((innerResolve) => {
            const request = index.getAll(word);
            request.onsuccess = () => innerResolve(request.result);
            request.onerror = () => innerResolve([]); // Continue even if one fails
          });
        });
        
        Promise.all(promises)
          .then(sentences => {
            // Flatten and deduplicate sentences
            const flatSentences = [].concat(...sentences);
            const uniqueSentences = Array.from(
              new Map(flatSentences.map(s => [s.id, s])).values()
            );
            resolve(uniqueSentences);
          })
          .catch(reject);
      });
    },
    
    // Get random sentences for offline practice
    async getRandomSentences(count = 5) {
      const sentences = await this.getAllSentences();
      const shuffled = sentences.sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    },
    
    // Get all saved sentences
    async getAllSentences() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('sentences', 'readonly');
        const store = transaction.objectStore('sentences');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  };