import React, { useState } from 'react';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';

interface AIExplanationBoxProps {
  explanation: string;
  model?: string;
  damageScore: number;
  priorityScore: number;
}

export const AIExplanationBox: React.FC<AIExplanationBoxProps> = ({
  explanation,
  model = 'PrioritAI-v2.1',
  damageScore,
  priorityScore,
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-gradient-to-br from-blue-950 to-slate-900 rounded-xl border border-blue-800/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-semibold text-blue-300">AI Assessment</span>
          <span className="text-xs text-slate-500 ml-1">· {model}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">
              Damage:{' '}
              <span className="font-bold text-orange-400">{damageScore}/10</span>
            </span>
            <span className="text-slate-400">
              Priority:{' '}
              <span className="font-bold text-red-400">{priorityScore.toFixed(1)}/10</span>
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-5 pb-5">
          <div className="flex gap-4 mb-4">
            {/* Damage Score Bar */}
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">Damage Score</p>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all"
                  style={{ width: `${(damageScore / 10) * 100}%` }}
                />
              </div>
              <p className="text-sm font-bold text-orange-400 mt-1">{damageScore}/10</p>
            </div>
            {/* Priority Score Bar */}
            <div className="flex-1">
              <p className="text-xs text-slate-500 mb-1">Priority Score</p>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-red-600 rounded-full transition-all"
                  style={{ width: `${(priorityScore / 10) * 100}%` }}
                />
              </div>
              <p className="text-sm font-bold text-red-400 mt-1">{priorityScore.toFixed(1)}/10</p>
            </div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{explanation}</p>
        </div>
      )}
    </div>
  );
};