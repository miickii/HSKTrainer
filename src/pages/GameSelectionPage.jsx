import React from "react";
import { Mic, Puzzle, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function GameSelectionPage() {
  const navigate = useNavigate();

  const gameModes = [
    {
      id: "practice",
      title: "Practice Mode",
      description: "Improve your pronunciation and character recognition with speech practice",
      icon: <Mic size={32} className="text-red-500" />,
      color: "bg-red-50 border-red-100",
      textColor: "text-red-800",
      path: "/practice"
    },
    {
      id: "component-builder",
      title: "Component Builder",
      description: "Learn character structure by building characters from their components",
      icon: <Puzzle size={32} className="text-blue-500" />,
      color: "bg-blue-50 border-blue-100",
      textColor: "text-blue-800",
      path: "/component-builder"
    }
  ];

  return (
    <div className="p-4 pb-16">
      <h1 className="text-2xl font-bold text-neutral-900 mb-6 text-center">Learning Modes</h1>
      
      <div className="space-y-4">
        {gameModes.map((mode) => (
          <div 
            key={mode.id}
            className={`rounded-xl border ${mode.color} p-4 cursor-pointer`}
            onClick={() => navigate(mode.path)}
          >
            <div className="flex items-start">
              <div className="mr-4">
                {mode.icon}
              </div>
              <div className="flex-1">
                <h2 className={`font-bold text-lg ${mode.textColor}`}>{mode.title}</h2>
                <p className="text-neutral-600 text-sm mt-1">{mode.description}</p>
              </div>
              <div className="flex items-center">
                <ArrowRight size={20} className="text-neutral-400" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 text-sm text-neutral-500 text-center">
        Select a learning mode to begin practice
      </div>
    </div>
  );
}