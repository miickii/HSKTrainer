import React from "react";
import { Volume2 } from "lucide-react";

const CharacterDisplay = ({ character, pinyin, meaning }) => {
  return (
    <div className="text-center mb-6">
      <h3 className="text-neutral-600 text-sm mb-2">Build this character:</h3>
      <div className="text-6xl font-bold mb-2">{character}</div>
      
      {pinyin && (
        <div className="text-red-500 text-lg mb-1 flex items-center justify-center">
          {pinyin}
          <button className="ml-2 text-neutral-400 hover:text-neutral-600">
            <Volume2 size={16} />
          </button>
        </div>
      )}
      
      {meaning && (
        <div className="text-sm text-neutral-600">{meaning}</div>
      )}
    </div>
  );
};

export default CharacterDisplay;