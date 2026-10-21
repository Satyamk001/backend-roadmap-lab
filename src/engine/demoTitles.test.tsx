import { describe, it, expect } from 'vitest';
import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { demoRegistry } from '../demos/registry';

describe('Demo to Tab Title Mapping Verification', () => {
  const contentStagesDir = path.resolve(process.cwd(), 'content', 'stages');
  const stageDirs = fs.readdirSync(contentStagesDir);

  const allDemosToTest: Array<{
    stageSlug: string;
    dayNumber: number;
    demoId: string;
    expectedTitle: string;
  }> = [];

  stageDirs.forEach((stageSlug) => {
    const stagePath = path.join(contentStagesDir, stageSlug);
    if (!fs.statSync(stagePath).isDirectory()) return;

    const dayDirs = fs.readdirSync(stagePath).filter((d) => d.startsWith('day-'));
    dayDirs.forEach((daySlug) => {
      const metaPath = path.join(stagePath, daySlug, 'meta.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        meta.demos?.forEach((d: { id: string; title: string }) => {
          allDemosToTest.push({
            stageSlug,
            dayNumber: meta.dayNumber,
            demoId: d.id,
            expectedTitle: d.title,
          });
        });
      }
    });
  });

  allDemosToTest.forEach(({ dayNumber, demoId, expectedTitle }) => {
    it(`renders demo "${expectedTitle}" (${demoId}) for Day ${dayNumber} with matching title in header`, async () => {
      const LazyComp = demoRegistry[demoId];
      expect(LazyComp, `Demo ID "${demoId}" must be registered in demoRegistry`).toBeDefined();

      render(
        <Suspense fallback={<div>Loading...</div>}>
          <LazyComp />
        </Suspense>
      );

      // Verify the rendered heading matches expected tab title
      const heading = await screen.findByRole('heading', { level: 2 });
      expect(heading.textContent?.trim()).toBe(expectedTitle);
    });
  });
});
