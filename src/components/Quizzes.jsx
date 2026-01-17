import { useState, useEffect } from 'react';
import './Quizzes.css';

export default function Quizzes() {
  // Form state
  const [topic, setTopic] = useState('python');
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState('easy');
  const [userContext, setUserContext] = useState('');

  // Quiz state
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quiz, setQuiz] = useState(null);
  const [responses, setResponses] = useState({});
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [view, setView] = useState('setup'); // 'setup', 'quiz', 'results', 'history'
  const [expandedAttempt, setExpandedAttempt] = useState(null); // Track expanded history item

  useEffect(() => {
    loadHistory();
  }, []);

  const handleGenerateQuiz = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          numQuestions: parseInt(numQuestions),
          difficulty,
          userContext: userContext || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate quiz');
      }

      const data = await response.json();
      setQuiz(data);
      setCurrentQuestion(0);
      setResponses({});
      setView('quiz');
    } catch (err) {
      setError(`Failed to generate quiz: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setResponses({
      ...responses,
      [questionId]: {
        value,
        answeredAt: new Date().toISOString(),
      },
    });
  };

  const handleNext = () => {
    if (currentQuestion < quiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/attempts/score-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec: {
            topic,
            numQuestions,
            difficulty,
            userContext: userContext || null,
          },
          quiz,
          responses,
          telemetry: { timeSpentSec: 0 }, // Can be enhanced with actual time tracking
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit quiz');
      }

      const data = await response.json();
      setResult(data);
      setView('results');
    } catch (err) {
      setError(`Failed to submit quiz: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/attempts?limit=50');
      if (!response.ok) throw new Error('Failed to load history');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      console.error('Failed to load quiz history:', err.message);
      setHistory([]);
    }
  };

  const handleViewHistory = () => {
    loadHistory();
    setView('history');
  };

  const handleBackToSetup = () => {
    setView('setup');
    setQuiz(null);
    setResponses({});
    setResult(null);
    setError(null);
  };

  // ────────────────────────────────
  // RENDER SECTIONS
  // ────────────────────────────────

  const renderSetup = () => (
    <div className="quiz-setup">
      <h2>Create a Quiz</h2>

      <div className="form-group">
        <label>Topic</label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g., python, javascript"
        />
      </div>

      <div className="form-group">
        <label>Number of Questions</label>
        <input
          type="number"
          value={numQuestions}
          onChange={(e) => setNumQuestions(e.target.value)}
          min="1"
          max="20"
        />
      </div>

      <div className="form-group">
        <label>Difficulty</label>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div className="form-group">
        <label>Additional Context (optional)</label>
        <textarea
          value={userContext}
          onChange={(e) => setUserContext(e.target.value)}
          placeholder="Add any context for the quiz..."
          rows="3"
        />
      </div>

      <div className="button-group">
        <button className="btn btn-primary" onClick={handleGenerateQuiz} disabled={loading}>
          {loading ? 'Generating...' : 'Generate Quiz'}
        </button>
        <button className="btn btn-secondary" onClick={handleViewHistory}>
          View History
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>
  );

  const renderQuiz = () => {
    if (!quiz || !quiz.questions) return null;

    const question = quiz.questions[currentQuestion];
    const responseData = responses[question.id] || {};

    return (
      <div className="quiz-container">
        <div className="quiz-header">
          <h2>Question {currentQuestion + 1} of {quiz.questions.length}</h2>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${((currentQuestion + 1) / quiz.questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="question">
          <p className="question-text">{question.prompt}</p>

          <div className="choices">
            {question.choices?.map((choice) => (
              <label key={choice.id} className="choice">
                <input
                  type="radio"
                  name={question.id}
                  value={choice.id}
                  checked={responseData.value === choice.id}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                />
                <span>{choice.text}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="quiz-footer">
          <button
            className="btn btn-secondary"
            onClick={handlePrevious}
            disabled={currentQuestion === 0 || loading}
          >
            Previous
          </button>

          {currentQuestion < quiz.questions.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={handleNext}
              disabled={loading}
            >
              Next
            </button>
          ) : (
            <button
              className="btn btn-primary btn-submit"
              onClick={handleSubmitQuiz}
              disabled={loading}
            >
              {loading ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}
      </div>
    );
  };

  const renderResults = () => {
    if (!result) return null;

    const percentage = result.result.percent;
    const color = percentage >= 70 ? 'green' : percentage >= 50 ? 'orange' : 'red';

    return (
      <div className="quiz-results">
        <h2>Quiz Results</h2>

        <div className="score-card">
          <div className="score-display" style={{ color }}>
            <div className="score-percent">{result.result.percent}%</div>
            <div className="score-fraction">
              {result.result.score} / {result.result.maxScore}
            </div>
          </div>
        </div>

        <div className="results-breakdown">
          <h3>Question Breakdown</h3>
          {result.quiz.questions.map((question, index) => {
            const qResult = result.result.perQuestion.find((r) => r.questionId === question.id);
            const isCorrect = qResult?.correct;

            return (
              <div key={question.id} className={`result-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                <div className="result-header">
                  <span className="result-number">Q{index + 1}</span>
                  <span className="result-status">{isCorrect ? '✓' : '✗'}</span>
                </div>
                <p className="result-question">{question.prompt}</p>
                <p className="result-explanation">
                  <strong>Explanation:</strong> {question.explanation}
                </p>
              </div>
            );
          })}
        </div>

        <div className="button-group">
          <button className="btn btn-primary" onClick={handleBackToSetup}>
            Take Another Quiz
          </button>
          <button className="btn btn-secondary" onClick={handleViewHistory}>
            View All Attempts
          </button>
        </div>
      </div>
    );
  };

  const renderHistory = () => (
    <div className="quiz-history">
      <h2>Quiz History</h2>

      {history.length === 0 ? (
        <p className="empty-state">No quiz attempts yet. Start by creating a quiz!</p>
      ) : (
        <div className="history-list">
          {history.map((attempt) => {
            const isExpanded = expandedAttempt === attempt.attemptId;
            return (
              <div key={attempt.attemptId} className="history-item">
                <div
                  className="history-header"
                  onClick={() => setExpandedAttempt(isExpanded ? null : attempt.attemptId)}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <h3>{attempt.spec.topic}</h3>
                    <p className="history-meta">
                      {attempt.spec.difficulty} • {attempt.spec.numQuestions} questions
                    </p>
                  </div>
                  <div className="history-score">
                    <div className="score">{attempt.result.percent}%</div>
                    <div className="fraction">{attempt.result.score}/{attempt.result.maxScore}</div>
                  </div>
                  <div className="expand-icon">{isExpanded ? '▼' : '▶'}</div>
                </div>
                <p className="history-date">
                  {new Date(attempt.createdAt).toLocaleString()}
                </p>

                {isExpanded && (
                  <div className="history-details">
                    <h4>Question Breakdown</h4>
                    {attempt.quiz.questions.map((question, index) => {
                      const qResult = attempt.result.perQuestion.find(
                        (r) => r.questionId === question.id
                      );
                      const isCorrect = qResult?.correct;
                      const userResponse = attempt.responses[question.id];

                      return (
                        <div
                          key={question.id}
                          className={`history-question ${isCorrect ? 'correct' : 'incorrect'}`}
                        >
                          <div className="question-header">
                            <span className="question-number">Q{index + 1}</span>
                            <span className="question-status">{isCorrect ? '✓' : '✗'}</span>
                          </div>
                          <p className="question-prompt">{question.prompt}</p>
                          <div className="question-details">
                            {userResponse && (
                              <div className="user-response">
                                <strong>Your answer:</strong>
                                {question.choices ? (
                                  ` ${question.choices.find((c) => c.id === userResponse.value)?.text || 'Not answered'}`
                                ) : (
                                  ` ${userResponse.value}`
                                )}
                              </div>
                            )}
                            {!isCorrect && question.choices && (
                              <div className="correct-answer">
                                <strong>Correct answer:</strong> {' '}
                                {question.choices.find((c) => c.id === question.answerKey.value)?.text}
                              </div>
                            )}
                            <div className="explanation">
                              <strong>Explanation:</strong> {question.explanation}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="button-group">
        <button className="btn btn-primary" onClick={handleBackToSetup}>
          Back to Setup
        </button>
      </div>
    </div>
  );

  // ────────────────────────────────
  // MAIN RENDER
  // ────────────────────────────────

  return (
    <div className="quizzes-container">
      <div className="quizzes-header">
        <h1>🧠 Big Brain Quiz</h1>
        <p>Learn and test your knowledge</p>
      </div>

      <div className="quizzes-content">
        {view === 'setup' && renderSetup()}
        {view === 'quiz' && renderQuiz()}
        {view === 'results' && renderResults()}
        {view === 'history' && renderHistory()}
      </div>
    </div>
  );
}
