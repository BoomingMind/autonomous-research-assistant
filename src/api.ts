import express, { Request, Response } from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import { deepResearch, writeFinalReport, writeFinalAnswer } from './deep-research';
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
    const { query, followUpAnswers = [], depth = 3, breadth = 3 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    log(`Creating research plan for: ${query}`);

    // Generate follow-up questions
    const followUpQuestions = await generateFeedback({
      query,
      numQuestions: 0
    });

    // Combine all information for deep research
    let combinedQuery = `Initial Query: ${query}`;
    
    if (followUpQuestions.length > 0 && followUpAnswers.length > 0) {
      combinedQuery += `\nFollow-up Questions and Answers:\n${
        followUpQuestions
          .slice(0, followUpAnswers.length)
          .map((q: string, i: number) => `Q: ${q}\nA: ${followUpAnswers[i]}`)
          .join('\n')
      }`;
    }

    log('\nResearching your topic...');
    log('\nStarting research with progress tracking...\n');
    
    // Track progress
    let currentProgress = {};
    
    const { learnings, visitedUrls } = await deepResearch({
      query: combinedQuery,
      breadth,
      depth,
      onProgress: (progress) => {
        output.updateProgress(progress);
        currentProgress = progress;
      },
    });

    log(`\n\nLearnings:\n\n${learnings.join('\n')}`);
    log(`\n\nVisited URLs (${visitedUrls.length}):\n\n${visitedUrls.join('\n')}`);
    log('Writing final report...');

    const report = await writeFinalReport({
      prompt: combinedQuery,
      learnings,
      visitedUrls,
    });

    // Save report to file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFilename = `output-${timestamp}.md`;
    // await fs.writeFile(reportFilename, report, 'utf-8');

    const answer = await writeFinalAnswer({
      prompt: combinedQuery,
      learnings,
      report,
    });

    // Save answer to file
    const answerFilename = `answer-${timestamp}.md`;
    // await fs.writeFile(answerFilename, answer, 'utf-8');

    // Return the results
    return res.json({
      success: true,
      report,
      answer,
      learnings,
      visitedUrls,
      reportFilename,
      answerFilename
    });
  } catch (error: unknown) {
    console.error('Error in research API:', error);
    return res.status(500).json({ 
      error: 'An error occurred during research',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// API endpoint to get follow-up questions
app.post('/api/questions', async (req: Request, res: Response) => {
  try {
    const { query, numQuestions = 3 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const followUpQuestions = await generateFeedback({
      query,
      numQuestions
    });

    return res.json({
      success: true,
      questions: followUpQuestions
    });
  } catch (error: unknown) {
    console.error('Error generating questions:', error);
    return res.status(500).json({ 
      error: 'An error occurred while generating questions',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Deep Research API running on port ${port}`);
});

export default app; 