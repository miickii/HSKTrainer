import React from "react";
import { X } from "lucide-react";

const BuildArea = ({ onDrop, placedComponents, onRemoveComponent }) => {
  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div
      className="bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-xl p-4 min-h-40 flex items-center justify-center flex-wrap gap-2"
      onDragOver={handleDragOver}
      onDrop={onDrop}
    >
      {placedComponents.length === 0 ? (
        <p className="text-neutral-500">Drag components here</p>
      ) : (
        placedComponents.map((component, index) => (
          <div
            key={index}
            className="bg-white border border-neutral-200 rounded-lg p-2 text-2xl shadow-sm relative group"
          >
            {component}
            <button 
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onRemoveComponent(index)}
            >
              <X size={12} />
            </button>
          </div>
        ))
      )}
    </div>
  );
};

export default BuildArea;