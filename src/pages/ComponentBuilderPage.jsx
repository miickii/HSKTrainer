import React, { useState, useEffect } from "react";
import { ArrowLeft, Info, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Import our custom components
import DraggableComponent from "../components/game/DraggableComponent";
import BuildArea from "../components/game/BuildArea";
import CharacterDisplay from "../components/game/CharacterDisplay";

export default function ComponentBuilderPage() {
  const navigate = useNavigate();
  const [componentData, setComponentData] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentCharacter, setCurrentCharacter] = useState(null);
  const [characterInfo, setCharacterInfo] = useState({ pinyin: "", meaning: "" });
  const [availableComponents, setAvailableComponents] = useState([]);
  const [placedComponents, setPlacedComponents] = useState([]);
  const [isCorrect, setIsCorrect] = useState(null);
  const [difficulty, setDifficulty] = useState("radical"); // "once", "radical", or "graphical"
  const [availableCharacters, setAvailableCharacters] = useState([]);
  const [showHint, setShowHint] = useState(false);

  // Load component data from JSON file
  useEffect(() => {
    const loadComponentData = async () => {
      try {
        setLoading(true);
        // In a real implementation, fetch this from your actual data location
        const response = await fetch(`${import.meta.env.BASE_URL}character_components.json`);
        if (!response.ok) {
          throw new Error("Failed to load component data");
        }
        
        const data = await response.json();
        setComponentData(data);
        
        // Extract available characters
        const characters = Object.keys(data);
        setAvailableCharacters(characters);
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading component data:", error);
        setLoading(false);
      }
    };
    
    loadComponentData();
  }, []);

  // Select a random character and set up the game
  const selectRandomCharacter = () => {
    if (availableCharacters.length === 0) return;
    
    setIsCorrect(null);
    setPlacedComponents([]);
    setShowHint(false);
    
    const randomIndex = Math.floor(Math.random() * availableCharacters.length);
    const selectedChar = availableCharacters[randomIndex];
    setCurrentCharacter(selectedChar);
    
    // Get character info
    if (componentData[selectedChar]) {
      setCharacterInfo({
        pinyin: componentData[selectedChar].pinyin || "",
        meaning: componentData[selectedChar].meaning || ""
      });
      
      // Get components based on difficulty level
      const components = componentData[selectedChar][difficulty] || [];
      
      // Shuffle components and set as available
      const shuffledComponents = [...components].sort(() => Math.random() - 0.5);
      setAvailableComponents(shuffledComponents);
    }
  };

  // Initialize the game when component data is loaded
  useEffect(() => {
    if (availableCharacters.length > 0 && !loading) {
      selectRandomCharacter();
    }
  }, [availableCharacters, loading, difficulty]);

  // Handle drag start for a component
  const handleDragStart = (e, component) => {
    e.dataTransfer.setData("component", component);
  };

  // Handle drop of a component into the build area
  const handleDrop = (e) => {
    e.preventDefault();
    const component = e.dataTransfer.getData("component");
    
    if (!availableComponents.includes(component)) return;
    
    setPlacedComponents([...placedComponents, component]);
    
    // Remove the component from available components
    setAvailableComponents(availableComponents.filter(c => c !== component));
  };

  // Handle removing a component from the build area
  const handleRemoveComponent = (index) => {
    const removedComponent = placedComponents[index];
    
    // Remove from placed components
    const newPlacedComponents = [...placedComponents];
    newPlacedComponents.splice(index, 1);
    setPlacedComponents(newPlacedComponents);
    
    // Add back to available components
    setAvailableComponents([...availableComponents, removedComponent]);
  };

  // Check if the current arrangement is correct
  const checkAnswer = () => {
    if (!currentCharacter || !componentData[currentCharacter]) return;
    
    const correctComponents = componentData[currentCharacter][difficulty] || [];
    
    // Sort both arrays to compare them regardless of order
    const sortedPlaced = [...placedComponents].sort();
    const sortedCorrect = [...correctComponents].sort();
    
    // Check if arrays have the same length and same elements
    const isEqual = sortedPlaced.length === sortedCorrect.length && 
      sortedPlaced.every((value, index) => value === sortedCorrect[index]);
    
    setIsCorrect(isEqual);
  };

  // Change difficulty level
  const changeDifficulty = (newDifficulty) => {
    if (difficulty === newDifficulty) return;
    
    setDifficulty(newDifficulty);
    
    // Reset the game with the new difficulty
    setIsCorrect(null);
    setPlacedComponents([]);
    
    // If we have a current character, update components based on new difficulty
    if (currentCharacter && componentData[currentCharacter]) {
      const components = componentData[currentCharacter][newDifficulty] || [];
      const shuffledComponents = [...components].sort(() => Math.random() - 0.5);
      setAvailableComponents(shuffledComponents);
    }
  };

  // Get component meanings for hints
  const getComponentMeanings = () => {
    if (!currentCharacter || !componentData[currentCharacter]) return {};
    
    // Return radical meanings if we have them
    return componentData[currentCharacter].radical_meanings || {};
  };

  // Toggle hint display
  const toggleHint = () => {
    setShowHint(!showHint);
  };

  // Reset the current game state
  const resetGame = () => {
    if (!currentCharacter || !componentData[currentCharacter]) return;
    
    setIsCorrect(null);
    setPlacedComponents([]);
    setShowHint(false);
    
    // Reset available components based on current difficulty
    const components = componentData[currentCharacter][difficulty] || [];
    const shuffledComponents = [...components].sort(() => Math.random() - 0.5);
    setAvailableComponents(shuffledComponents);
  };

  // Get component meanings for current radical components
  const componentMeanings = getComponentMeanings();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white p-4 border-b border-neutral-100 flex justify-between items-center safe-top safe-left safe-right z-10">
        <button onClick={() => navigate("/game-selection")} className="p-1 text-neutral-500">
          <ArrowLeft size={24} />
        </button>
        
        <h2 className="text-lg font-bold text-neutral-900">Component Builder</h2>
        
        <button onClick={toggleHint} className="p-1 text-neutral-500">
          <Info size={20} />
        </button>
      </div>
      
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto p-4 pb-16 safe-left safe-right">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : currentCharacter ? (
          <>
            {/* Character display */}
            <CharacterDisplay 
              character={currentCharacter} 
              pinyin={characterInfo.pinyin}
              meaning={characterInfo.meaning}
            />
            
            {/* Difficulty selector */}
            <div className="flex justify-center space-x-2 mb-6">
              <button 
                onClick={() => changeDifficulty("once")}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  difficulty === "once" 
                    ? "bg-blue-100 text-blue-800" 
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                Basic
              </button>
              <button 
                onClick={() => changeDifficulty("radical")}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  difficulty === "radical" 
                    ? "bg-blue-100 text-blue-800" 
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                Radical
              </button>
              <button 
                onClick={() => changeDifficulty("graphical")}
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  difficulty === "graphical" 
                    ? "bg-blue-100 text-blue-800" 
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                Advanced
              </button>
            </div>
            
            {/* Show hint if requested */}
            {showHint && Object.keys(componentMeanings).length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="font-medium text-blue-800 mb-2">Component Meanings:</h3>
                <ul className="space-y-1">
                  {Object.entries(componentMeanings).map(([component, meaning]) => (
                    <li key={component} className="flex items-start">
                      <span className="text-xl mr-2">{component}</span>
                      <span className="text-sm text-neutral-600">{meaning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Build area */}
            <div className="mb-6">
              <h3 className="text-neutral-600 text-sm mb-2">Build area:</h3>
              <BuildArea 
                onDrop={handleDrop} 
                placedComponents={placedComponents}
                onRemoveComponent={handleRemoveComponent}
              />
            </div>
            
            {/* Available components */}
            <div className="mb-6">
              <h3 className="text-neutral-600 text-sm mb-2">Available components:</h3>
              <div className="flex flex-wrap gap-2 justify-center">
                {availableComponents.map((component, index) => (
                  <DraggableComponent 
                    key={index} 
                    component={component} 
                    onDragStart={handleDragStart}
                    meaning={componentMeanings[component] || ""}
                  />
                ))}
              </div>
            </div>
            
            {/* Feedback area */}
            {isCorrect !== null && (
              <div className={`text-center p-4 rounded-lg mb-6 ${
                isCorrect ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}>
                {isCorrect ? (
                  <div className="flex items-center justify-center">
                    <CheckCircle className="mr-2" size={20} />
                    <span>Correct! Well done!</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <AlertTriangle className="mr-2" size={20} />
                    <span>Not quite right. Try again!</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex justify-center space-x-4">
              <button
                onClick={resetGame}
                className="px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg font-medium"
              >
                Reset
              </button>
              <button
                onClick={checkAnswer}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium"
                disabled={placedComponents.length === 0}
              >
                Check Answer
              </button>
              <button
                onClick={selectRandomCharacter}
                className="px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg font-medium flex items-center"
              >
                <RefreshCw size={18} className="mr-1" />
                New Character
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="p-8 bg-blue-50 rounded-xl border border-blue-100 mb-6 text-center">
              <h3 className="text-xl font-bold text-blue-800 mb-4">No Character Data</h3>
              <p className="text-neutral-700">
                Component data could not be loaded. Please make sure you've generated the character component data file.
              </p>
            </div>
            
            <button 
              onClick={() => navigate("/game-selection")}
              className="px-4 py-2 bg-neutral-100 text-neutral-800 rounded-lg font-medium"
            >
              Back to Game Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}