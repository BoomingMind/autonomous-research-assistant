import cors from 'cors';
import express, { Request, Response } from 'express';

import { deepResearch, writeFinalAnswer } from './deep-research';
import { generateFeedback } from './feedback';
import { OutputManager } from './output-manager';

const app = express();
const port = process.env.PORT || 3051;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize output manager
const output = new OutputManager();

// Helper function for consistent logging
function log(...args: any[]) {
  output.log(...args);
}

// API endpoint to run research
app.post('/api/research', async (req: Request, res: Response) => {
  try {
    const { query, depth = 3, breadth = 3 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    log('\nResearching your topic...');
    log('\nStarting research with progress tracking...\n');

    const { learnings, visitedUrls } = await deepResearch({
      query,
      breadth,
      depth,
      onProgress: progress => {
        output.updateProgress(progress);
      },
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(
      `\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`,
    );
    log('Writing final answer...');

    // Save report to file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = `output-${timestamp}.md`;
    // await fs.writeFile(reportFilename, report, 'utf-8');

    const answer = await writeFinalAnswer({
      prompt: query,
      learnings,
    });

    // Save answer to file
    const answerFilename = `answer-${timestamp}.md`;
    // await fs.writeFile(answerFilename, answer, 'utf-8');

    // Return the results
    return res.json({
      success: true,
      answer,
      learnings,
      visitedUrls,
      reportFilename,
      answerFilename,
    });
  } catch (error: unknown) {
    console.error('Error in research API:', error);
    return res.status(500).json({
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Deep Research API running on port ${port}`);
});

export default app;
