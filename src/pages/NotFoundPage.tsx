import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, ArrowLeft, Compass, Calendar } from 'lucide-react';
import { Button } from '../components/common/Button';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-xl mx-auto py-16 px-4 text-center space-y-6">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-theme-surface-alt border border-theme-border text-theme-accent shadow-xs">
        <Compass className="w-7 h-7" />
      </div>

      <div className="space-y-2">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-theme-muted">
          Error 404
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-theme-text tracking-tight">
          Topic nahi mila (Page not found)
        </h1>
        <p className="text-sm text-theme-muted max-w-md mx-auto leading-relaxed">
          Aap jis stage ya study day par jane ki koshish kar rahe hain, wo is roadmap snapshot me exist nahi karta ya move ho gaya hai.
        </p>
      </div>

      {/* Suggested Fast Destinations */}
      <div className="p-4 bg-theme-surface border border-theme-border rounded-xl text-left space-y-2.5 shadow-xs">
        <div className="text-xs font-mono font-semibold text-theme-muted uppercase tracking-wider">
          Popular active study days:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <Link
            to="/stage/s6-queues-async/day/38"
            className="flex items-center gap-2 p-2.5 rounded-lg bg-theme-surface-alt hover:bg-amber-200/40 dark:hover:bg-stone-800 transition-colors text-theme-text font-medium"
          >
            <Calendar className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span className="truncate">Day 38: Kafka Demos</span>
          </Link>
          <Link
            to="/stage/s6-queues-async/day/37"
            className="flex items-center gap-2 p-2.5 rounded-lg bg-theme-surface-alt hover:bg-amber-200/40 dark:hover:bg-stone-800 transition-colors text-theme-text font-medium"
          >
            <Calendar className="w-3.5 h-3.5 text-theme-accent shrink-0" />
            <span className="truncate">Day 37: RabbitMQ Routing</span>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button
          variant="secondary"
          size="md"
          onClick={() => navigate(-1)}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Go Back
        </Button>
        <Link to="/">
          <Button variant="primary" size="md" icon={<Home className="w-4 h-4" />}>
            Roadmap Home
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
