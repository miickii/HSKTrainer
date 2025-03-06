import React from "react";

const DraggableComponent = ({ component, onDragStart, meaning }) => {
  return (
    <div
      className="bg-white border border-neutral-200 rounded-lg p-2 text-2xl shadow-sm cursor-move relative group"
      draggable
      onDragStart={(e) => onDragStart(e, component)}
    >
      {component}
      
      {/* Show meaning on hover if available */}
      {meaning && (
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-neutral-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
          {meaning}
        </div>
      )}
    </div>
  );
};

export default DraggableComponent;