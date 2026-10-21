import React, { Suspense, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getStage, getDay, getDemo } from '../lib/content';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { getDemoComponent } from '../demos/registry';
import { ArrowLeft, Share2, Check } from 'lucide-react';
import { Button } from '../components/common/Button';

export const SingleDemoPage: React.FC = () => {
  const { stageId, dayId, demoId } = useParams();
  const stage = getStage(stageId || '');
  const day = getDay(stageId || '', dayId || '');
  const demo = getDemo(stageId || '', dayId || '', demoId || '');

  const [copied, setCopied] = useState(false);

  if (!stage || !day || !demo) {
    return <Navigate to="/" replace />;
  }

  const DemoComponent = getDemoComponent(demo.id);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto py-2">
      {/* Top Bar with Breadcrumbs & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs
          items={[
            { label: stage.title, path: `/stage/${stage.id}` },
            { label: `Day ${day.dayNumber}`, path: `/stage/${stage.id}/day/${day.dayNumber}` },
            { label: demo.title },
          ]}
        />

        <div className="flex items-center gap-2">
          <Link to={`/stage/${stage.id}/day/${day.dayNumber}`}>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back to Day Notes
            </Button>
          </Link>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleShare}
            icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
          >
            {copied ? 'Link Copied!' : 'Share Demo URL'}
          </Button>
        </div>
      </div>

      {/* Full-Screen Simulation Stage */}
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-16 bg-theme-surface border border-theme-border rounded-xl">
            <div className="animate-spin text-amber-500 font-bold text-2xl">⚡</div>
            <span className="ml-3 text-sm text-theme-muted font-mono">
              Loading full simulation environment...
            </span>
          </div>
        }
      >
        <DemoComponent />
      </Suspense>
    </div>
  );
};
