import React, { useState } from 'react';
import { Brain, Play, CheckCircle, Cpu, Zap } from 'lucide-react';
import { PageContainer } from '../../components/layout/PageContainer';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useEventStore } from '../../store/authStore';
import { useAuth } from '../../hooks';
import { EventStatus } from '../../types';

interface ModelRun {
  id: string;
  timestamp: Date;
  eventsProcessed: number;
  avgPriorityBefore: number;
  avgPriorityAfter: number;
  duration: number;
}

export const ModelRunner: React.FC = () => {
  const { user } = useAuth();
  const { events, updateEvent } = useEventStore();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [runs, setRuns] = useState<ModelRun[]>([]);

  const orgEvents = events.filter(
    (e) => user?.organizationId != null && e.organizationId === user.organizationId,
  );
  const pendingEvents = orgEvents.filter((e) => e.status === EventStatus.PENDING);

  const handleRun = async () => {
    if (pendingEvents.length === 0) return;
    setIsRunning(true);
    setProgress(0);

    const before = pendingEvents.length > 0
      ? Math.round(pendingEvents.reduce((s, e) => s + e.priorityScore, 0) / pendingEvents.length)
      : 0;

    const start = Date.now();

    for (let i = 0; i < pendingEvents.length; i++) {
      await new Promise((r) => setTimeout(r, 400));
      const e = pendingEvents[i];
      const newDamage = Math.min(100, e.damageScore + Math.floor(Math.random() * 8 - 2));
      const newPriority = Math.min(100, Math.round(newDamage * 0.85 + Math.random() * 15));
      updateEvent(e.id, {
        damageScore: newDamage,
        priorityScore: newPriority,
        llmExplanation: `[Model run ${new Date().toLocaleTimeString()}] ` + e.llmExplanation,
      });
      setProgress(Math.round(((i + 1) / pendingEvents.length) * 100));
    }

    const updatedPending = events.filter(
      (e) =>
        user?.organizationId != null &&
        e.organizationId === user.organizationId &&
        e.status === EventStatus.PENDING,
    );
    const after = updatedPending.length > 0
      ? Math.round(updatedPending.reduce((s, e) => s + e.priorityScore, 0) / updatedPending.length)
      : 0;

    const duration = Math.round((Date.now() - start) / 1000);

    setRuns((prev) => [
      {
        id: `run-${Date.now()}`,
        timestamp: new Date(),
        eventsProcessed: pendingEvents.length,
        avgPriorityBefore: before,
        avgPriorityAfter: after,
        duration,
      },
      ...prev,
    ]);

    setIsRunning(false);
    setProgress(0);
  };

  return (
    <PageContainer title="AI Model Runner">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center flex-shrink-0">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-bold text-gray-900">PrioritAI-v2.1</h3>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                Damage assessment and priority scoring model trained on 50,000+ building damage events.
                Combines visual analysis with location and contextual factors.
              </p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900">94.7%</p>
                  <p className="text-xs text-gray-500 mt-0.5">Accuracy</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900">~0.4s</p>
                  <p className="text-xs text-gray-500 mt-0.5">Per Event</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900">v2.1</p>
                  <p className="text-xs text-gray-500 mt-0.5">Version</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Run Assessment" subtitle={`${pendingEvents.length} events awaiting scoring`}>
          {isRunning ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-gray-600 flex items-center gap-2">
                  <Cpu className="w-4 h-4 animate-pulse text-blue-500" />
                  Processing events...
                </span>
                <span className="font-semibold text-blue-600">{progress}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                Assessed {Math.round((progress / 100) * pendingEvents.length)} of {pendingEvents.length} events
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Button
                icon={<Play className="w-4 h-4" />}
                onClick={handleRun}
                disabled={pendingEvents.length === 0}
                size="lg"
              >
                {pendingEvents.length === 0 ? 'No Pending Events' : `Run on ${pendingEvents.length} Events`}
              </Button>
              {pendingEvents.length === 0 && (
                <p className="text-sm text-gray-500 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  All events have been scored
                </p>
              )}
            </div>
          )}
        </Card>

        {runs.length > 0 && (
          <Card title="Run History" subtitle="Previous model executions">
            <div className="space-y-3">
              {runs.map((run) => (
                <div key={run.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center">
                    <Zap className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Timestamp</p>
                      <p className="font-medium text-gray-900">{run.timestamp.toLocaleTimeString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Events</p>
                      <p className="font-medium text-gray-900">{run.eventsProcessed} scored</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Duration</p>
                      <p className="font-medium text-gray-900">{run.duration}s</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Avg Priority</p>
                      <p className="font-medium text-gray-900">{run.avgPriorityBefore} → {run.avgPriorityAfter}</p>
                    </div>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </PageContainer>
  );
};
